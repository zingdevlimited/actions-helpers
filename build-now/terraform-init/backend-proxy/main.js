const { spawn } = require("child_process");
const { exit } = require("process");
const { appendFileSync } = require("fs");

const { INPUT_BACKEND_PROXY_PORT, INPUT_ACTION_PATH, GITHUB_ENV } = process.env;

process.chdir(INPUT_ACTION_PATH);

const delay = async (ms) => new Promise((resolve) => setTimeout(resolve, ms)); 

const startServer = (port) => {
  spawn("node", ["backend-proxy.js", port], {
    stdio: "inherit",
    detached: true
  }).unref();
}

const tryPing = async (port) => {
  try {
    const res = await fetch(`http://localhost:${port}/ping`, { signal: AbortSignal.timeout(5000) });
    if (res.status !== 200) {
      console.log(`Ping to localhost:${port} did not return 200 response`);
      return false;
    }
  } catch (err) {
    console.log(`Ping to localhost:${port} threw error:`);
    console.log(err);
    return false;
  }
  console.log(`Successfully pinged http://localhost:${port}/ping`);
  return true;
}

const startServerAndPing = async (port) => {
  startServer(port);
  await delay(1000);
  let attempt = 0;
  let res = await tryPing(port);
  while (!res && attempt < 2) {
    const delayAmount = (1000) * (2 ** attempt);
    console.log(`Retrying in ${delayAmount}ms...`);
    await delay(delayAmount);
    res = await tryPing(port);
    attempt += 1;
  }
  return res;
}

const run = async () => {
  let port = Number.parseInt(INPUT_BACKEND_PROXY_PORT);
  let attempt = 0;
  let res = await startServerAndPing(port);
  while (!res && attempt < 2) {
    console.log(`Failed to connect to ${port}. Attempting to host on port ${port + 1}`);
    port += 1;
    res = await startServerAndPing(port);
    attempt += 1;
  }
  if (!res) {
    console.log(`::error::Failed to run backend proxy. May be due to a network issue.`);
    exit(1);
  }

  if (GITHUB_ENV) {
    appendFileSync(GITHUB_ENV, `CURRENT_BACKEND_PROXY_PORT=${port}\n`, "utf8");
  }
  exit(0);
}

run();
