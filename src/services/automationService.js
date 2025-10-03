const { chromium } = require('playwright-core');
const config = require('../config');
const dotenv = require('dotenv');

dotenv.config();

const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Browser Connection
async function getBrowser(logger) {
  logger.info('Attempting browser connection...');
  try {
    logger.info('Use local Chromium...');
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
    logger.error('Browser failed to launch:', { error: error.message });
    throw error;
  }
}

// Core Functions
async function login(page, logger) {
  logger.info('Initiating login process...');
  await page.goto(config.LOGIN_URL);
  logger.info('Login page loaded');
  await page.fill("input[name=email]", EMAIL);
  await page.fill("input[name=password]", PASSWORD);
  logger.info('Credentials entered');
  await page.click("button[type=submit]");
  await page.waitForLoadState("networkidle");
  logger.info('Login completed successfully');
}

// Helper Functions for common actions
async function goToCampaignPage(page, campaignId, logger) {
  await page.goto(`${config.CAMPAIGN_BASE_URL}${campaignId}`);
  await page.waitForLoadState('networkidle');
  logger.info(`Campaign ${campaignId} page loaded`);
}

async function cloneField(page, logger) {
  logger.info('Cloning field...');
  await page.click("button.secondary.op-clone.icon-addition.clone");
  await page.waitForTimeout(500);
}

async function setAdmin(page, adminName, index, logger) {
  logger.info(`Setting admin ${index + 1}: ${adminName}`);
  await page.click(`#app > form > section > article > div.columns.eight > div:nth-child(2) > div > div:nth-child(${index + 1}) .select2-arrow`);
  await page.keyboard.type(adminName);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  logger.info(`Admin ${index + 1} set to ${adminName}`);
}

async function saveChanges(page, logger) {
  logger.info('Saving changes...');
  await page.click("#app > form > section > article > div.columns.four > div.card.has-sections > div.card-section.secondary.align-right > small > button:nth-child(2)");
}

async function deleteItems(page, count, logger) {
  logger.info(`Deleting ${count} existing items...`);
  for (let i = 0; i < count; i++) {
    if (await page.$("button.secondary.op-delete.icon-subtraction.delete")) {
      await page.click("button.secondary.op-delete.icon-subtraction.delete");
      await page.waitForTimeout(500);
      logger.info(`Deleted item ${i + 1}`);
    } else {
      logger.info(`No more items to delete after ${i} deletions`);
      break;
    }
  }
}

async function processCampaign(page, campaignId, adminNames, allSelectedAdmins = [], logger) {
  try {
    logger.info(`Processing campaign ${campaignId} with admins: ${adminNames.join(', ')}`);

    // Dynamic debug logging for the special campaign defined in config
    if (config.SPECIAL_CAMPAIGN && parseInt(campaignId) === config.SPECIAL_CAMPAIGN.id) {
      logger.info(`🔍 SPECIAL CAMPAIGN (${config.SPECIAL_CAMPAIGN.id}): Processing with admins: [${adminNames.join(', ')}]`);

      // Find which admins from the original selection were correctly excluded for this special campaign.
      const originallySelected = allSelectedAdmins.length > 0 ? allSelectedAdmins : adminNames;
      const excludedForThisCampaign = originallySelected.filter(admin => !adminNames.includes(admin));

      if (excludedForThisCampaign.length > 0) {
        logger.info(`✅ CORRECT: Admins [${excludedForThisCampaign.join(', ')}] were properly excluded from campaign ${config.SPECIAL_CAMPAIGN.id}.`);
      } else {
        logger.info(`ℹ️ INFO: No admins were excluded for special campaign ${config.SPECIAL_CAMPAIGN.id} from the current selection.`);
      }
    }

    await goToCampaignPage(page, campaignId, logger);

    await deleteItems(page, 4, logger);

    logger.info(`Cloning fields for ${adminNames.length} admins...`);
    for (let i = 1; i < adminNames.length; i++) {
      await cloneField(page, logger);
    }

    for (let i = 0; i < adminNames.length; i++) {
      await setAdmin(page, adminNames[i], i, logger);
    }

    await saveChanges(page, logger);
    logger.info(`Campaign ${campaignId} processed successfully`);
    return true;
  } catch (error) {
    logger.error(`Campaign ${campaignId} processing failed:`, { error });
    return false;
  }
}

async function addAdminToCampaign(campaignId, adminName, logger, pageInstance = null) {
  let browser;
  let page = pageInstance;
  try {
    if (!page) {
      browser = await getBrowser(logger);
      page = await browser.newPage();
      await login(page, logger);
    }

    logger.info(`Adding admin ${adminName} to campaign ${campaignId}...`);
    await goToCampaignPage(page, campaignId, logger);

    // 1. Get all existing admin names from the page
    const existingAdminNames = await page.evaluate(() => {
      const names = [];
      // Target the specific admin dropdowns to avoid grabbing other '.select2-chosen' elements
      const elements = document.querySelectorAll('#app > form > section > article > div.columns.eight > div:nth-child(2) > div > div .select2-chosen');
      elements.forEach(el => {
        if (el.textContent && el.textContent.trim()) {
          names.push(el.textContent.trim());
        }
      });
      return names;
    });
    logger.info(`Found existing admins: [${existingAdminNames.join(', ')}]`);

    // 2. Create the new list of admins
    const newAdminList = [...new Set([...existingAdminNames, adminName])]; // Use Set to avoid duplicates
    logger.info(`New admin list will be: [${newAdminList.join(', ')}]`);

    // 3. Re-process the campaign with the complete new list of admins
    // This is more robust than trying to append one admin.
    // We pass `newAdminList` as both the list to process and the "all selected" context.
    await processCampaign(page, campaignId, newAdminList, newAdminList, logger);

    // Note: saveChanges() is now handled inside processCampaign, so we don't call it here.

    logger.info(`Admin ${adminName} added to campaign ${campaignId} successfully`);
    return true;
  } catch (error) {
    logger.error(`Failed to add admin ${adminName} to campaign ${campaignId}:`, { error });
    return false;
  } finally {
    if (browser && !pageInstance) { // Only close the browser if it was created in this function
      await browser.close();
    }
  }
}

