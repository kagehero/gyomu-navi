// PM2 ecosystem for Gyomu Navi on EC2.
//
//   pm2 start infra/ecosystem.config.js
//   pm2 save && pm2 startup
//
// Two apps: the NestJS backend on :3001 and the Next.js production server on
// :3000. Both expect their respective `.env` files in their own directory.

module.exports = {
  apps: [
    {
      name: "gyomu-backend",
      cwd: "/opt/gyomu-navi/backend",
      script: "dist/main.js",
      instances: 2, // adjust to vCPU count; t3.large has 2 vCPUs
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      max_memory_restart: "512M",
      out_file: "/var/log/pm2/gyomu-backend.out.log",
      error_file: "/var/log/pm2/gyomu-backend.err.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "gyomu-frontend",
      cwd: "/opt/gyomu-navi",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // Tell the SPA build where the API lives. Must match the Nginx vhost.
        NEXT_PUBLIC_API_BASE_URL: "https://app.example.com/api",
      },
      max_memory_restart: "512M",
      out_file: "/var/log/pm2/gyomu-frontend.out.log",
      error_file: "/var/log/pm2/gyomu-frontend.err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
