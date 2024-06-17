const { CURRENT_BACKEND_PROXY_PORT } = process.env;

console.log(`Sending close request to http://localhost:${CURRENT_BACKEND_PROXY_PORT}/exit...`);

const res = fetch(`http://localhost:${CURRENT_BACKEND_PROXY_PORT}/exit`, { signal: AbortSignal.timeout(5000) })
  .then((res) => {
    if (res.statusCode === 200) {
      console.log("Server closed");
    }
  }).catch(() => {
    console.log("Server close failed. Skipping.");
  });