async function addAdminToAllCampaigns(adminName, logger) {
  logger.info(`Starting process to add admin '${adminName}' to all campaigns.`);
  const browser = await getBrowser(logger);
  try {
    // Get all unique campaign IDs from all time-of-day settings
    const allCampaignIds = Object.values(config.CAMPAIGN_IDS).flat();
    const uniqueCampaignIds = [...new Set(allCampaignIds)];
    logger.info(`Found ${uniqueCampaignIds.length} unique campaigns to process.`);

    const page = await browser.newPage();
    await login(page, logger);

    const results = [];
    for (const campaignId of uniqueCampaignIds) {
      // Check if the admin is allowed to be added to this campaign according to the rules.
      // We pass [adminName] as the list of all selected admins for context.
      const isAllowed = config.canAdminProcessCampaign(adminName, campaignId, [adminName]);

      if (!isAllowed) {
        logger.info(`Skipping campaign ${campaignId}: Admin '${adminName}' is restricted by configuration rules.`);
        results.push({ campaignId, success: true, skipped: true }); // Mark as skipped but successful
        continue;
      }

      const success = await addAdminToCampaign(campaignId, adminName, logger, page);
      results.push({ campaignId, success, skipped: false });
    }

    const allSuccessful = results.every(r => r.success);
    logger.info(`Process to add admin to all campaigns ${allSuccessful ? 'completed successfully' : 'finished with some failures'}.`);
    return allSuccessful;
  } catch (error) {
    logger.error('An unexpected error occurred in addAdminToAllCampaigns:', { error });
    return false;
  } finally {
    if (browser) await browser.close();
  }
}

async function sendToWebhook(adminNames, timeOfDay, logger) {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ admins: adminNames, timeOfDay })
    });
    logger.info('Webhook sent, status:', { status: response.status });
  } catch (error) {
    logger.error('Error sending to webhook:', { error: error.message });
  }
}

async function runParallelCampaigns(browser, adminPayloads, campaignIds, exemptionSettings, logger, batchSize = 5) {
  const results = [];

  for (let i = 0; i < campaignIds.length; i += batchSize) {
    const batch = campaignIds.slice(i, i + batchSize);
    logger.info(`Processing batch of ${batch.length} campaigns...`);
    const allSelectedAdmins = adminPayloads.map(p => p.name);
    const batchPromises = batch.map(async (campaignId) => {
      const page = await browser.newPage();
      try {
        await login(page, logger); // Logger is now correctly passed
        const processingAdmins = config.getAdminsForCampaign(adminPayloads, campaignId, exemptionSettings);
        const result = await processCampaign(page, campaignId, processingAdmins, allSelectedAdmins, logger);
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

async function runAutomation(adminPayloads, timeOfDay, campaignSelections, exemptionSettings = {}, logger) {
  logger.info(`Starting automation for ${timeOfDay} with admin payloads:`, { adminPayloads });
  const browser = await getBrowser(logger);

  try {
    let campaignIds = [];

    if (campaignSelections.regular.selected) {
      campaignIds = campaignIds.concat(config.CAMPAIGN_IDS[timeOfDay] || []);
    }

    const allSelectedAdmins = adminPayloads.map(p => p.name);
    const allResults = [];

    // Process campaigns in batches without complex grouping
    const batchSize = 5;
    for (let i = 0; i < campaignIds.length; i += batchSize) {
      const batch = campaignIds.slice(i, i + batchSize);
      logger.info(`Processing batch of ${batch.length} campaigns...`);

      // The runParallelCampaigns function will internally filter admins for each campaign in the batch.
      // We pass the original adminPayloads so it has the full context for every campaign.
      const results = await runParallelCampaigns(browser, adminPayloads, batch, exemptionSettings, logger, batchSize);
      allResults.push(...results);
      
      // Optional delay between batches
      if (i + batchSize < campaignIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (campaignSelections.regular.selected) {
      await sendToWebhook(allSelectedAdmins, timeOfDay, logger);
    }

    return allResults.every(r => r.success);
  } catch (error) {
    logger.error('Automation process failed:', { error });
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = {
  getBrowser,
  login,
  processCampaign,
  sendToWebhook,
  runParallelCampaigns,
  runAutomation,
  addAdminToCampaign,
  goToCampaignPage,
  cloneField,
  setAdmin,
  saveChanges,
  deleteItems,
  addAdminToAllCampaigns,
};