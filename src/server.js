
const express = require('express');
const { chromium } = require('playwright-core');
const dotenv = require('dotenv');
const packageJson = require('../package.json');
const config = require('./config');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

dotenv.config();

async function startServer() {
  // Gunakan variabel 'config' yang sudah diimpor di atas
  const { CAMPAIGN_IDS, ALLOWED_ADMIN_NAMES, LOGIN_URL, CAMPAIGN_BASE_URL } = config;
  const EMAIL = process.env.EMAIL;
  const PASSWORD = process.env.PASSWORD;
  const WEBHOOK_URL = process.env.WEBHOOK_URL;

  // Browser Connection
  async function getBrowser() {
    console.log('Attempting browser connection...');
    try {
      console.log('Use local Chromium...');
      return await chromium.launch({ 
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Important for container environments
          '--disable-gpu',           // Helpful for server environments
        ]
      });
    } catch (error) {
      console.error('Browser failed to launch:', error.message);
      throw error;
    } 
  }

  // Core Functions
  async function login(page) {
    console.log('Initiating login process...');
    await page.goto(LOGIN_URL);
    console.log('Login page loaded');
    await page.fill("input[name=email]", EMAIL);
    await page.fill("input[name=password]", PASSWORD);
    console.log('Credentials entered');
    await page.click("button[type=submit]");
    await page.waitForLoadState("networkidle");
    console.log('Login completed successfully');
  }

  async function processCampaign(page, campaignId, adminNames) {
    try {
      console.log(`Processing campaign ${campaignId} with admins: ${adminNames.join(', ')}`);
      
      // Dynamic debug logging for the special campaign defined in config
      if (config.SPECIAL_CAMPAIGN && parseInt(campaignId) === config.SPECIAL_CAMPAIGN.id) {
        console.log(`🔍 SPECIAL CAMPAIGN (${config.SPECIAL_CAMPAIGN.id}): Processing with admins: ${adminNames.join(', ')}`);
        const foundExcluded = adminNames.filter(admin => config.SPECIAL_CAMPAIGN.excludedAdmins.includes(admin));

        if (foundExcluded.length > 0) {
          console.log(`❌ ERROR: Admins [${foundExcluded.join(', ')}] should have been excluded from campaign ${config.SPECIAL_CAMPAIGN.id}!`);
        } else {
          console.log(`✅ CORRECT: All necessary admins were properly excluded from campaign ${config.SPECIAL_CAMPAIGN.id}.`);
        } 
      }
      
      await page.goto(`${CAMPAIGN_BASE_URL}${campaignId}`);
      await page.waitForLoadState('networkidle');
      console.log(`Campaign ${campaignId} page loaded`);

      console.log(`Deleting 4 existing items...`);
      for (let i = 0; i < 4; i++) {
        if (await page.$("button.secondary.op-delete.icon-subtraction.delete")) {
        await page.click("button.secondary.op-delete.icon-subtraction.delete");
        await page.waitForTimeout(500);
        console.log(`Deleted item ${i + 1}`);
        } else {
          console.log(`No more items to delete after ${i} deletions`);
          break;
        }
      }

      console.log(`Cloning fields for ${adminNames.length} admins...`);
      for (let i = 1; i < adminNames.length; i++) {
        console.log(`Cloning field ${i + 1}...`);
      await page.click("button.secondary.op-clone.icon-addition.clone");
        await page.waitForTimeout(500);
      }

      for (let i = 0; i < adminNames.length; i++) {
        console.log(`Setting admin ${i + 1}: ${adminNames[i]}`);
        await page.click(`#app > form > section > article > div.columns.eight > div:nth-child(2) > div > div:nth-child(${i + 1}) .select2-arrow`);
        await page.keyboard.type(adminNames[i]);
      await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
        console.log(`Admin ${i + 1} set to ${adminNames[i]}`);
      }

      console.log('Saving changes...');
      await page.click("#app > form > section > article > div.columns.four > div.card.has-sections > div.card-section.secondary.align-right > small > button:nth-child(2)");
      console.log(`Campaign ${campaignId} processed successfully`);
      return true;
    } catch (error) {
      console.error(`Campaign ${campaignId} processing failed:`, error);
      return false;
    }
  }

  async function sendToWebhook(adminNames, timeOfDay) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ admins: adminNames, timeOfDay })
      });
      console.log('Webhook sent, status:', response.status);
    } catch (error) {
      console.error('Error sending to webhook:', error.message);
    }
  }

  async function runParallelCampaigns(browser, adminNames, campaignIds, batchSize = 3) {
    const results = [];
    
    for (let i = 0; i < campaignIds.length; i += batchSize) {
      const batch = campaignIds.slice(i, i + batchSize);
      console.log(`Processing batch of ${batch.length} campaigns...`);
      
      const batchPromises = batch.map(async (campaignId) => {
        const page = await browser.newPage();
        try {
          await login(page);
          const result = await processCampaign(page, campaignId, adminNames);
          return { campaignId, success: result };
        } finally {
          await page.close();
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      if (i + batchSize < campaignIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  async function runAutomation(adminPayloads, timeOfDay, campaignSelections, exemptionSettings = {}) {
    console.log(`Starting automation for ${timeOfDay} with admin payloads:`, adminPayloads);
    const browser = await getBrowser();

    try {
      let campaignIds = [];
      
      if (campaignSelections.regular.selected) {
        campaignIds = campaignIds.concat(CAMPAIGN_IDS[timeOfDay] || []);
      }

      const campaignGroups = {};
      const allSelectedAdmins = adminPayloads.map(p => p.name);

      for (const campaignId of campaignIds) {
          const payloadsForThisCampaign = adminPayloads.filter(payload => 
              config.canAdminProcessCampaign(payload.name, campaignId, allSelectedAdmins, exemptionSettings)
          );
          const adminNamesForThisCampaign = payloadsForThisCampaign.map(p => p.name);
          
          if (adminNamesForThisCampaign.length !== adminPayloads.length) {
              const excludedAdmins = allSelectedAdmins.filter(name => !adminNamesForThisCampaign.includes(name));
              console.log(`🔍 Campaign ${campaignId} restrictions: Excluded admins: [${excludedAdmins.join(', ')}] -> Processing with: [${adminNamesForThisCampaign.join(', ')}]`);
          }
          
          if (payloadsForThisCampaign.length === 0) {
              const logMessage = `Skipping campaign ${campaignId} as no admins are available to process it after applying rules.`;
              console.log(logMessage);
              continue;
          }
          
          const adminKey = adminNamesForThisCampaign.sort().join(',');
          
          if (!campaignGroups[adminKey]) {
              campaignGroups[adminKey] = {
                  admins: adminNamesForThisCampaign,
                  campaigns: []
              };
          }
          
          campaignGroups[adminKey].campaigns.push(campaignId);
      }
      
      const allResults = [];
      
      for (const groupKey in campaignGroups) {
        const group = campaignGroups[groupKey];
        console.log(`Processing group for admins: ${group.admins.join(', ')} with ${group.campaigns.length} campaigns`);
        
        const results = await runParallelCampaigns(browser, group.admins, group.campaigns);
        allResults.push(...results);
      }

      if (campaignSelections.regular.selected) {
        await sendToWebhook(allSelectedAdmins, timeOfDay);
      }
      
      return allResults.every(r => r.success);
    } catch (error) {
      console.error('Automation process failed:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

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

    runAutomation(adminPayloads, timeOfDay, campaignSelections, exemptionSettings)
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
