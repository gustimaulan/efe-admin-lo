const express = require('express');
const router = express.Router();

// Import controllers
const automationController = require('../controllers/automationController');

// Import middleware
const {
    validateAdminPayloads,
    validateTimeOfDay,
    validateCampaignSelections,
    validateExemptionSettings,
    validateBrowserSelection,
    sanitizeBody,
    createRateLimit
} = require('../middleware/validation');

const {
    asyncHandler,
    rateLimitErrorHandler
} = require('../middleware/errorHandler');

// Apply rate limiting to all routes
router.use(createRateLimit(60, 60000)); // 60 requests per minute
router.use(rateLimitErrorHandler);

// Apply body sanitization to all routes
router.use(sanitizeBody);

/**
 * @route   GET /api/config
 * @desc    Get application configuration
 * @access  Public
 */
router.get('/config', asyncHandler(automationController.getConfig));

/**
 * @route   GET /api/admin-restrictions
 * @desc    Get admin restriction rules
 * @access  Public
 */
router.get('/admin-restrictions', asyncHandler(automationController.getAdminRestrictions));

/**
 * @route   GET /api/version
 * @desc    Get application version
 * @access  Public
 */
router.get('/version', asyncHandler(automationController.getVersion));

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/health', asyncHandler(automationController.healthCheck));

/**
 * @route   GET /api/jobs
 * @desc    Get all running jobs
 * @access  Public
 */
router.get('/jobs', asyncHandler(automationController.getRunningJobs));

/**
 * @route   GET /api/jobs/:jobId
 * @desc    Get job status by ID
 * @access  Public
 */
router.get('/jobs/:jobId', asyncHandler(automationController.getJobStatus));

/**
 * @route   DELETE /api/jobs/:jobId
 * @desc    Cancel a running job
 * @access  Public
 */
router.delete('/jobs/:jobId', asyncHandler(automationController.cancelJob));

/**
 * @route   POST /api/check-plan
 * @desc    Generate processing plan without executing
 * @access  Public
 * @middleware validateAdminPayloads, validateTimeOfDay, validateExemptionSettings
 */
router.post('/check-plan',
    validateAdminPayloads,
    validateTimeOfDay,
    validateExemptionSettings,
    asyncHandler(automationController.checkPlan)
);

/**
 * @route   POST /api/run
 * @desc    Run automation process
 * @access  Public
 * @middleware validateAdminPayloads, validateTimeOfDay, validateCampaignSelections, validateExemptionSettings
 */
router.post('/run',
    validateAdminPayloads,
    validateTimeOfDay,
    validateCampaignSelections,
    validateExemptionSettings,
    validateBrowserSelection,
    asyncHandler(automationController.runAutomation)
);

/**
 * Error handling middleware for this router
 */
router.use((err, req, res, next) => {
    console.error('API Route Error:', err);

    // If response already sent, delegate to default error handler
    if (res.headersSent) {
        return next(err);
    }

    res.status(err.statusCode || 500).json({
        success: false,
        error: {
            message: err.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && {
                stack: err.stack,
                details: err.details
            })
        }
    });
});

/**
 * 404 handler for this router
 */
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            message: `Route ${req.originalUrl} not found`,
            method: req.method
        }
    });
});

module.exports = router;