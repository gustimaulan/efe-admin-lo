module.exports = {
  apps: [{
    name: 'efe-admin-lo',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',

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