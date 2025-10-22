const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

// Import configuration and services
const config = require('./config');
const loggerService = require('./services/loggerService');
const automationService = require('./services/automationService');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Import routes
const apiRoutes = require('./routes/api');

// Import utilities
const { generateCorrelationId, sanitizeForLogging } = require('./utils/helpers');
const { RESPONSE_TEMPLATES, HTTP_STATUS } = require('./utils/constants');

// Create Express app
const app = express();

// Create HTTP server
const server = http.createServer(app);



// Configure Socket.IO
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Set up logger service with Socket.IO
loggerService.setSocketIO(io);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "data:"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://cdn.socket.io"]
        }
    },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    crossOriginEmbedderPolicy: false,
    originAgentCluster: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3010', 'http://5.161.185.120:3010'],
    credentials: true
}));

// Trust proxy for rate limiting and IP detection
// Only trust specific proxy IPs or disable if not behind a proxy
if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', process.env.TRUST_PROXY_IPS || 'loopback, linklocal, uniquelocal');
}

// Rate limiting with proper configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: RESPONSE_TEMPLATES.ERROR('Too many requests from this IP, please try again later.', HTTP_STATUS.TOO_MANY_REQUESTS),
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting for health checks and static files
    skip: (req) => {
        return req.path === '/health' || req.path.startsWith('/static/') || req.path === '/sw.js';
    },
    // Use a custom key generator that works with or without trust proxy
    keyGenerator: (req) => {
        // If trust proxy is enabled, use the X-Forwarded-For header
        if (app.get('trust proxy')) {
            return req.ip || req.connection.remoteAddress || req.socket.remoteAddress ||
                   (req.connection.socket ? req.connection.socket.remoteAddress : null);
        }
        // Otherwise, use the direct connection IP
        return req.connection.remoteAddress || req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null);
    }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(morgan('combined', {
    stream: {
        write: (message) => {
            loggerService.info(message.trim());
        }
    }
}));

// Request correlation ID middleware
app.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
});

// Console log override for Socket.IO
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

console.log = function() {
    originalConsoleLog.apply(console, arguments);
    const message = Array.from(arguments).map(arg => {
        if (typeof arg === 'object') {
            return JSON.stringify(arg);
        }
        return sanitizeForLogging(String(arg));
    }).join(' ');
    
    loggerService.info(message);
    io.emit('console_logs', { 
        timestamp: new Date(), 
        message, 
        isError: false,
        correlationId: global.currentCorrelationId
    });
};

console.error = function() {
    originalConsoleError.apply(console, arguments);
    const message = Array.from(arguments).map(arg => {
        if (typeof arg === 'object') {
            return JSON.stringify(arg);
        }
        return sanitizeForLogging(String(arg));
    }).join(' ');
    
    loggerService.error(message);
    io.emit('console_logs', { 
        timestamp: new Date(), 
        message, 
        isError: true,
        correlationId: global.currentCorrelationId
    });
};

// Socket.IO connection handling
io.on('connection', (socket) => {
    loggerService.info('New client connected', { socketId: socket.id });
    
    socket.on('subscribeToJob', (jobId) => {
        loggerService.info('Client subscribed to job', { jobId, socketId: socket.id });
        socket.join(jobId);
        global.currentCorrelationId = jobId;
    });
    
    socket.on('unsubscribeFromJob', (jobId) => {
        loggerService.info('Client unsubscribed from job', { jobId, socketId: socket.id });
        socket.leave(jobId);
        if (global.currentCorrelationId === jobId) {
            global.currentCorrelationId = null;
        }
    });
    
    socket.on('disconnect', () => {
        loggerService.info('Client disconnected', { socketId: socket.id });
    });
});

// Forward automation service logs to Socket.IO
const originalAddJobLog = automationService.addJobLog;
automationService.addJobLog = function(jobId, message, isError = false) {
    originalAddJobLog.call(this, jobId, message, isError);
    io.to(jobId).emit('newLog', {
        timestamp: new Date(),
        message: message.trim(),
        isError,
        jobId
    });
};

// API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: config.env,
        activeEnv: config.activeEnv,
        version: require('../package.json').version,
        correlationId: req.correlationId
    };
    
    res.json(RESPONSE_TEMPLATES.SUCCESS(health));
});

