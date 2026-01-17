const config = require('../config');
const loggerService = require('./loggerService');
const campaignService = require('./campaignService');

class AutomationService {
    constructor() {
        this.runningJobs = new Map();
    }

    /**
     * Run automation for selected admins and campaigns
     * @param {Array} adminPayloads - Array of admin objects with name and rules
     * @param {string} timeOfDay - Time period (pagi, siang, malam, manual)
     * @param {Object} campaignSelections - Campaign selection settings
     * @param {Object} exemptionSettings - Exemption settings
     * @returns {Promise<Object>} - Job result
     */
    async runAutomation(adminPayloads, timeOfDay, campaignSelections, exemptionSettings = {}) {
        const jobId = Date.now().toString();

        loggerService.info(`Starting automation for ${timeOfDay} with admin payloads:`, adminPayloads);

        // Initialize job tracking
        this.runningJobs.set(jobId, {
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

        try {
            let campaignIds = [];

            if (campaignSelections.regular.selected) {
                campaignIds = campaignIds.concat(config.CAMPAIGN_IDS[timeOfDay] || []);
            }

            const campaignGroups = {};
            const allSelectedAdmins = adminPayloads.map(p => p.name);

            // Group campaigns by admin combinations
            for (const campaignId of campaignIds) {
                const payloadsForThisCampaign = adminPayloads.filter(payload =>
                    config.canAdminProcessCampaign(payload.name, campaignId, allSelectedAdmins, exemptionSettings)
                );
                const adminNamesForThisCampaign = payloadsForThisCampaign.map(p => p.name);

                if (adminNamesForThisCampaign.length !== adminPayloads.length) {
                    const excludedAdmins = allSelectedAdmins.filter(name => !adminNamesForThisCampaign.includes(name));
                    loggerService.info(`🔍 Campaign ${campaignId} restrictions: Excluded admins: [${excludedAdmins.join(', ')}] -> Processing with: [${adminNamesForThisCampaign.join(', ')}]`);
                }

                if (payloadsForThisCampaign.length === 0) {
                    const logMessage = `Skipping campaign ${campaignId} as no admins are available to process it after applying rules.`;
                    loggerService.info(logMessage);
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

            // Process each group
            for (const groupKey in campaignGroups) {
                const group = campaignGroups[groupKey];
                loggerService.info(`Processing group for admins: ${group.admins.join(', ')} with ${group.campaigns.length} campaigns`);

                const groupPayloads = adminPayloads.filter(p => group.admins.includes(p.name));
                const results = await this.runParallelCampaigns(groupPayloads, group.campaigns);
                allResults.push(...results);
            }

            if (campaignSelections.regular.selected) {
                await this.sendToWebhook(allSelectedAdmins, timeOfDay);
            }

            const success = allResults.every(r => r.success);
            const finalMessage = `Automation ${success ? 'completed' : 'failed'}.`;

            this.updateJobStatus(jobId, {
                status: success ? 'completed' : 'error',
                success,
                message: finalMessage,
                endTime: new Date()
            });

            // Schedule job cleanup
            setTimeout(() => {
                this.runningJobs.delete(jobId);
            }, config.JOB.CLEANUP_TIMEOUT);

            return { jobId, success, message: finalMessage };

        } catch (error) {
            loggerService.error('Automation process failed:', error);
            const finalMessage = `Automation failed: ${error.message}.`;

            this.updateJobStatus(jobId, {
                status: 'error',
                message: error.message,
                endTime: new Date()
            });

            setTimeout(() => {
                this.runningJobs.delete(jobId);
            }, config.JOB.CLEANUP_TIMEOUT);

            throw error;
        }
    }

    /**
     * Run campaigns in parallel batches
     * @param {Array} adminPayloads - Admin payloads
     * @param {Array} campaignIds - Campaign IDs to process
     * @param {number} batchSize - Batch size for parallel processing
     * @returns {Promise<Array>} - Results array
     */
    async runParallelCampaigns(adminPayloads, campaignIds, batchSize = 2) {
        const results = [];
        const sortedAdminPayloads = [...adminPayloads].sort((a, b) => a.name.localeCompare(b.name));
        const numWorkers = config.JOB.MAX_CONCURRENT_WORKERS || 3;

        // Split campaignIds into chunks for each worker
        const chunks = [];
        for (let i = 0; i < numWorkers; i++) {
            chunks.push([]);
        }

        campaignIds.forEach((id, index) => {
            chunks[index % numWorkers].push(id);
        });

        loggerService.info(`Starting execution with ${numWorkers} parallel workers...`);

        const worker = async (workerId, campaigns) => {
            if (campaigns.length === 0) return;

            loggerService.info(`Worker ${workerId} starting with ${campaigns.length} campaigns`);
            let page = null;

            try {
                await campaignService.initialize();
                page = await campaignService.getPage();

                loggerService.info(`Worker ${workerId} performing login...`);
                await campaignService.login(page);

                for (const campaignId of campaigns) {
                    try {
                        loggerService.info(`Worker ${workerId}: Processing campaign ${campaignId}`);
                        const processingAdmins = config.getAdminsForCampaign(sortedAdminPayloads, campaignId);

                        const result = await campaignService.processCampaign(page, campaignId, processingAdmins);
                        results.push({ campaignId, success: result, workerId });

                        // Small delay between campaigns for stability
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        loggerService.error(`Worker ${workerId}: Campaign ${campaignId} failed:`, error.message);
                        results.push({ campaignId, success: false, error: error.message, workerId });

                        if (error.message.includes('Target closed') || error.message.includes('context was destroyed')) {
                            loggerService.warn(`Worker ${workerId}: Session lost, attempting re-init...`);
                            try { await page.close(); } catch (e) { }
                            page = await campaignService.getPage();
                            await campaignService.login(page);
                        }
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            } catch (workerError) {
                loggerService.error(`Worker ${workerId} critical failure:`, workerError.message);
                campaigns.forEach(id => {
                    if (!results.find(r => r.campaignId === id)) {
                        results.push({ campaignId: id, success: false, error: 'Worker failure', workerId });
                    }
                });
            } finally {
                if (page) {
                    try {
                        await page.close();
                        loggerService.info(`Worker ${workerId} session closed`);
                    } catch (e) { }
                }
            }
        };

        // Run workers in parallel
        await Promise.all(chunks.map((chunk, index) => worker(index + 1, chunk)));

        return results;
    }

    /**
     * Send webhook notification
     * @param {Array} adminNames - Admin names
     * @param {string} timeOfDay - Time period
     */
    async sendToWebhook(adminNames, timeOfDay) {
        try {
            const webhookUrl = process.env.WEBHOOK_URL;
            if (!webhookUrl) {
                loggerService.warn('Webhook URL not configured, skipping webhook notification');
                return;
            }

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ admins: adminNames, timeOfDay })
            });
            loggerService.info('Webhook sent, status:', response.status);
        } catch (error) {
            loggerService.error('Error sending to webhook:', error.message);
        }
    }

    /**
     * Get job status by ID
     * @param {string} jobId - Job ID
     * @returns {Object|null} - Job status or null if not found
     */
    getJobStatus(jobId) {
        return this.runningJobs.get(jobId) || null;
    }

    /**
     * Update job status
     * @param {string} jobId - Job ID
     * @param {Object} updates - Status updates
     */
    updateJobStatus(jobId, updates) {
        if (!this.runningJobs.has(jobId)) return;

        const job = this.runningJobs.get(jobId);
        if (!job.logs) job.logs = [];

        const logEntry = {
            timestamp: new Date(),
            message: updates.message || 'Status updated',
            isError: updates.status === 'error'
        };

        job.logs.push(logEntry);
        Object.assign(job, updates);
        this.runningJobs.set(jobId, job);
    }

    /**
     * Add log entry to job
     * @param {string} jobId - Job ID
     * @param {string} message - Log message
     * @param {boolean} isError - Whether this is an error message
     */
    addJobLog(jobId, message, isError = false) {
        if (!this.runningJobs.has(jobId)) return;

        const job = this.runningJobs.get(jobId);
        if (!job.logs) job.logs = [];

        const logEntry = { timestamp: new Date(), message, isError };
        job.logs.push(logEntry);
        this.runningJobs.set(jobId, job);
    }

    /**
     * Generate processing plan without executing
     * @param {Array} adminPayloads - Admin payloads
     * @param {string} timeOfDay - Time period
     * @param {Object} exemptionSettings - Exemption settings
     * @returns {Array} - Processing plan
     */
    generateProcessingPlan(adminPayloads, timeOfDay, exemptionSettings = {}) {
        const plan = [];
        const campaignIds = config.CAMPAIGN_IDS[timeOfDay] || [];
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

        return plan;
    }
}

module.exports = new AutomationService();