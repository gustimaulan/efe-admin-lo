
const express = require('express');
const { chromium } = require('playwright-core');
const dotenv = require('dotenv');
const packageJson = require('../package.json');
const config = require('./config');
const http = require('http');
const socketIo = require('socket.io');
const automationService = require('./services/automationService');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function startServer() {
  // Gunakan variabel 'config' yang sudah diimpor di atas
  const { CAMPAIGN_IDS, ALLOWED_ADMIN_NAMES, LOGIN_URL, CAMPAIGN_BASE_URL } = config;
  const EMAIL = process.env.EMAIL;
  const PASSWORD = process.env.PASSWORD;
  const WEBHOOK_URL = process.env.WEBHOOK_URL;

  const app = express();
  const PORT = config.SERVER.PORT || 3010;
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.set('trust proxy', true);

  const server = http.createServer(app);
  server.timeout = 600000;

  const io = socketIo(server);
  const runningJobs = new Map();

  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  console.log = function() {
    originalConsoleLog.apply(console, arguments);
    const message = Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    io.emit('console_logs', { timestamp: new Date(), message, isError: false });
  };

  console.error = function() {
    originalConsoleError.apply(console, arguments);
    const message = Array.from(arguments).map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    io.emit('console_logs', { timestamp: new Date(), message, isError: true });
  };

  io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('subscribeToJob', (jobId) => {
      console.log('Client subscribed to job:', jobId);
      socket.join(jobId);
    });
    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  function addJobLog(jobId, message, isError = false) {
    if (!runningJobs.has(jobId)) return;
    const job = runningJobs.get(jobId);
    if (!job.logs) job.logs = [];
    const logEntry = { timestamp: new Date(), message, isError };
    job.logs.push(logEntry);
    runningJobs.set(jobId, job);
    io.to(jobId).emit('newLog', logEntry);
  }

  app.get('/api/config', async (req, res) => {
    try {
      // Langsung kirim objek config yang sudah diimpor
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get configuration', error: error.message });
    }
  });

  const isObject = (item) => {
    return (item && typeof item === 'object' && !Array.isArray(item));
  };

  const deepMerge = (target, source) => {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (key in target && isObject(target[key])) {
                    output[key] = deepMerge(target[key], source[key]);
                } else {
                    output[key] = source[key];
                }
            } else {
                output[key] = source[key];
            }
        });
    }
    return output;
  };

  

  app.get('/', (req, res) => {
      const fs = require('fs');
      const path = require('path');
      let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      html = html.replace('{{VERSION}}', packageJson.version);
      res.send(html);
  });

  app.get('/version', (req, res) => {
    res.json({ version: packageJson.version, name: packageJson.name, timestamp: new Date().toISOString() });
  });

  app.get('/admin-restrictions', (req, res) => {
    res.json({
      message: "Admin restrictions are now handled through dynamic payload rules. Each admin can have include/exclude rules for specific campaigns.",
      supportedRuleTypes: ["include", "exclude", "null (all campaigns)"],
      nullRuleBehavior: "When ruleType and campaignId are null, admin can process all campaigns"
    });
  });

  app.post('/check-plan', (req, res) => {
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

    const allAdminsValid = adminPayloads.every(payload => ALLOWED_ADMIN_NAMES.includes(payload.name));
    if (!allAdminsValid || adminPayloads.length === 0) {
      return res.status(400).json({ message: 'Invalid or no admin names provided.' });
    }

    const plan = [];
    const campaignIds = CAMPAIGN_IDS[timeOfDay] || [];
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
  });

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

  app.get('/status/:jobId', (req, res) => {
    const jobId = req.params.jobId;
    if (runningJobs.has(jobId)) {
      res.json(runningJobs.get(jobId));
    } else {
      res.status(404).json({ status: 'error', message: 'Job not found' });
    }
  });

  app.post('/run', parseAdminPayloads, (req, res) => {
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

    console.log('DEBUG: Validating admin names.');
    console.log('DEBUG: adminPayloads:', JSON.stringify(adminPayloads));
    console.log('DEBUG: ALLOWED_ADMIN_NAMES:', JSON.stringify(ALLOWED_ADMIN_NAMES));

    const allAdminsValid = adminPayloads.every(payload => ALLOWED_ADMIN_NAMES.includes(payload.name));
    if (!allAdminsValid || adminPayloads.length === 0) {
      console.log('DEBUG: Validation failed. At least one admin name is not in ALLOWED_ADMIN_NAMES or no admins were provided.');
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

    automationService.runAutomation(adminPayloads, timeOfDay, campaignSelections, exemptionSettings, console)
      .then(success => {
        const finalMessage = `Automation ${success ? 'completed' : 'failed'}.`;
        addJobLog(jobId, finalMessage, !success);
        runningJobs.set(jobId, { ...runningJobs.get(jobId), status: 'completed', success, message: finalMessage, endTime: new Date() });
        setTimeout(() => { runningJobs.delete(jobId); }, 3600000);
      })
      .catch(error => {
        const finalMessage = `Automation failed: ${error.message}.`;
        addJobLog(jobId, finalMessage, true);
        runningJobs.set(jobId, { ...runningJobs.get(jobId), status: 'error', message: error.message, endTime: new Date() });
        setTimeout(() => { runningJobs.delete(jobId); }, 3600000);
      });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Enhanced server started on http://localhost:${PORT}`);
  });
}

startServer();
