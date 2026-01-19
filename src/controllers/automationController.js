const automationService = require('../services/automationService');
const historyService = require('../services/historyService');

const config = require('../config');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Get configuration endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getConfig = asyncHandler(async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                ALLOWED_ADMIN_NAMES: config.ALLOWED_ADMIN_NAMES,
                CAMPAIGN_IDS: config.CAMPAIGN_IDS,
                SPECIAL_CAMPAIGN: config.SPECIAL_CAMPAIGN,
                activeEnv: config.activeEnv,
                env: config.env
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get configuration',
                details: error.message
            }
        });
    }
});

/**
 * Check processing plan endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const checkPlan = asyncHandler(async (req, res) => {
    const { adminPayloads, timeOfDay, exemptionSettings } = req;

    try {
        const plan = automationService.generateProcessingPlan(adminPayloads, timeOfDay, exemptionSettings);

        res.json({
            success: true,
            message: 'Processing plan generated successfully.',
            data: { plan }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to generate processing plan',
                details: error.message
            }
        });
    }
});

/**
 * Run automation endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const runAutomation = asyncHandler(async (req, res) => {
    const { adminPayloads, timeOfDay, campaignSelections, exemptionSettings, browserType } = req;

    try {
        const result = await automationService.runAutomation(
            adminPayloads,
            timeOfDay,
            campaignSelections,
            exemptionSettings,
            browserType
        );

        res.json({
            success: true,
            message: 'Automation started',
            data: {
                jobId: result.jobId,
                status: 'running'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to start automation',
                details: error.message
            }
        });
    }
});

/**
 * Get job status endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getJobStatus = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    try {
        const jobStatus = automationService.getJobStatus(jobId);

        if (!jobStatus) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Job not found'
                }
            });
        }

        res.json({
            success: true,
            data: jobStatus
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get job status',
                details: error.message
            }
        });
    }
});

/**
 * Get admin restrictions endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAdminRestrictions = asyncHandler(async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                message: "Admin restrictions are now handled through dynamic payload rules. Each admin can have include/exclude rules for specific campaigns.",
                supportedRuleTypes: ["include", "exclude", "null (all campaigns)"],
                nullRuleBehavior: "When ruleType and campaignId are null, admin can process all campaigns",
                rules: config.RULES,
                specialCampaign: config.SPECIAL_CAMPAIGN
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get admin restrictions',
                details: error.message
            }
        });
    }
});

/**
 * Get application version endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getVersion = asyncHandler(async (req, res) => {
    try {
        const packageJson = require('../../../package.json');

        res.json({
            success: true,
            data: {
                version: packageJson.version,
                name: packageJson.name,
                timestamp: new Date().toISOString(),
                environment: config.env,
                activeEnv: config.activeEnv
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get version information',
                details: error.message
            }
        });
    }
});

/**
 * Health check endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const healthCheck = asyncHandler(async (req, res) => {
    try {
        const health = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: config.env,
            activeEnv: config.activeEnv,
            version: require('../../../package.json').version
        };

        // Check if browser service is available
        try {
            const campaignService = require('../services/campaignService');
            const browser = await campaignService.getBrowser();
            if (browser && browser.isConnected()) {
                health.browser = 'connected';
            } else {
                health.browser = 'disconnected';
            }
        } catch (error) {
            health.browser = 'error';
        }

        res.json({
            success: true,
            data: health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Health check failed',
                details: error.message
            }
        });
    }
});

/**
 * Cancel job endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const cancelJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    try {
        const jobStatus = automationService.getJobStatus(jobId);

        if (!jobStatus) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Job not found'
                }
            });
        }

        if (jobStatus.status === 'completed' || jobStatus.status === 'error') {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Cannot cancel completed job'
                }
            });
        }

        automationService.updateJobStatus(jobId, {
            status: 'cancelled',
            message: 'Job cancelled by user',
            endTime: new Date()
        });

        res.json({
            success: true,
            message: 'Job cancelled successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to cancel job',
                details: error.message
            }
        });
    }
});

/**
 * Get all running jobs endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getRunningJobs = asyncHandler(async (req, res) => {
    try {
        const jobs = Array.from(automationService.runningJobs.entries()).map(([jobId, job]) => ({
            jobId,
            ...job
        }));

        res.json({
            success: true,
            data: {
                jobs,
                count: jobs.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get running jobs',
                details: error.message
            }
        });
    }
});

/**
 * Get history endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getHistory = asyncHandler(async (req, res) => {
    try {
        const history = historyService.getHistory(5);
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get history',
                details: error.message
            }
        });
    }
});

module.exports = {
    getConfig,
    checkPlan,
    runAutomation,
    getJobStatus,
    getAdminRestrictions,
    getVersion,
    healthCheck,
    cancelJob,
    getRunningJobs,
    getHistory
};