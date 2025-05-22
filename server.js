const express = require('express');
const { chromium } = require('playwright-core');
const dotenv = require('dotenv');
const http = require('http');
dotenv.config();

// Configuration
const CAMPAIGN_IDS = [281482, 249397, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548
];
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
  return browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
} catch (error) {
  console.error('Browser failed to launch:', error.message);
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

// Update the runAutomation function for quick acknowledgement and background processing
async function runAutomation(adminNames, timeOfDay) {
  console.log(`Starting automation for ${timeOfDay} with admins: ${adminNames.join(', ')}`);
  const browser = await getBrowser();
  console.log('Opening new page...');
  const page = await browser.newPage();

  try {
    await login(page);
    const ttCampaignIds = [249397, 275170];
    let campaignIds;
    if (timeOfDay === "dhuha" || timeOfDay === "sore") {
      campaignIds = ttCampaignIds;
    } else {
      campaignIds = CAMPAIGN_IDS.filter(id => !ttCampaignIds.includes(id));
      if (timeOfDay === "dini") {
        campaignIds = campaignIds.filter(id => id !== 247001); // Exclude 247001 for dini
      }
    }
    console.log(`Selected campaigns to process: ${campaignIds.join(', ')}`);

    let allSuccessful = true;
    for (const id of campaignIds) {
      const success = await processCampaign(page, id, adminNames);
      if (!success) allSuccessful = false;
      await page.waitForTimeout(500);
    }

    await sendToWebhook(adminNames, timeOfDay);

    console.log(`Automation ${allSuccessful ? 'completed' : 'failed'} for ${timeOfDay}`);
    return allSuccessful;
  } catch (error) {
    console.error('Automation process failed:', error);
    throw error;
  } finally {
    console.log('Cleaning up: Closing page and browser...');
    await page.close();
    await browser.close();
    console.log('Cleanup completed');
  }
}

// Server Setup
const app = express();
const PORT = 3010;
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true);

// Set higher timeouts for the server
const server = http.createServer(app);
server.timeout = 600000; // 10 minutes timeout

// Store ongoing automation jobs
const runningJobs = new Map();

app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(__dirname + '/index.html');
});

app.get('/status/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  if (runningJobs.has(jobId)) {
    const job = runningJobs.get(jobId);
    res.json({ status: job.status, message: job.message });
  } else {
    res.status(404).json({ status: 'error', message: 'Job not found' });
  }
});

app.post('/run', (req, res) => {
  console.log('Received POST request to /run');
  const adminNames = [];
  
  // Extract all admin names from the request
  for (const key in req.body) {
    if (key.startsWith('admin')) {
      adminNames.push(req.body[key]);
    }
  }
  
  const timeOfDay = req.body.timeOfDay || "unknown";
  console.log(`Request parameters - admins: ${adminNames.join(', ')}, timeOfDay: ${timeOfDay}`);

  // Validate all admin names
  const allAdminsValid = adminNames.every(name => ALLOWED_ADMIN_NAMES.includes(name));
  if (!allAdminsValid || adminNames.length === 0) {
    console.log('Invalid admin names detected');
    return res.status(400).send('Invalid admin names');
  }

  // Generate a unique job ID
  const jobId = Date.now().toString();
  
  // Store job info
  runningJobs.set(jobId, {
    status: 'running',
    message: 'Automation started',
    adminNames,
    timeOfDay,
    startTime: new Date()
  });
  
  // Acknowledge the request immediately
  res.status(202).send('Automation started. Processing in background.');
  
  // Start the automation process in the background
  console.log('Starting automation process...');
  runAutomation(adminNames, timeOfDay)
    .then(success => {
      runningJobs.set(jobId, {
        status: 'completed',
        message: `Automation ${success ? 'completed' : 'failed'} for ${timeOfDay}`,
        adminNames,
        timeOfDay,
        success,
        endTime: new Date()
      });
      
      // Clean up job record after some time
      setTimeout(() => {
        runningJobs.delete(jobId);
      }, 3600000); // Remove after 1 hour
    })
    .catch(error => {
      runningJobs.set(jobId, {
        status: 'error',
        message: `Automation failed: ${error.message}`,
        adminNames,
        timeOfDay,
        error: error.message,
        endTime: new Date()
      });
      
      // Clean up job record after some time
      setTimeout(() => {
        runningJobs.delete(jobId);
      }, 3600000); // Remove after 1 hour
    });
});

server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});