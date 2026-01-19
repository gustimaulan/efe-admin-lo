const config = require('../config');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validate admin payloads from request body
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateAdminPayloads = (req, res, next) => {
    try {
        req.adminPayloads = [];

        for (const key in req.body) {
            if (/^admin\d+$/.test(key)) {
                const adminName = req.body[key];
                if (adminName && adminName.trim()) {
                    req.adminPayloads.push({ name: adminName.trim() });
                }
            }
        }

        // Validate that we have at least one admin
        if (req.adminPayloads.length === 0) {
            throw new AppError('At least one admin must be selected', 400);
        }

        // Validate admin names against allowed list
        const allAdminsValid = req.adminPayloads.every(payload =>
            config.ALLOWED_ADMIN_NAMES.includes(payload.name)
        );

        if (!allAdminsValid) {
            throw new AppError('One or more admin names are not allowed', 400);
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Validate time of day parameter
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateTimeOfDay = (req, res, next) => {
    try {
        const timeOfDay = req.body.timeOfDay || "manual";
        const validTimes = ["pagi", "siang", "malam", "manual"];

        if (!validTimes.includes(timeOfDay)) {
            throw new AppError('Invalid time of day. Must be one of: pagi, siang, malam, manual', 400);
        }

        req.timeOfDay = timeOfDay;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Validate campaign selections
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateCampaignSelections = (req, res, next) => {
    try {
        const isManualRequest = req.body.isManual === 'true';
        const timeOfDay = req.body.timeOfDay || "manual";

        let campaignSelections;

        if (isManualRequest) {
            campaignSelections = {
                regular: {
                    selected: req.body.regularCampaigns === 'true',
                    time: 'manual'
                }
            };
        } else {
            campaignSelections = {
                regular: {
                    selected: ['pagi', 'siang', 'malam'].includes(timeOfDay),
                    time: timeOfDay
                }
            };
        }

        req.campaignSelections = campaignSelections;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Validate exemption settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateExemptionSettings = (req, res, next) => {
    try {
        const exemptionSettings = {
            exemptAdmin: req.body.exemptAdmin || null
        };

        // If exemptAdmin is provided, validate it's in the allowed list
        if (exemptionSettings.exemptAdmin &&
            !config.ALLOWED_ADMIN_NAMES.includes(exemptionSettings.exemptAdmin)) {
            throw new AppError('Exempt admin is not in the allowed admin list', 400);
        }

        req.exemptionSettings = exemptionSettings;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Validate browser selection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateBrowserSelection = (req, res, next) => {
    try {
        const browserType = req.body.browserType || 'local';
        const validTypes = ['local', 'remote'];

        if (!validTypes.includes(browserType)) {
            throw new AppError('Invalid browser type. Must be one of: local, remote', 400);
        }

        req.browserType = browserType;
        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Generic validation middleware factory
 * @param {Function} validator - Validation function
 * @returns {Function} - Express middleware
 */
const validate = (validator) => {
    return (req, res, next) => {
        try {
            const result = validator(req.body);
            if (result.error) {
                throw new AppError(result.error.details[0].message, 400);
            }
            req.validatedData = result.value;
            next();
        } catch (error) {
            next(error);
        }
    };
};

/**
 * Request body sanitizer
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const sanitizeBody = (req, res, next) => {
    try {
        // Remove potentially dangerous HTML/JS from string fields
        const sanitizeString = (str) => {
            if (typeof str !== 'string') return str;
            return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<[^>]*>/g, '')
                .trim();
        };

        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeString(req.body[key]);
            }
        }

        next();
    } catch (error) {
        next(error);
    }
};

/**
 * Rate limiting validation
 * @param {number} maxRequests - Maximum requests per window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} - Express middleware
 */
const createRateLimit = (maxRequests = 10, windowMs = 60000) => {
    const requests = new Map();

    return (req, res, next) => {
        const clientId = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old entries
        for (const [id, timestamps] of requests.entries()) {
            const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
            if (validTimestamps.length === 0) {
                requests.delete(id);
            } else {
                requests.set(id, validTimestamps);
            }
        }

        // Check current client
        const clientRequests = requests.get(clientId) || [];
        const recentRequests = clientRequests.filter(timestamp => timestamp > windowStart);

        if (recentRequests.length >= maxRequests) {
            throw new AppError('Too many requests. Please try again later.', 429);
        }

        recentRequests.push(now);
        requests.set(clientId, recentRequests);

        next();
    };
};

module.exports = {
    AppError,
    validateAdminPayloads,
    validateTimeOfDay,
    validateCampaignSelections,
    validateExemptionSettings,
    validateBrowserSelection,
    validate,
    sanitizeBody,
    createRateLimit
};