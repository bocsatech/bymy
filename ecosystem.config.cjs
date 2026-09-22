module.exports = {
  apps: [
    {
      name: "bymy",
      script: "server.mjs",
      cwd: "/var/www/bymy",
      instances: 2,
      exec_mode: "cluster",
      max_memory_restart: "512M",
      kill_timeout: 5000,
    },
  ],
};
