const express = require('express');
const { chromium } = require('playwright-core');
const dotenv = require('dotenv');
const packageJson = require('../package.json'); // Using the original package.json
dotenv.config();

// Using the enhanced configuration with new payload structure
const config = require('./config-enhanced.js');
const { CAMPAIGN_IDS, ALLOWED_ADMIN_NAMES } = config;
const { LOGIN_URL, CAMPAIGN_BASE_URL } = config;
const EMAIL = process.env.EMAIL
const PASSWORD = process.env.PASSWORD
const WEBHOOK_URL = process.env.WEBHOOK_URL

// Browser Connection
async function getBrowser() {
  console.log('Attempting browser connection...');
  try {
    console.log('Use local Chromium...');
    return browser = await chromium.launch({ 
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
    
    // Special debug logging for campaign 247001 (lanjutan)
    if (campaignId === 247001) {
      console.log(`🔍 CAMPAIGN 247001 (LANJUTAN): Processing with admins: ${adminNames.join(', ')}`);
      if (adminNames.includes('admin 10')) {
        console.log(`❌ ERROR: Admin 10 should be excluded from campaign 247001!`);
      } else {
        console.log(`✅ CORRECT: Admin 10 properly excluded from campaign 247001`);
      }
    }
    
    await page.goto(`${CAMPAIGN_BASE_URL}${campaignId}`);
    await page.waitForLoadState('networkidle');
    console.log(`Campaign ${campaignId} page loaded`);

    // Delete exactly 4 items (hardcoded)
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

    // Step 1: Clone all needed admin fields
    console.log(`Cloning fields for ${adminNames.length} admins...`);
    // We already have the first field, so clone (adminNames.length - 1) more
    for (let i = 1; i < adminNames.length; i++) {
      console.log(`Cloning field ${i + 1}...`);
    await page.click("button.secondary.op-clone.icon-addition.clone");
      await page.waitForTimeout(500);
    }

    // Step 2: Set admin names for each field
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

// Update the webhook function to handle dynamic admins
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

// New function for parallel processing
async function runParallelCampaigns(browser, adminNames, campaignIds, batchSize = 3) {
  const results = [];
  
  // Process campaigns in batches
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
        await page.close(); // Important to close pages to free resources
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to prevent overwhelming the server
    if (i + batchSize < campaignIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Modified runAutomation function using the new payload-based config
async function runAutomation(adminPayloads, timeOfDay, campaignSelections, exemptionSettings = {}) {
  console.log(`Starting automation for ${timeOfDay} with admin payloads:`, adminPayloads);
  const browser = await getBrowser();

  try {
    let campaignIds = [];
    
    if (campaignSelections.regular.selected) {
      campaignIds = campaignIds.concat(CAMPAIGN_IDS.staging[timeOfDay] || []);
    }

    // Group campaigns by the admins that should process them based on the new payload structure
    const campaignGroups = {};
    
    for (const campaignId of campaignIds) {
        // Use new payload-based restriction system
        // FIX: Filter the original adminPayloads array to keep the full object structure,
        // instead of just getting back an array of names.
        const payloadsForThisCampaign = adminPayloads.filter(payload => 
            config.canAdminProcessCampaign(payload.name, campaignId, adminPayloads, exemptionSettings)
        );
        const adminNamesForThisCampaign = payloadsForThisCampaign.map(p => p.name);
        
        // Log the filtering for transparency
        if (adminNamesForThisCampaign.length !== adminPayloads.length) {
            const excludedAdmins = adminPayloads.map(p => p.name).filter(name => !adminNamesForThisCampaign.includes(name));
            console.log(`🔍 Campaign ${campaignId} restrictions: Excluded admins: [${excludedAdmins.join(', ')}] -> Processing with: [${adminNamesForThisCampaign.join(', ')}]`);
        }
        
        // Skip this campaign if no admins are left after filtering
        if (payloadsForThisCampaign.length === 0) {
            const logMessage = `Skipping campaign ${campaignId} as no admins are available to process it after applying rules.`;
            console.log(logMessage);
            // Optionally, you can add this to the job log so it's visible on the frontend.
            // if (jobId) addJobLog(jobId, logMessage, false);
            continue;
        }
        
        // Create a key based on the admins for this campaign
        const adminKey = adminNamesForThisCampaign.sort().join(',');
        
        if (!campaignGroups[adminKey]) {
            campaignGroups[adminKey] = {
                admins: adminNamesForThisCampaign,
                campaigns: []
            };
        }
        
        campaignGroups[adminKey].campaigns.push(campaignId);
    }
    
    // Process each group of campaigns with their specific admins
    const allResults = [];
    
    for (const groupKey in campaignGroups) {
      const group = campaignGroups[groupKey];
      console.log(`Processing group for admins: ${group.admins.join(', ')} with ${group.campaigns.length} campaigns`);
      
      // Use the existing batch processing for each group
      const results = await runParallelCampaigns(browser, group.admins, group.campaigns);
      allResults.push(...results);
    }

    // Only send webhook if regular campaigns were selected
    if (campaignSelections.regular.selected) {
    await sendToWebhook(adminPayloads.map(admin => admin.name), timeOfDay);
    }
    
    return allResults.every(r => r.success);
  } catch (error) {
    console.error('Automation process failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Server Setup
const app = express();
const PORT = 3011; // Using different port to avoid conflict
const http = require('http');
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true);

// Set higher timeouts for the server
const server = http.createServer(app);
server.timeout = 600000; // 10 minutes timeout

// Enhanced job tracking with detailed logs
const runningJobs = new Map();

// Add a helper function to add logs to a job
// Add these imports at the top
const socketIo = require('socket.io');

// Create HTTP server and Socket.IO instance
const io = socketIo(server);

// Override console.log to also emit messages to Socket.IO
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function() {
  // Call the original console.log
  originalConsoleLog.apply(console, arguments);
  
  // Convert arguments to a proper string message
  const message = Array.from(arguments).map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return arg.toString();
      }
    }
    return arg;
  }).join(' ');
  
  // Emit to a specific 'console_logs' event that all clients can listen to
  io.emit('console_logs', {
    timestamp: new Date(),
    message,
    isError: false
  });
};

console.error = function() {
  // Call the original console.error
  originalConsoleError.apply(console, arguments);
  
  // Convert arguments to a proper string message
  const message = Array.from(arguments).map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return arg.toString();
      }
    }
    return arg;
  }).join(' ');
  
  // Emit to the same 'console_logs' event but marked as an error
  io.emit('console_logs', {
    timestamp: new Date(),
    message,
    isError: true
  });
};

