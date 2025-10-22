const loggerService = require('../services/loggerService');
const { AppError } = require('./validation');

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    loggerService.error(`Error ${err.status || 500}: ${err.message}`, {
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        stack: err.stack
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new AppError(message, 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = new AppError(message, 400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = new AppError(message, 400);
    }

    // JWT error
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = new AppError(message, 401);
    }

    // JWT expired error
    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = new AppError(message, 401);
    }

    // Playwright errors
    if (err.name === 'TimeoutError') {
        const message = 'Browser operation timed out';
        error = new AppError(message, 408);
    }

    // Network errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        const message = 'Network connection failed';
        error = new AppError(message, 503);
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: {
            message: error.message || 'Internal Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        }
    });
};

/**
 * 404 handler middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const notFound = (req, res, next) => {
    const error = new AppError(`Not found - ${req.originalUrl}`, 404);
    next(error);
};

/**
 * Async error wrapper
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Wrapped function
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validation error handler
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validationErrorHandler = (err, req, res, next) => {
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(error => ({
            field: error.path,
            message: error.message,
            value: error.value
        }));
        
        return res.status(400).json({
            success: false,
            error: {
                message: 'Validation failed',
                errors
            }
        });
    }
    
    next(err);
};

/**
 * Rate limit error handler
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const rateLimitErrorHandler = (err, req, res, next) => {
    if (err.statusCode === 429) {
        return res.status(429).json({
            success: false,
            error: {
                message: 'Too many requests. Please try again later.',
                retryAfter: err.retryAfter || 60
            }
        });
    }
    
    next(err);
};

/**
 * Browser error handler
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const browserErrorHandler = (err, req, res, next) => {
    if (err.name && err.name.includes('Playwright')) {
        loggerService.error('Browser automation error:', err);
        
        return res.status(500).json({
            success: false,
            error: {
                message: 'Browser automation failed. Please try again.',
                details: process.env.NODE_ENV === 'development' ? err.message : undefined
            }
        });
    }
    
    next(err);
};

/**
 * Process exit handler
 */
const processExitHandler = () => {
    loggerService.info('Application is shutting down...');
    
    // Close database connections, cleanup resources, etc.
    process.exit(0);
};

/**
 * Uncaught exception handler
 */
const uncaughtExceptionHandler = (err) => {
    loggerService.error('Uncaught Exception:', err);
    loggerService.info('Shutting down due to uncaught exception...');
    process.exit(1);
};

/**
 * Unhandled promise rejection handler
 */
const unhandledRejectionHandler = (err) => {
    loggerService.error('Unhandled Rejection:', err);
    loggerService.info('Shutting down due to unhandled promise rejection...');
    process.exit(1);
};

// Setup process error handlers
process.on('uncaughtException', uncaughtExceptionHandler);
process.on('unhandledRejection', unhandledRejectionHandler);
process.on('SIGTERM', processExitHandler);
process.on('SIGINT', processExitHandler);

module.exports = {
    errorHandler,
    notFound,
    asyncHandler,
    validationErrorHandler,
    rateLimitErrorHandler,
    browserErrorHandler,
    processExitHandler,
    uncaughtExceptionHandler,
    unhandledRejectionHandler
};