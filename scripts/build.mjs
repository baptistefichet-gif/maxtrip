import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const requireShim = fileURLToPath(new URL("./safe-memory-usage.cjs", import.meta.url));
const existingNodeOptions = process.env.NODE_OPTIONS?.trim();
const nodeOptions = [existingNodeOptions, `--require=${requireShim}`].filter(Boolean).join(" ");
const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));

const child = spawn(process.execPath, [nextBin, "build", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: nodeOptions }
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
