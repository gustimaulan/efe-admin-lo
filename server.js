const express = require('express');
const { chromium } = require('playwright-core');
const dotenv = require('dotenv');
dotenv.config();

// Configuration
const CAMPAIGN_IDS = [281482, 249397, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548
];
const ALLOWED_ADMIN_NAMES = ["admin 1", "admin 2", "admin 3", "admin 4", "admin 5", "admin 6", "admin 7"];
const LOGIN_URL= 'https://app.loops.id/login'
const CAMPAIGN_BASE_URL= 'https://app.loops.id/campaign/'
const EMAIL = process.env.EMAIL
const PASSWORD = process.env.PASSWORD
const BCAT_URL= 'wss://api.browsercat.com/connect'
const BCAT_API_KEY = process.env.BCAT_API_KEY
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN

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

async function processCampaign(page, campaignId, admin1Name, admin2Name) {
  try {
    console.log(`Processing campaign ${campaignId}...`);
    await page.goto(`${CAMPAIGN_BASE_URL}${campaignId}`);
    await page.waitForLoadState('networkidle');
    console.log(`Campaign ${campaignId} page loaded`);

    console.log('Deleting existing items...');
    for (let i = 0; i < 2; i++) {
      await page.click("button.secondary.op-delete.icon-subtraction.delete");
      await page.waitForTimeout(500);
      console.log(`Deleted item ${i + 1}`);
    }

    console.log(`Setting admin 1: ${admin1Name}`);
    await page.click("#app > form > section > article > div.columns.eight > div:nth-child(2) > div > div:nth-child(1) .select2-arrow");
    await page.keyboard.type(admin1Name);
    await page.keyboard.press("Enter");
    console.log('Admin 1 set');

    console.log('Cloning for admin 2...');
    await page.click("button.secondary.op-clone.icon-addition.clone");
    console.log(`Setting admin 2: ${admin2Name}`);
    await page.click("#app > form > section > article > div.columns.eight > div:nth-child(2) > div > div:nth-child(2) .select2-arrow");
    await page.keyboard.type(admin2Name);
    await page.keyboard.press("Enter");
    console.log('Admin 2 set');

    console.log('Saving changes...');
    await page.click("#app > form > section > article > div.columns.four > div.card.has-sections > div.card-section.secondary.align-right > small > button:nth-child(2)");
    console.log(`Campaign ${campaignId} processed successfully`);
    return true;
  } catch (error) {
    console.error(`Campaign ${campaignId} processing failed:`, error);
    return false;
  }
}


// Automation Process
async function runAutomation(admin1Name, admin2Name, timeOfDay, res) {
  console.log(`Starting automation for ${timeOfDay} with admins: ${admin1Name}, ${admin2Name}`);
  const browser = await getBrowser();
  console.log('Opening new page...');
  const page = await browser.newPage();

  try {
    await login(page);
    const ttCampaignIds = [249397, 275170];
    const campaignIds = timeOfDay === "dhuha" || timeOfDay === "sore" 
      ? ttCampaignIds 
      : CAMPAIGN_IDS.filter(id => !ttCampaignIds.includes(id));
    console.log(`Selected campaigns to process: ${campaignIds.join(', ')}`);

    let allSuccessful = true;
    for (const id of campaignIds) {
      const success = await processCampaign(page, id, admin1Name, admin2Name);
      if (!success) allSuccessful = false;
      await page.waitForTimeout(500);
    }

    
    console.log(`Sending response to client: Automation ${allSuccessful ? 'completed' : 'failed'}`);
    res.send(`Automation ${allSuccessful ? 'completed' : 'failed'} for ${timeOfDay}`);
  } catch (error) {
    console.error('Automation process failed:', error);
    res.status(500).send(`Automation failed: ${error.message}`);
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

app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(__dirname + '/index.html');
});

app.post('/run', (req, res) => {
  console.log('Received POST request to /run');
  const admin1Name = req.body.admin1;
  const admin2Name = req.body.admin2;
  const timeOfDay = req.body.timeOfDay || "unknown";
  console.log(`Request parameters - admin1: ${admin1Name}, admin2: ${admin2Name}, timeOfDay: ${timeOfDay}`);

  if (!ALLOWED_ADMIN_NAMES.includes(admin1Name) || !ALLOWED_ADMIN_NAMES.includes(admin2Name)) {
    console.log('Invalid admin names detected');
    return res.status(400).send('Invalid admin names');
  }

  console.log('Starting automation process...');
  runAutomation(admin1Name, admin2Name, timeOfDay, res);
});

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});