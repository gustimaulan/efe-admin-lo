const express = require('express');
const automationService = require('../services/automationService');
const config = require('../config');

// Middleware to parse admin payloads from request body
const parseAdminPayloads = (req, res, next) => {
  req.adminPayloads = [];
  for (const key in req.body) {
    if (/^admin\d+$/.test(key)) {
      const adminName = req.body[key];
      if (adminName) { // Check if adminName is not an empty string
        req.adminPayloads.push({ name: adminName });
      }
    }
  }
  next();
};

const checkPlanHandler = (req, res) => {
  const adminPayloads = [];
  const timeOfDay = req.body.timeOfDay || "manual";

  for (const key in req.body) {
    if (/^admin\d+$/.test(key)) {
      const adminName = req.body[key];
      if (adminName) { // Check if adminName is not an empty string
        adminPayloads.push({ name: adminName });
      }
    }
  }

  const allAdminsValid = adminPayloads.every(payload => config.ALLOWED_ADMIN_NAMES.includes(payload.name));
  if (!allAdminsValid || adminPayloads.length === 0) {
    return res.status(400).json({ message: 'Invalid or no admin names provided.' });
  }

  const plan = [];
  const campaignIds = config.CAMPAIGN_IDS[timeOfDay] || [];
  const exemptionSettings = { exemptAdmin: req.body.exemptAdmin || null };
  const allSelectedAdminNames = adminPayloads.map(p => p.name);

  for (const campaignId of campaignIds) {
    const payloadsForThisCampaign = adminPayloads.filter(payload =>
      config.canAdminProcessCampaign(payload.name, campaignId, allSelectedAdminNames, exemptionSettings)
    );
    const processingAdmins = payloadsForThisCampaign.map(p => p.name);
    const excludedAdmins = allSelectedAdminNames.filter(name => !processingAdmins.includes(name));

    if (processingAdmins.length > 0) {
      plan.push({ campaignId, processingAdmins, excludedAdmins });
    } else {
      plan.push({ campaignId, processingAdmins: [], excludedAdmins: allSelectedAdminNames, skipped: true });
    }
  }

  res.json({ message: 'Processing plan generated successfully.', plan: plan });
};

const createRunHandler = ({ runningJobs, logger }) => async (req, res) => {
  logger.info('/api/admin/change-all received a request.');
  try {
    const { adminPayloads } = req;
    const timeOfDay = req.body.timeOfDay || "manual";
    const isManualRequest = req.body.isManual === 'true';
    
    let campaignSelections;
    
    if (isManualRequest) {
      campaignSelections = { regular: { selected: req.body.regularCampaigns === 'true', time: 'manual' } };
    } else {
      campaignSelections = { regular: { selected: ['pagi', 'siang', 'malam'].includes(timeOfDay), time: timeOfDay } };
    }

    const exemptionSettings = { exemptAdmin: req.body.exemptAdmin || null };

    logger.debug('Validating admin names.');
    logger.debug(`adminPayloads: ${JSON.stringify(adminPayloads)}`);
    logger.debug(`ALLOWED_ADMIN_NAMES: ${JSON.stringify(config.ALLOWED_ADMIN_NAMES)}`);

    const allAdminsValid = adminPayloads.every(payload => config.ALLOWED_ADMIN_NAMES.includes(payload.name));
    if (!allAdminsValid || adminPayloads.length === 0) {
      logger.warn('Validation failed. At least one admin name is not in ALLOWED_ADMIN_NAMES or no admins were provided.');
      return res.status(400).json({ message: 'Invalid admin names' });
    }

    const jobId = Date.now().toString();
    
    runningJobs.set(jobId, {
      status: 'running',
      message: 'Automation started',
      startTime: new Date(),
      adminPayloads,
      timeOfDay,
      campaignSelections,
      exemptionSettings,
      logs: [{ timestamp: new Date(), message: `Started automation for admin payloads: ${adminPayloads.map(p => p.name).join(', ')} with timeOfDay: ${timeOfDay}`, isError: false }]
    });

    res.json({ jobId, message: 'Automation started', status: 'running' });

    automationService.runAutomation(adminPayloads, timeOfDay, campaignSelections, exemptionSettings, logger)
      .then(success => {
        const finalMessage = `Automation ${success ? 'completed' : 'failed'}.`;
        logger.info(finalMessage, { jobId });
        runningJobs.set(jobId, { ...runningJobs.get(jobId), status: 'completed', success, message: finalMessage, endTime: new Date() });
        setTimeout(() => { runningJobs.delete(jobId); }, 3600000);
      })
      .catch(error => {
        const finalMessage = `Automation failed: ${error.message}.`;
        logger.error(finalMessage, { jobId });
        runningJobs.set(jobId, { ...runningJobs.get(jobId), status: 'error', message: error.message, endTime: new Date() });
        setTimeout(() => { runningJobs.delete(jobId); }, 3600000);
      });
  } catch (error) {
    logger.error('Error in /api/admin/change-all handler:', { error: error.message });
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

const createAutomationRouter = ({ runningJobs, logger }) => {
  const router = express.Router();
  router.post('/admin/change-all', parseAdminPayloads, createRunHandler({ runningJobs, logger }));
  router.post('/check-plan', checkPlanHandler);

  router.post('/admin/add', async (req, res) => {
    // The 'add' action now uses the first admin field
    const adminName = req.body.admin1;

    if (!adminName) {
      logger.warn('[/api/admin/add] Validation failed: adminName (from admin1) is required.');
      return res.status(400).json({ message: 'An admin name is required.' });
    }

    const jobId = Date.now().toString();
    logger.info(`[/api/admin/add] Received request to add admin ${adminName} to ALL campaigns. Job ID: ${jobId}`);

    runningJobs.set(jobId, {
      status: 'running',
      message: `Adding admin ${adminName} to all campaigns`,
      startTime: new Date(),
      adminName,
      logs: [{ timestamp: new Date(), message: `Started adding admin ${adminName} to all campaigns`, isError: false }]
    });

    res.json({ jobId, message: 'Add admin process started', status: 'running' });

    // Use the new service function to add the admin to all campaigns
    automationService.addAdminToAllCampaigns(adminName, logger)
      .then(success => {
        const finalMessage = `Adding admin ${adminName} to all campaigns ${success ? 'completed' : 'failed'}.`;
        logger.info(finalMessage, { jobId });
        runningJobs.set(jobId, { ...runningJobs.get(jobId), status: 'completed', success, message: finalMessage, endTime: new Date() });
        setTimeout(() => { runningJobs.delete(jobId); }, 3600000);
      })
      .catch(error => {
        const finalMessage = `Adding admin ${adminName} to all campaigns failed: ${error.message}.`;
        logger.error(finalMessage, { jobId });
        runningJobs.set(jobId, { ...runningJobs.get(jobId), status: 'error', message: error.message, endTime: new Date() });
        setTimeout(() => { runningJobs.delete(jobId); }, 3600000);
      });
  });

  return router;
};

module.exports.checkPlanHandler = checkPlanHandler;
module.exports.createAutomationRouter = createAutomationRouter;
module.exports.parseAdminPayloads = parseAdminPayloads;
module.exports.createRunHandler = createRunHandler;