// Set up Socket.IO connection handling
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

// Modify the addJobLog function to emit logs via Socket.IO
function addJobLog(jobId, message, isError = false) {
  if (!runningJobs.has(jobId)) return;
  
  const job = runningJobs.get(jobId);
  if (!job.logs) job.logs = [];
  
  const logEntry = {
    timestamp: new Date(),
    message,
    isError
  };
  
  job.logs.push(logEntry);
  runningJobs.set(jobId, job);
  
  // Emit the new log to all clients subscribed to this job
  io.to(jobId).emit('newLog', logEntry);
}

// Add a new endpoint to get detailed logs
app.get('/logs/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  if (runningJobs.has(jobId)) {
    const job = runningJobs.get(jobId);
    res.json({
      status: job.status,
      logs: job.logs || []
    });
  } else {
    res.status(404).json({ 
      status: 'error', 
      message: 'Job logs not found' 
    });
  }
});

// Update the root route
app.get('/', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    let html = fs.readFileSync(path.join(__dirname, 'index-enhanced.html'), 'utf8');
    
    // Replace version placeholder
    html = html.replace('{{VERSION}}', packageJson.version);
    
    res.send(html);
});

// Version endpoint
app.get('/version', (req, res) => {
  res.json({
    version: packageJson.version,
    name: packageJson.name,
    timestamp: new Date().toISOString()
  });
});

// Admin restrictions endpoint - updated to show enhanced config
app.get('/admin-restrictions', (req, res) => {
  // For the new payload-based system, we don't have predefined rules, so return a simple response
  res.json({
    message: "Admin restrictions are now handled through dynamic payload rules. Each admin can have include/exclude rules for specific campaigns.",
    supportedRuleTypes: ["include", "exclude", "null (all campaigns)"],
    nullRuleBehavior: "When ruleType and campaignId are null, admin can process all campaigns"
  });
});

app.post('/check-plan', (req, res) => {
  console.log('Received POST request to /check-plan');
  const adminPayloads = [];
  const timeOfDay = req.body.timeOfDay || "manual";

  // --- Re-use payload extraction logic from /run ---
  for (const key in req.body) {
    if (/^admin\d+$/.test(key)) {
      const adminIndex = key.replace('admin', '');
      const adminName = req.body[key];
      const ruleTypeKey = `inlineRuleType${adminIndex}`;
      const campaignIdKey = `inlineRuleCampaign${adminIndex}`;
      let ruleType = req.body[ruleTypeKey] || null;
      let campaignId = req.body[campaignIdKey] || null;
      if (ruleType === '' || ruleType === undefined) ruleType = null;
      if (campaignId === '' || campaignId === undefined) campaignId = null;
      adminPayloads.push({ name: adminName, ruleType, campaignId });
    }
  }

  // --- Validate admins ---
  const allAdminsValid = adminPayloads.every(payload => ALLOWED_ADMIN_NAMES.includes(payload.name));
  if (!allAdminsValid || adminPayloads.length === 0) {
    return res.status(400).json({ message: 'Invalid or no admin names provided.' });
  }

  // --- Simulate the planning logic from runAutomation ---
  const plan = [];
  const campaignIds = CAMPAIGN_IDS.staging[timeOfDay] || [];
  const exemptionSettings = { exemptAdmin: req.body.exemptAdmin || null };
  const allSelectedAdminNames = adminPayloads.map(p => p.name);

  for (const campaignId of campaignIds) {
    const payloadsForThisCampaign = adminPayloads.filter(payload =>
      config.canAdminProcessCampaign(payload.name, campaignId, adminPayloads, exemptionSettings)
    );
    const processingAdmins = payloadsForThisCampaign.map(p => p.name);
    const excludedAdmins = allSelectedAdminNames.filter(name => !processingAdmins.includes(name));

    if (processingAdmins.length > 0) {
      plan.push({
        campaignId,
        processingAdmins,
        excludedAdmins
      });
    } else {
      plan.push({
        campaignId,
        processingAdmins: [],
        excludedAdmins: allSelectedAdminNames,
        skipped: true
      });
    }
  }

  res.json({
    message: 'Processing plan generated successfully.',
    plan: plan
  });
});

