const { chromium } = require('playwright-core');
const config = require('../config');
const logger = require('./logger');

class BrowserService {
    constructor() {
        this.browser = null;
        this.pagePool = new Map();
    }

    async initialize() {
        if (!this.browser) {
            logger.info('Initializing browser service...');
            this.browser = await chromium.launch({
                headless: true,
                args: config.BROWSER.ARGS
            });
            logger.info('Browser service initialized');
        }
        return this.browser;
    }

    async getPage() {
        await this.initialize();
        const page = await this.browser.newPage();
        return page;
    }

    async login(page) {
        logger.info('Initiating login process...');
        await page.goto(config.LOGIN_URL);
        await page.fill("input[name=email]", process.env.EMAIL);
        await page.fill("input[name=password]", process.env.PASSWORD);
        await page.click("button[type=submit]");
        await page.waitForLoadState("networkidle");
        logger.info('Login completed successfully');
    }

    async processCampaign(page, campaignId, adminNames) {
        try {
            logger.info(`Processing campaign ${campaignId}...`);
            await page.goto(`${config.CAMPAIGN_BASE_URL}${campaignId}`);
            await page.waitForLoadState('networkidle');

            // Special handling for campaign 247001
            let adminsToProcess = [...adminNames];
            if (campaignId === 247001) {
                adminsToProcess = adminNames.filter(admin => 
                    admin !== "admin 1" && admin !== "admin 2"
                );
                logger.info(`Campaign 247001: Excluding admin 1 and admin 2. Processing with admins: ${adminsToProcess.join(', ')}`);
                
                if (adminsToProcess.length === 0) {
                    logger.warn('No admins left to process after filtering for campaign 247001');
                    return false;
                }
            }

            // Delete existing items
            logger.info(`Deleting ${adminsToProcess.length} existing items...`);
            for (let i = 0; i < adminsToProcess.length; i++) {
                if (await page.$("button.secondary.op-delete.icon-subtraction.delete")) {
                    await page.click("button.secondary.op-delete.icon-subtraction.delete");
                    await page.waitForTimeout(500);
                } else {
                    logger.info(`No more items to delete after ${i} deletions`);
                    break;
                }
            }

            // Clone admin fields
            logger.info(`Cloning fields for ${adminsToProcess.length} admins...`);
            for (let i = 1; i < adminsToProcess.length; i++) {
                await page.click("button.secondary.op-clone.icon-addition.clone");
                await page.waitForTimeout(500);
            }

            // Set admin names
            for (let i = 0; i < adminsToProcess.length; i++) {
                await page.click(`#app > form > section > article > div.columns.eight > div:nth-child(2) > div > div:nth-child(${i + 1}) .select2-arrow`);
                await page.keyboard.type(adminsToProcess[i]);
                await page.keyboard.press("Enter");
                await page.waitForTimeout(300);
            }

            // Save changes
            await page.click("#app > form > section > article > div.columns.four > div.card.has-sections > div.card-section.secondary.align-right > small > button:nth-child(2)");
            logger.info(`Campaign ${campaignId} processed successfully with admins: ${adminsToProcess.join(', ')}`);
            return true;
        } catch (error) {
            logger.error(`Campaign ${campaignId} processing failed: ${error.message}`);
            return false;
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            logger.info('Browser service cleaned up');
        }
    }
}

module.exports = new BrowserService(); 