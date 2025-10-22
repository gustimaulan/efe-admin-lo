const crypto = require('crypto');

/**
 * Generate a random string
 * @param {number} length - Length of the string
 * @returns {string} - Random string
 */
const generateRandomString = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
const deepMerge = (target, source) => {
    const output = { ...target };
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
};

/**
 * Check if value is an object
 * @param {*} item - Item to check
 * @returns {boolean} - True if object
 */
const isObject = (item) => {
    return (item && typeof item === 'object' && !Array.isArray(item));
};

/**
 * Delay execution for specified milliseconds
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves with function result
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                throw lastError;
            }
            
            const delayMs = baseDelay * Math.pow(2, attempt);
            await delay(delayMs);
        }
    }
    
    throw lastError;
};

/**
 * Format bytes to human readable string
 * @param {number} bytes - Bytes to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} - Formatted string
 */
const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Format uptime to human readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string} - Formatted uptime string
 */
const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
};

/**
 * Sanitize string for logging
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeForLogging = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove sensitive information like passwords, tokens, etc.
    return str
        .replace(/password["\s]*[:=]["\s]*[^"\\s]+/gi, 'password: [REDACTED]')
        .replace(/token["\s]*[:=]["\s]*[^"\\s]+/gi, 'token: [REDACTED]')
        .replace(/secret["\s]*[:=]["\s]*[^"\\s]+/gi, 'secret: [REDACTED]')
        .replace(/key["\s]*[:=]["\s]*[^"\\s]+/gi, 'key: [REDACTED]');
};

/**
 * Extract admin names from request body
 * @param {Object} body - Request body
 * @returns {Array} - Array of admin names
 */
const extractAdminNames = (body) => {
    const adminNames = [];
    
    for (const key in body) {
        if (/^admin\d+$/.test(key)) {
            const adminName = body[key];
            if (adminName && typeof adminName === 'string' && adminName.trim()) {
                adminNames.push(adminName.trim());
            }
        }
    }
    
    return adminNames;
};

/**
 * Validate admin names against allowed list
 * @param {Array} adminNames - Array of admin names
 * @param {Array} allowedAdmins - Array of allowed admin names
 * @returns {Object} - Validation result with valid and invalid names
 */
const validateAdminNames = (adminNames, allowedAdmins) => {
    const valid = [];
    const invalid = [];
    
    adminNames.forEach(name => {
        if (allowedAdmins.includes(name)) {
            valid.push(name);
        } else {
            invalid.push(name);
        }
    });
    
    return { valid, invalid };
};

/**
 * Generate correlation ID for request tracking
 * @returns {string} - Correlation ID
 */
const generateCorrelationId = () => {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Check if a string is a valid campaign ID
 * @param {string|number} campaignId - Campaign ID to validate
 * @returns {boolean} - True if valid
 */
const isValidCampaignId = (campaignId) => {
    const id = parseInt(campaignId);
    return !isNaN(id) && id > 0 && id < 999999;
};

/**
 * Parse user agent string
 * @param {string} userAgent - User agent string
 * @returns {Object} - Parsed user agent info
 */
const parseUserAgent = (userAgent) => {
    const ua = userAgent || '';
    
    const browser = ua.includes('Chrome') ? 'Chrome' :
                   ua.includes('Firefox') ? 'Firefox' :
                   ua.includes('Safari') ? 'Safari' :
                   ua.includes('Edge') ? 'Edge' : 'Unknown';
    
    const os = ua.includes('Windows') ? 'Windows' :
               ua.includes('Mac') ? 'macOS' :
               ua.includes('Linux') ? 'Linux' :
               ua.includes('Android') ? 'Android' :
               ua.includes('iOS') ? 'iOS' : 'Unknown';
    
    return {
        browser,
        os,
        raw: ua
    };
};

/**
 * Create a safe JSON string parser
 * @param {string} str - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} - Parsed object or default value
 */
const safeJsonParse = (str, defaultValue = null) => {
    try {
        return JSON.parse(str);
    } catch (error) {
        return defaultValue;
    }
};

/**
 * Truncate string to specified length
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add if truncated
 * @returns {string} - Truncated string
 */
const truncateString = (str, maxLength = 100, suffix = '...') => {
    if (typeof str !== 'string') return str;
    
    if (str.length <= maxLength) return str;
    
    return str.slice(0, maxLength - suffix.length) + suffix;
};

module.exports = {
    generateRandomString,
    deepMerge,
    isObject,
    delay,
    retryWithBackoff,
    formatBytes,
    formatUptime,
    sanitizeForLogging,
    extractAdminNames,
    validateAdminNames,
    generateCorrelationId,
    isValidCampaignId,
    parseUserAgent,
    safeJsonParse,
    truncateString
};