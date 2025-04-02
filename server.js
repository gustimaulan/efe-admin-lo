const express = require('express');
const { chromium } = require('playwright');
const axios = require('axios');

// Configuration
const LOGIN_URL = "http://app.loops.id/login";
const CAMPAIGN_BASE_URL = "https://app.loops.id/campaign/";
const EMAIL = "anurisatria@gmail.com";
const PASSWORD = "Efeindonesia2020";
const CAMPAIGN_IDS = [249397, 250794, 250554, 250433];
const ALLOWED_ADMIN_NAMES = ["admin 1", "admin 2", "admin 3", "admin 4", "admin 5", "admin 6", "admin 7"];
const BCAT_URL = 'wss://api.browsercat.com/connect';
const API_KEY = 'Mb9riRt0DEEkYCNE5D7p9gilTGF16pFzDHaMP0HhxnKyjFxiHNUEpHN4dFBsDz9L';
const FONNTE_API_URL = 'https://api.fonnte.com/send';
const FONNTE_TOKEN = "TBKYN74wCBMv1TFYVNuG";
const WHATSAPP_TARGET = '6289506851030-1568542338@g.us';

// Browser Connection
async function getBrowser() {
  console.log('Starting browser connection...');
  try {
    const browser = await chromium.connect({
      wsEndpoint: BCAT_URL,
      headers: { 'Api-Key': API_KEY },
      timeout: 15000
    });
    console.log('Connected to BrowserCat successfully');
    return browser;
  } catch (error) {
    console.error("BrowserCat connection failed:", error);
    console.log('Falling back to local Chromium');
    const browser = await chromium.launch({ headless: true });
    console.log('Local Chromium launched');
    return browser;
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

async function sendWhatsAppMessage(admin1Name, admin2Name, status, finishTime) {
  console.log('Preparing WhatsApp message...');
  const message = `${status === 'success' ? '✅' : '❌'} ${status === 'success' ? 'Successfully set' : 'Failed to set'}:\n- ${admin1Name}\n${admin1Name !== admin2Name ? `- ${admin2Name}\n` : ''}at ${finishTime}`;
  
  try {
    console.log('Sending WhatsApp message...');
    await axios.post(FONNTE_API_URL, {
      target: WHATSAPP_TARGET,
      message
    }, {
      headers: { 'Authorization': FONNTE_TOKEN }
    });
    console.log('WhatsApp message sent successfully');
    return true;
  } catch (error) {
    console.error('WhatsApp message sending failed:', error.message);
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

    const campaignIds = timeOfDay === "dhuha" || timeOfDay === "sore" 
      ? [249397] 
      : CAMPAIGN_IDS.filter(id => id !== 249397);
    console.log(`Selected campaigns to process: ${campaignIds.join(', ')}`);

    let allSuccessful = true;
    for (const id of campaignIds) {
      const success = await processCampaign(page, id, admin1Name, admin2Name);
      if (!success) allSuccessful = false;
      await page.waitForTimeout(500);
    }

    const finishTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    console.log(`Automation finished at: ${finishTime}`);
    await sendWhatsAppMessage(admin1Name, admin2Name, allSuccessful ? 'success' : 'failure', finishTime);
    
    console.log(`Sending response to client: Automation ${allSuccessful ? 'completed' : 'failed'}`);
    res.send(`Automation ${allSuccessful ? 'completed' : 'failed'} for ${timeOfDay}`);
  } catch (error) {
    console.error('Automation process failed:', error);
    const finishTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
    await sendWhatsAppMessage(admin1Name, admin2Name, 'failure', finishTime);
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
app.use(express.urlencoded({ extended: true }));

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

app.listen(3010, () => {
  console.log('Server started on http://localhost:3010');
});