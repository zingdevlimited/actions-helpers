const { spawn, execSync } = require("child_process");
const { get } = require("http");
const { exit } = require("process");

const { INPUT_BACKEND_PROXY_PORT, INPUT_ACTION_PATH } = process.env;

execSync("ls", {
  cwd: INPUT_ACTION_PATH,
  stdio: "inherit"
});

spawn("node", ["backend-proxy.js"], {
  stdio: "inherit",
  detached: true
}, {
  cwd: INPUT_ACTION_PATH
}).unref();

setTimeout(() => {
  console.log(`Calling http://localhost:${INPUT_BACKEND_PROXY_PORT}/ping...`);
  const req = get(`http://localhost:${INPUT_BACKEND_PROXY_PORT}/ping`, {
    timeout: 5000
  }, (res) => {
    if (res.statusCode !== 200) {
      console.log("::error::Ping to localhost failed");
      exit(1);
    }
    console.log("Received 200 OK");

    // const initConfig = `-backend-config="address=http://localhost:${INPUT_BACKEND_PROXY_PORT}"`
    // execSync(`terraform init ${initConfig}`, {
    //   stdio: "inherit",
    //   cwd: INPUT_TERRAFORM_DIRECTORY
    // });

    // execSync("terraform validate", {
    //   stdio: "inherit",
    //   cwd: INPUT_TERRAFORM_DIRECTORY
    // });
  });

  req.on("timeout", () => {
    req.destroy();
    console.log("::error::Ping to localhost timed out");
    exit(1);
  })
}, 1000); // Delay to allow server startup
