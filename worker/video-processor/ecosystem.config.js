module.exports = {
  apps: [
    {
      name: "aim-worker",
      script: "src/daemon.ts",
      interpreter: "node",
      node_args: "--require ts-node/register",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "5s",
    },
  ],
};
