#!/usr/bin/env node

/**
 * EFE Admin Lo - Server Entry Point
 * 
 * This is the main entry point for the application.
 * It initializes the app and starts the server.
 */

// Load environment variables first
require('dotenv').config();

const { app, server, io } = require('./app');
const loggerService = require('./services/loggerService');
const config = require('./config');

// Set up global error handlers for uncaught exceptions
process.on('uncaughtException', (error) => {
    loggerService.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    loggerService.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    loggerService.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        loggerService.info('HTTP server closed');
        
        // Close browser service if it's running
        try {
            const campaignService = require('./services/campaignService');
            campaignService.cleanup().then(() => {
                loggerService.info('Browser service cleaned up');
                process.exit(0);
            }).catch((error) => {
                loggerService.error('Error during browser cleanup:', error);
                process.exit(1);
            });
        } catch (error) {
            loggerService.error('Browser service not available:', error);
            process.exit(0);
        }
    });
    
    // Force close after 30 seconds
    setTimeout(() => {
        loggerService.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 30000);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Log startup information
loggerService.info('=== EFE Admin Lo Server Starting ===', {
    environment: config.env,
    activeEnv: config.activeEnv,
    nodeVersion: process.version,
    platform: process.platform,
    pid: process.pid
});

// Export for testing purposes
module.exports = { app, server, io };

// If this file is run directly, start the server
if (require.main === module) {
    const PORT = config.SERVER.PORT;
    
    // The server is already started in app.js, but we can add additional startup logic here
    loggerService.info(`Server is running on port ${PORT}`);
    loggerService.info(`Environment: ${config.env} (${config.activeEnv})`);
    loggerService.info(`Process ID: ${process.pid}`);
    
    // Log configuration (without sensitive data)
    loggerService.info('Configuration loaded:', {
        hasEmail: !!process.env.EMAIL,
        hasPassword: !!process.env.PASSWORD,
        hasWebhookUrl: !!process.env.WEBHOOK_URL,
        port: config.SERVER.PORT,
        timeout: config.SERVER.TIMEOUT,
        allowedAdmins: config.ALLOWED_ADMIN_NAMES.length,
        campaignIds: Object.keys(config.CAMPAIGN_IDS).length,
        rules: config.RULES.length
    });
}