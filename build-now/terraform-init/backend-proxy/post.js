const { get } = require("http");

const { INPUT_BACKEND_PROXY_PORT } = process.env;

console.log(`Sending close request to http://localhost:${INPUT_BACKEND_PROXY_PORT}/exit...`);

const req = get(`http://localhost:${INPUT_BACKEND_PROXY_PORT}/exit`,
  { timeout: 5000 },
  (res) => {
  if (res.statusCode === 200) {
    console.log("Server closed");
  }
});
req.on("error", () => {
  console.log("Server close failed. Skipping.");
});
req.on("timeout", () => {
  req.destroy();
  console.log("Server close timed out. Skipping.");
})
