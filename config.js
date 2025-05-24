const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    CAMPAIGN_IDS: {
        regular: {
            pagi: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548],
            siang: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548],
            malam: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548],
            dini: [281482, 250794, 250554, 250433, 250432, 246860, 246815, 246551, 246550, 246549, 246548],
            manual: [281482, 250794, 250554, 250433, 250432, 247001, 246860, 246815, 246551, 246550, 246549, 246548]
        },
        tiktok: {
            dhuha: [249397, 275170],
            sore: [249397, 275170],
            manual: [249397, 275170]
        }
    },
    ALLOWED_ADMIN_NAMES: ["admin 1", "admin 2", "admin 3", "admin 4", "admin 5", "admin 6", "admin 7"],
    LOGIN_URL: 'https://app.loops.id/login',
    CAMPAIGN_BASE_URL: 'https://app.loops.id/campaign/',
    SERVER: {
        PORT: process.env.PORT || 3010,
        TIMEOUT: 600000 // 10 minutes
    },
    BROWSER: {
        ARGS: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    },
    JOB: {
        CLEANUP_TIMEOUT: 3600000 // 1 hour
    }
}; 