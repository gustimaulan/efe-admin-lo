/**
 * Application constants
 */

// HTTP Status Codes
const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
};

// Job Status
const JOB_STATUS = {
    PENDING: 'pending',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'error',
    CANCELLED: 'cancelled'
};

// Time of Day Options
const TIME_OF_DAY = {
    PAGI: 'pagi',
    SIANG: 'siang',
    MALAM: 'malam',
    MANUAL: 'manual'
};

// Admin Rule Types
const ADMIN_RULE_TYPES = {
    INCLUDE: 'include',
    EXCLUDE: 'exclude',
    ALL: null
};

// Campaign Processing Constants
const CAMPAIGN_PROCESSING = {
    BATCH_SIZE: 3,
    BATCH_DELAY: 1000,
    DELETE_TIMEOUT: 500,
    CLONE_TIMEOUT: 500,
    INPUT_TIMEOUT: 300,
    MAX_RETRIES: 3,
    BASE_RETRY_DELAY: 1000
};

// Browser Configuration
const BROWSER_CONFIG = {
    DEFAULT_TIMEOUT: 30000,
    NAVIGATION_TIMEOUT: 60000,
    ACTION_TIMEOUT: 10000,
    WAIT_FOR_SELECTOR_TIMEOUT: 5000
};

// Rate Limiting
const RATE_LIMIT = {
    DEFAULT_REQUESTS: 10,
    DEFAULT_WINDOW_MS: 60000, // 1 minute
    STRICT_REQUESTS: 5,
    STRICT_WINDOW_MS: 60000,
    LOOSE_REQUESTS: 20,
    LOOSE_WINDOW_MS: 60000
};

// Job Cleanup
const JOB_CLEANUP = {
    DEFAULT_TIMEOUT: 3600000, // 1 hour
    EXTENDED_TIMEOUT: 7200000, // 2 hours
    SHORT_TIMEOUT: 1800000 // 30 minutes
};

// Log Levels
const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
};

// Socket Events
const SOCKET_EVENTS = {
    CONNECTION: 'connection',
    DISCONNECT: 'disconnect',
    SUBSCRIBE_TO_JOB: 'subscribeToJob',
    CONSOLE_LOGS: 'console_logs',
    NEW_LOG: 'newLog'
};

// Validation Messages
const VALIDATION_MESSAGES = {
    INVALID_ADMIN_NAME: 'Invalid admin name provided',
    NO_ADMINS_SELECTED: 'At least one admin must be selected',
    INVALID_TIME_OF_DAY: 'Invalid time of day specified',
    INVALID_CAMPAIGN_ID: 'Invalid campaign ID provided',
    JOB_NOT_FOUND: 'Job not found',
    JOB_ALREADY_COMPLETED: 'Job has already been completed',
    INVALID_RULE_TYPE: 'Invalid rule type specified',
    MISSING_REQUIRED_FIELD: 'Required field is missing',
    INVALID_REQUEST_FORMAT: 'Invalid request format'
};

// Error Messages
const ERROR_MESSAGES = {
    AUTOMATION_FAILED: 'Automation process failed',
    BROWSER_LAUNCH_FAILED: 'Failed to launch browser',
    LOGIN_FAILED: 'Login failed',
    CAMPAIGN_PROCESSING_FAILED: 'Campaign processing failed',
    WEBHOOK_SEND_FAILED: 'Failed to send webhook notification',
    CONFIGURATION_ERROR: 'Configuration error',
    NETWORK_ERROR: 'Network connection error',
    TIMEOUT_ERROR: 'Operation timed out',
    VALIDATION_ERROR: 'Validation failed',
    INTERNAL_ERROR: 'Internal server error'
};

// Success Messages
const SUCCESS_MESSAGES = {
    AUTOMATION_STARTED: 'Automation started successfully',
    AUTOMATION_COMPLETED: 'Automation completed successfully',
    JOB_CANCELLED: 'Job cancelled successfully',
    CONFIGURATION_UPDATED: 'Configuration updated successfully',
    BROWSER_INITIALIZED: 'Browser service initialized successfully'
};

// Regular Expressions
const REGEX = {
    ADMIN_FIELD: /^admin\d+$/,
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    CAMPAIGN_ID: /^\d+$/,
    JOB_ID: /^\d+$/,
    CORRELATION_ID: /^corr_\d+_[a-z0-9]+$/i
};

// Environment Variables
const ENV_VARS = {
    NODE_ENV: 'NODE_ENV',
    PORT: 'PORT',
    EMAIL: 'EMAIL',
    PASSWORD: 'PASSWORD',
    WEBHOOK_URL: 'WEBHOOK_URL',
    LOG_LEVEL: 'LOG_LEVEL'
};

// Default Values
const DEFAULTS = {
    PORT: 3010,
    LOG_LEVEL: 'info',
    TIME_OF_DAY: 'manual',
    BATCH_SIZE: 3,
    MAX_RETRIES: 3,
    TIMEOUT: 60000
};

// Response Templates
const RESPONSE_TEMPLATES = {
    SUCCESS: (data, message = 'Operation successful') => ({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString()
    }),
    
    ERROR: (message, statusCode = 500, details = null) => ({
        success: false,
        error: {
            message,
            statusCode,
            details,
            timestamp: new Date().toISOString()
        }
    }),
    
    VALIDATION_ERROR: (errors, message = 'Validation failed') => ({
        success: false,
        error: {
            message,
            errors,
            type: 'validation',
            timestamp: new Date().toISOString()
        }
    })
};

// Headers
const HEADERS = {
    CONTENT_TYPE: 'Content-Type',
    AUTHORIZATION: 'Authorization',
    X_CORRELATION_ID: 'X-Correlation-ID',
    X_REQUEST_ID: 'X-Request-ID',
    USER_AGENT: 'User-Agent'
};

// Content Types
const CONTENT_TYPES = {
    JSON: 'application/json',
    FORM_URLENCODED: 'application/x-www-form-urlencoded',
    MULTIPART_FORM_DATA: 'multipart/form-data',
    TEXT_PLAIN: 'text/plain',
    HTML: 'text/html'
};

// Cache Keys
const CACHE_KEYS = {
    CONFIG: 'app:config',
    ADMIN_RULES: 'app:admin_rules',
    BROWSER_STATUS: 'app:browser_status',
    JOB_STATUS: 'job:status:',
    RATE_LIMIT: 'rate_limit:'
};

// Time Intervals (in milliseconds)
const INTERVALS = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
    WEEK: 7 * 24 * 60 * 60 * 1000
};

// File Paths
const PATHS = {
    LOGS: './logs',
    TEMPLATES: './src/templates',
    PUBLIC: './src/public',
    CONFIG: './src/config',
    SERVICES: './src/services',
    CONTROLLERS: './src/controllers',
    MIDDLEWARE: './src/middleware',
    ROUTES: './src/routes',
    UTILS: './src/utils'
};

module.exports = {
    HTTP_STATUS,
    JOB_STATUS,
    TIME_OF_DAY,
    ADMIN_RULE_TYPES,
    CAMPAIGN_PROCESSING,
    BROWSER_CONFIG,
    RATE_LIMIT,
    JOB_CLEANUP,
    LOG_LEVELS,
    SOCKET_EVENTS,
    VALIDATION_MESSAGES,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    REGEX,
    ENV_VARS,
    DEFAULTS,
    RESPONSE_TEMPLATES,
    HEADERS,
    CONTENT_TYPES,
    CACHE_KEYS,
    INTERVALS,
    PATHS
};