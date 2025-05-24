const express = require('express');
const { chromium } = require('playwright-core');
const dotenv = require('dotenv');
dotenv.config();

// Configuration
const CAMPAIGN_IDS = {
    regular: {
        pagi: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548],
        siang: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548],
        malam: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548],
        dini: [281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548],
        manual: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548]
    },
    tiktok: {
        dhuha: [249397, 275170],
        sore: [249397, 275170],
        manual: [249397, 275170]
    }
};
const ALLOWED_ADMIN_NAMES = ["admin 1", "admin 2", "admin 3", "admin 4", "admin 5", "admin 6", "admin 7"];
const LOGIN_URL= 'https://app.loops.id/login'
const CAMPAIGN_BASE_URL= 'https://app.loops.id/campaign/'
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
    console.log(`Processing campaign ${campaignId}...`);
    await page.goto(`${CAMPAIGN_BASE_URL}${campaignId}`);
    await page.waitForLoadState('networkidle');
    console.log(`Campaign ${campaignId} page loaded`);

    // Delete exactly the same number of items as admin names provided
    console.log(`Deleting ${adminNames.length} existing items...`);
    for (let i = 0; i < adminNames.length; i++) {
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

// Modified runAutomation function
async function runAutomation(adminNames, timeOfDay, campaignSelections) {
  console.log(`Starting automation for ${timeOfDay} with admins: ${adminNames.join(', ')}`);
  const browser = await getBrowser();

  try {
    let campaignIds = [];
    
    if (campaignSelections.regular.selected) {
      campaignIds = campaignIds.concat(CAMPAIGN_IDS.regular[timeOfDay] || []);
    }
    
    if (campaignSelections.tiktok.selected) {
      campaignIds = campaignIds.concat(CAMPAIGN_IDS.tiktok[timeOfDay] || []);
    }

    // Group campaigns by the admins that should process them
    const campaignGroups = {};
    
    for (const campaignId of campaignIds) {
      let adminsForThisCampaign = [...adminNames];
      
      // Special handling for campaign 247001
      if (campaignId === 247001) {
        adminsForThisCampaign = adminNames.filter(admin => 
          admin !== "admin 1" && admin !== "admin 2"
        );
        
        // Skip this campaign if no admins are left after filtering
        if (adminsForThisCampaign.length === 0) {
          console.log(`Skipping campaign ${campaignId} as all selected admins are excluded for it`);
          continue;
        }
      }
      
      // Create a key based on the admins for this campaign
      const adminKey = adminsForThisCampaign.sort().join(',');
      
      if (!campaignGroups[adminKey]) {
        campaignGroups[adminKey] = {
          admins: adminsForThisCampaign,
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
    await sendToWebhook(adminNames, timeOfDay);
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
const PORT = 3010;
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

app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(__dirname + '/index.html');
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
  const adminNames = [];
  const timeOfDay = req.body.timeOfDay || "manual"; // Default to "manual" for frontend requests
  const isManualRequest = req.body.isManual === 'true';
  
  // Extract all admin names from the request
  for (const key in req.body) {
    if (key.startsWith('admin')) {
      adminNames.push(req.body[key]);
    }
  }

  // Get campaign selections based on request type
  let campaignSelections;
  
  if (isManualRequest) {
    // Manual request from frontend - use explicit campaign selections
    campaignSelections = {
      regular: {
        selected: req.body.regularCampaigns === 'true',
        time: 'manual'
      },
      tiktok: {
        selected: req.body.tiktokCampaigns === 'true',
        time: 'manual'
      }
    };
  } else {
    // Automated request from AppScript - infer from timeOfDay
    campaignSelections = {
      regular: {
        selected: ['pagi', 'siang', 'malam', 'dini'].includes(timeOfDay),
        time: timeOfDay
      },
      tiktok: {
        selected: ['dhuha', 'sore'].includes(timeOfDay),
        time: timeOfDay
      }
    };
  }

  console.log(`Request parameters - admins: ${adminNames.join(', ')}, timeOfDay: ${timeOfDay}, isManual: ${isManualRequest}, campaigns:`, campaignSelections);

  // Validate all admin names
  const allAdminsValid = adminNames.every(name => ALLOWED_ADMIN_NAMES.includes(name));
  if (!allAdminsValid || adminNames.length === 0) {
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
    adminNames,
    timeOfDay,
    campaignSelections,
    logs: [{
      timestamp: new Date(),
      message: `Started automation for ${adminNames.join(', ')} with timeOfDay: ${timeOfDay}`,
      isError: false
    }]
  });

  // Send back the jobId immediately
  res.json({ 
    jobId,
    message: 'Automation started',
    status: 'running'
  });

  // Run the automation in the background
  runAutomation(adminNames, timeOfDay, campaignSelections)
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

server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});