const winston = require('winston');
const { format } = winston;

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
    ),
    defaultMeta: { service: 'efe-admin-lo' },
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// If we're not in production, log to the console too
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: format.combine(
            format.colorize(),
            format.simple()
        )
    }));
}

// Create a stream object for Morgan
const stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

// Socket.IO logging wrapper
let io;

function setSocketIO(socketIO) {
    io = socketIO;
}

function emitLog(message, isError = false) {
    if (io) {
        io.emit('console_logs', {
            timestamp: new Date(),
            message,
            isError
        });
    }
}

// Logging wrapper that both logs to Winston and emits to Socket.IO
function log(level, message, meta = {}) {
    logger.log(level, message, meta);
    emitLog(message, level === 'error');
}

module.exports = {
    logger,
    stream,
    setSocketIO,
    log,
    error: (message, meta) => log('error', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    info: (message, meta) => log('info', message, meta),
    debug: (message, meta) => log('debug', message, meta)
}; 