// Root endpoint - serve the main HTML template
app.get('/', (req, res) => {
    try {
        const packageJson = require('../package.json');
        let html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
        html = html.replace('{{VERSION}}', packageJson.version);
        html = html.replace('{{ENVIRONMENT}}', config.env);
        html = html.replace('{{ACTIVE_ENV}}', config.activeEnv);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        loggerService.error('Error serving index.html:', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
           .json(RESPONSE_TEMPLATES.ERROR('Failed to load page', HTTP_STATUS.INTERNAL_SERVER_ERROR));
    }
});

// Static files serving with proper headers and fallback
app.use('/static', express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path, stat) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        // Add caching headers for better performance
        if (path.endsWith('.css') || path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
}));

// Fallback route for direct /js/ access
app.use('/js', express.static(path.join(__dirname, 'public/js'), {
    setHeaders: (res, path, stat) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'public, max-age=3600');
    }
}));

// Service worker route
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, 'public/sw.js'));
});

// API documentation endpoint
app.get('/api/docs', (req, res) => {
    const docs = {
        title: 'EFE Admin API Documentation',
        version: require('../package.json').version,
        environment: config.env,
        endpoints: {
            'GET /api/config': 'Get application configuration',
            'GET /api/admin-restrictions': 'Get admin restriction rules',
            'GET /api/version': 'Get application version',
            'GET /api/health': 'Health check endpoint',
            'GET /api/jobs': 'Get all running jobs',
            'GET /api/jobs/:jobId': 'Get job status by ID',
            'DELETE /api/jobs/:jobId': 'Cancel a running job',
            'POST /api/check-plan': 'Generate processing plan without executing',
            'POST /api/run': 'Run automation process'
        },
        websocket: {
            events: {
                'connection': 'Client connects to server',
                'disconnect': 'Client disconnects from server',
                'subscribeToJob': 'Subscribe to job updates',
                'unsubscribeFromJob': 'Unsubscribe from job updates',
                'console_logs': 'Console log messages',
                'newLog': 'Job-specific log messages'
            }
        }
    };
    
    res.json(RESPONSE_TEMPLATES.SUCCESS(docs));
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    loggerService.info(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        loggerService.info('HTTP server closed');
        
        // Close browser service
        const campaignService = require('./services/campaignService');
        campaignService.cleanup().then(() => {
            loggerService.info('Browser service cleaned up');
            process.exit(0);
        }).catch((error) => {
            loggerService.error('Error during browser cleanup:', error);
            process.exit(1);
        });
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

// Start server with port availability check
const PORT = config.SERVER.PORT;
const net = require('net');

// Function to check if port is available
const checkPortAvailable = (port) => {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.listen(port, () => {
            server.once('close', () => {
                resolve(true);
            });
            server.close();
        });
        
        server.on('error', () => {
            resolve(false);
        });
    });
};

// Start server with retry logic
const startServer = async (port, maxRetries = 5) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const isAvailable = await checkPortAvailable(port);
        
        if (isAvailable) {
            return new Promise((resolve, reject) => {
                server.listen(port, '0.0.0.0', () => {
                    loggerService.info(`Server started on http://0.0.0.0:${port}`, {
                        environment: config.env,
                        activeEnv: config.activeEnv,
                        version: require('../package.json').version,
                        nodeVersion: process.version,
                        platform: process.platform
                    });
                    resolve();
                });
                
                server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        loggerService.error(`Port ${port} is already in use`);
                        reject(error);
                    } else {
                        reject(error);
                    }
                });
            });
        } else {
            loggerService.warn(`Port ${port} is already in use, attempting to find an alternative port...`);
            
            if (attempt < maxRetries) {
                // Try next port
                port = port + 1;
                loggerService.info(`Trying port ${port}...`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
            } else {
                throw new Error(`Could not find an available port after ${maxRetries + 1} attempts. Tried ports from ${config.SERVER.PORT} to ${port}`);
            }
        }
    }
};

// Start the server
startServer(PORT).catch((error) => {
    loggerService.error('Failed to start server:', error);
    process.exit(1);
});

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
    loggerService.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    loggerService.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

module.exports = { app, server, io };