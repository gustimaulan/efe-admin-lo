const { chromium } = require('playwright-core');
const config = require('../config');
const loggerService = require('./loggerService');

class BrowserService {
    constructor() {
        this.browser = null;
        this.pagePool = new Map();
    }

    async initialize() {
        if (!this.browser) {
            loggerService.info('Initializing browser service...');
            this.browser = await chromium.launch({
                headless: true,
                args: config.BROWSER.ARGS
            });
            loggerService.info('Browser service initialized');
        }
        return this.browser;
    }

    async getPage() {
        await this.initialize();
        const page = await this.browser.newPage();
        return page;
    }

    async login(page) {
        loggerService.info('Initiating login process...');
        await page.goto(config.LOGIN_URL);
        await page.fill("input[name=email]", process.env.EMAIL);
        await page.fill("input[name=password]", process.env.PASSWORD);
        await page.click("button[type=submit]");
        await page.waitForLoadState("networkidle");
        loggerService.info('Login completed successfully');
    }

    async processCampaign(page, campaignId, adminNames, retryCount = 0) {
        const maxRetries = 2;
        
        try {
            loggerService.info(`Processing campaign ${campaignId}...${retryCount > 0 ? `(Retry ${retryCount}/${maxRetries})` : ''}`);
            await page.goto(`${config.CAMPAIGN_BASE_URL}${campaignId}`, { timeout: 30000 });
            await page.waitForLoadState('networkidle', { timeout: 15000 });

            // adminNames is already filtered by getAdminsForCampaign in automationService
            let adminsToProcess = adminNames;
            
            // Log the admins to process for debugging
            loggerService.info(`Admins to process for campaign ${campaignId}:`, adminsToProcess);
            
            // Check for undefined values
            const undefinedAdmins = adminsToProcess.filter((admin, index) => {
                if (admin === undefined || admin === null) {
                    loggerService.error(`Found undefined/null admin at index ${index} in adminsToProcess`);
                    return true;
                }
                return false;
            });
            
            if (undefinedAdmins.length > 0) {
                loggerService.error(`Campaign ${campaignId}: Found ${undefinedAdmins.length} undefined/null admin names, skipping campaign`);
                return false;
            }
            
            if (adminsToProcess.length === 0) {
                loggerService.warn(`No admins left to process campaign ${campaignId} after applying restrictions`);
                return false;
            }

            // Delete existing items with retry mechanism
            loggerService.info(`Deleting ${adminsToProcess.length} existing items...`);
            await this.retryOperation(async () => {
                for (let i = 0; i < adminsToProcess.length; i++) {
                    if (await page.$("button.secondary.op-delete.icon-subtraction.delete")) {
                        await page.click("button.secondary.op-delete.icon-subtraction.delete", { timeout: 5000 });
                        await page.waitForTimeout(500);
                    } else {
                        loggerService.info(`No more items to delete after ${i} deletions`);
                        break;
                    }
                }
            }, `Delete items for campaign ${campaignId}`);

            // Clone admin fields with retry mechanism
            loggerService.info(`Cloning fields for ${adminsToProcess.length} admins...`);
            await this.retryOperation(async () => {
                for (let i = 1; i < adminsToProcess.length; i++) {
                    await page.click("button.secondary.op-clone.icon-addition.clone", { timeout: 5000 });
                    await page.waitForTimeout(500);
                }
            }, `Clone fields for campaign ${campaignId}`);

            // Set admin names with improved error handling
            for (let i = 0; i < adminsToProcess.length; i++) {
                if (!adminsToProcess[i]) {
                    loggerService.error(`Admin name at index ${i} is undefined or null`);
                    continue;
                }
                
                await this.retryOperation(async () => {
                    // Wait for the select2 container to be ready
                    await page.waitForSelector(`#app > form > section > article > div.columns.eight > div:nth-child(2) > div > div:nth-child(${i + 1}) .select2-container`, {
                        timeout: 10000,
                        state: 'visible'
                    });
                    
                    // Click on the select2 arrow to open dropdown
                    await page.click(`#app > form > section > article > div.columns.eight > div:nth-child(2) > div > div:nth-child(${i + 1}) .select2-arrow`, {
                        timeout: 5000,
                        force: true
                    });
                    
                    // Wait for dropdown to be visible
                    await page.waitForSelector('#select2-drop', { timeout: 5000, state: 'visible' });
                    
                    // Type admin name with delay to ensure proper selection
                    await page.keyboard.type(adminsToProcess[i], { delay: 100 });
                    
                    // Wait for results to load
                    await page.waitForTimeout(500);
                    
                    // Press Enter to select
                    await page.keyboard.press("Enter");
                    await page.waitForTimeout(500);
                    
                    // Make sure dropdown is closed after each selection
                    await page.keyboard.press("Escape");
                    
                    // Wait for dropdown to be completely closed
                    await page.waitForFunction(() => !document.getElementById('select2-drop') || document.getElementById('select2-drop').style.display === 'none', {
                        timeout: 3000
                    });
                    
                    await page.waitForTimeout(300);
                }, `Set admin ${adminsToProcess[i]} at position ${i + 1}`);
            }

            // Close any open select2 dropdowns before saving
            await page.keyboard.press("Escape");
            await page.waitForTimeout(500);
            
            // Handle select2-drop-mask that might be intercepting clicks
            try {
                // Check if select2-drop-mask exists and remove it
                const dropMask = await page.$("#select2-drop-mask");
                if (dropMask) {
                    await page.evaluate(() => {
                        const mask = document.getElementById('select2-drop-mask');
                        if (mask) mask.remove();
                    });
                    loggerService.info('Removed select2-drop-mask element');
                    await page.waitForTimeout(300);
                }
            } catch (error) {
                loggerService.warn(`Failed to remove select2-drop-mask: ${error.message}`);
            }
            
            // Try multiple methods to click the Save button with increased timeout
            let saveClicked = false;
            const saveMethods = [
                // Method 1: Direct selector with force
                async () => {
                    await page.click("#app > form > section > article > div.columns.four > div.card.has-sections > div.card-section.secondary.align-right > small > button:nth-child(2)", {
                        timeout: 10000,
                        force: true
                    });
                },
                // Method 2: By text content with force
                async () => {
                    await page.click("button:has-text('Save')", { timeout: 10000, force: true });
                },
                // Method 3: JavaScript click
                async () => {
                    await page.evaluate(() => {
                        const buttons = document.querySelectorAll('button[type="submit"]');
                        for (const button of buttons) {
                            if (button.textContent.includes('Save')) {
                                button.click();
                                return true;
                            }
                        }
                        return false;
                    });
                },
                // Method 4: Wait for mask to disappear and try again
                async () => {
                    await page.waitForFunction(() => !document.getElementById('select2-drop-mask'), { timeout: 5000 });
                    await page.click("button:has-text('Save')", { timeout: 10000 });
                }
            ];
            
            for (let i = 0; i < saveMethods.length; i++) {
                try {
                    loggerService.info(`Attempting save method ${i + 1}`);
                    await saveMethods[i]();
                    saveClicked = true;
                    loggerService.info(`Save successful using method ${i + 1}`);
                    break;
                } catch (error) {
                    loggerService.warn(`Save method ${i + 1} failed: ${error.message}`);
                    if (i < saveMethods.length - 1) {
                        await page.waitForTimeout(1000); // Wait before retrying
                    }
                }
            }
            
            if (!saveClicked) {
                throw new Error('All save methods failed');
            }
            
            loggerService.info(`Campaign ${campaignId} processed successfully with admins: ${adminsToProcess.join(', ')}`);
            return true;
        } catch (error) {
            loggerService.error(`Campaign ${campaignId} processing failed: ${error.message}`);
            
            // Retry logic
            if (retryCount < maxRetries && this.shouldRetry(error)) {
                loggerService.info(`Retrying campaign ${campaignId} processing... (${retryCount + 1}/${maxRetries})`);
                await page.waitForTimeout(2000); // Wait before retry
                return this.processCampaign(page, campaignId, adminNames, retryCount + 1);
            }
            
            return false;
        }
    }

    /**
     * Retry an operation with exponential backoff
     * @param {Function} operation - The operation to retry
     * @param {string} operationName - Name of the operation for logging
     * @param {number} maxRetries - Maximum number of retries
     */
    async retryOperation(operation, operationName, maxRetries = 2) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await operation();
                return;
            } catch (error) {
                if (attempt === maxRetries) {
                    throw new Error(`${operationName} failed after ${maxRetries + 1} attempts: ${error.message}`);
                }
                
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                loggerService.warn(`${operationName} attempt ${attempt + 1} failed, retrying in ${delay}ms: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Determine if an error should trigger a retry
     * @param {Error} error - The error to check
     * @returns {boolean} - Whether to retry
     */
    shouldRetry(error) {
        const retryableErrors = [
            'Timeout',
            'Network error',
            'Connection closed',
            'select2-drop-mask',
            'Target closed'
        ];
        
        return retryableErrors.some(retryableError =>
            error.message.includes(retryableError)
        );
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            loggerService.info('Browser service cleaned up');
        }
    }
}

module.exports = new BrowserService();