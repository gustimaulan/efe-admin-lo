module.exports = {
  apps: [{
    name: 'loops',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    kill_timeout: 30000,
    listen_timeout: 10000,

    // Environment untuk Produksi (menggunakan config 'regular')
    env_production: {
      NODE_ENV: 'production',
      PORT: 3010,
      ALLOWED_ORIGINS: 'http://5.161.185.120:3010,http://localhost:3010',
      TRUST_PROXY: 'false'
    },

    // Environment untuk Staging (menggunakan config 'staging')
    env_staging: {
      NODE_ENV: 'staging',
      PORT: 3011,
      ALLOWED_ORIGINS: 'http://5.161.185.120:3011,http://localhost:3011',
      TRUST_PROXY: 'false'
    }
  }]
};