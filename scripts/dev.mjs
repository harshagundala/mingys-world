import { spawn } from "node:child_process";
const children = [
  spawn(
    process.execPath,
    [
      "--env-file-if-exists=.env.local",
      "--import",
      "tsx",
      "scripts/local-server.ts",
    ],
    { stdio: "inherit" },
  ),
  spawn("npx", ["vite", "--host", "127.0.0.1"], { stdio: "inherit" }),
];
for (const sig of ["SIGINT", "SIGTERM"])
  process.on(sig, () => {
    children.forEach((c) => c.kill(sig));
    process.exit();
  });