app.get('/status/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  if (runningJobs.has(jobId)) {
    res.json(runningJobs.get(jobId));
  } else {
    res.status(404).json({ 
      status: 'error', 
      message: 'Job not found' 
    });
  }
});

app.post('/run', (req, res) => {
  console.log('Received POST request to /run');
  const adminPayloads = [];
  const timeOfDay = req.body.timeOfDay || "manual"; // Default to "manual" for frontend requests
  const isManualRequest = req.body.isManual === 'true';
  
  // Extract admin payloads from the request with rule-based system
  for (const key in req.body) {
    // Use a regex to strictly match 'admin' followed by digits, e.g., 'admin1', 'admin2'
    if (/^admin\d+$/.test(key)) {
      const adminIndex = key.replace('admin', '');
      const adminName = req.body[key];
      
      // Get the corresponding rule type and campaign ID for this admin
      // FIX: Use the correct field names sent from the frontend ('inlineRuleType' and 'inlineRuleCampaign')
      const ruleTypeKey = `inlineRuleType${adminIndex}`;
      const campaignIdKey = `inlineRuleCampaign${adminIndex}`;
      
      let ruleType = req.body[ruleTypeKey] || null;
      let campaignId = req.body[campaignIdKey] || null;
      
      // If both ruleType and campaignId are empty, set them to null to indicate the admin can process all campaigns
      if (ruleType === '' || ruleType === undefined) ruleType = null;
      if (campaignId === '' || campaignId === undefined) campaignId = null;
      
      // Create admin payload with rule-based system
      const adminPayload = {
        name: adminName,
        ruleType: ruleType,
        campaignId: campaignId
      };
      
      adminPayloads.push(adminPayload);
    }
  }
  
  console.log(`Received admin payloads:`, adminPayloads);

  // Get campaign selections based on request type
  let campaignSelections;
  
  if (isManualRequest) {
    // Manual request from frontend - use explicit campaign selections
    campaignSelections = {
      regular: {
        selected: req.body.regularCampaigns === 'true',
        time: 'manual'
      }
    };
  } else {
    // Automated request from AppScript - infer from timeOfDay
    campaignSelections = {
      regular: {
        selected: ['pagi', 'siang', 'malam'].includes(timeOfDay),
        time: timeOfDay
      }
    };
  }

  // Get exclusion settings from the request
  const exemptionSettings = {
    // New setting for dynamic exemption
    exemptAdmin: req.body.exemptAdmin || null
  };

  console.log(`Request parameters - admin payloads:`, adminPayloads, `timeOfDay: ${timeOfDay}, isManual: ${isManualRequest}, campaigns:`, campaignSelections);

  // Validate all admin names
  const allAdminsValid = adminPayloads.every(payload => ALLOWED_ADMIN_NAMES.includes(payload.name));
  if (!allAdminsValid || adminPayloads.length === 0) {
    console.log('Invalid admin names detected');
    return res.status(400).send('Invalid admin names');
  }

  // Generate a unique job ID
  const jobId = Date.now().toString();
  
  // Store initial job status with empty logs array
  runningJobs.set(jobId, {
    status: 'running',
    message: 'Automation started',
    startTime: new Date(),
    adminPayloads,
    timeOfDay,
    campaignSelections,
    exemptionSettings,
    logs: [{
      timestamp: new Date(),
      message: `Started automation for admin payloads: ${adminPayloads.map(p => p.name).join(', ')} with timeOfDay: ${timeOfDay}`,
      isError: false
    }]
  });

  // Send back the jobId immediately
  res.json({ 
    jobId,
    message: 'Automation started',
    status: 'running'
  });

  // Run the automation in the background with new payload structure
  runAutomation(adminPayloads, timeOfDay, campaignSelections, exemptionSettings)
    .then(success => {
      runningJobs.set(jobId, {
        status: 'completed',
        success,
        message: `Automation ${success ? 'completed' : 'failed'}`,
        endTime: new Date()
      });

      setTimeout(() => {
        runningJobs.delete(jobId);
      }, 3600000);
    })
    .catch(error => {
      runningJobs.set(jobId, {
        status: 'error',
        message: error.message,
        endTime: new Date()
      });

      setTimeout(() => {
        runningJobs.delete(jobId);
      }, 3600000);
    });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Enhanced server started on http://localhost:${PORT}`);
});