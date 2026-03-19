module.exports = {
  apps: [{
    name: 'calendar-server',
    cwd: '/opt/calendar/server',
    script: 'dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3200,
    },
    error_file: '/opt/calendar/logs/error.log',
    out_file: '/opt/calendar/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
