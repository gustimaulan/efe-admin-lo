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

    // Environment untuk Produksi (menggunakan config 'regular')
    env_production: {
      NODE_ENV: 'production',
      // Anda bisa menambahkan variabel lain di sini jika perlu
      // PORT: 3010 
    },

    // Environment untuk Staging (menggunakan config 'staging')
    env_staging: {
      NODE_ENV: 'staging',
      // PORT: 3011
    }
  }]
};