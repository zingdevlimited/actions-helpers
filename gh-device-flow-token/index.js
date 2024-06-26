const { INPUT_GH_APP_CLIENT_ID, GITHUB_OUTPUT, GITHUB_ACTIONS } = process.env;
const { writeFileSync } = require("fs");

const delay = async (ms) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

const run = async () => {
  const response = await fetch(
    `https://github.com/login/device/code?client_id=${INPUT_GH_APP_CLIENT_ID}`,
    {
      method: "POST",
    }
  );
  const data = await response.formData();
  const userCode = data.get("user_code");

  const CYAN = "\u001b[36m";
  console.log(CYAN + `Open https://github.com/login/device in your browser and enter the code ${userCode}`);

  let pollingInterval = Number.parseInt(data.get("interval")) * 1000;
  const deviceCode = data.get("device_code");

  const pollingParams = new URLSearchParams({
    client_id: INPUT_GH_APP_CLIENT_ID,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code"
  });

  let access_token = "";
  while (!access_token) {
    await delay(pollingInterval);
    const pollingResponse = await fetch(
      `https://github.com/login/oauth/access_token?${pollingParams}`
    );
    const pollingData = await pollingResponse.formData();

    switch (pollingData.get("error")) {
      case null:
        access_token = pollingData.get("access_token");
        break;
      case "authorization_pending":
        console.log("Waiting for user consent...");
        continue;
      case "slow_down":
        console.log("slow_down received. Changing interval...");
        pollingInterval = Number.parseInt(pollingData.get("interval")) * 1000;
        continue;
      case "expired_token":
        console.error("::error::Device code has expired. Please try again.");
        process.exit(1);
      case "access_denied":
        console.error("::error::The user denied access. Please try again.");
        process.exit(1);
      default:
        console.error(`::error::Received error ${pollingData.get("error")}`);
        process.exit(1);
    }
  }
  console.log("Access Token received");

  if (GITHUB_ACTIONS === "true") {
    console.log(`::add-mask::${access_token}`);
    writeFileSync(GITHUB_OUTPUT, `ACCESS_TOKEN=${access_token}\n`, "utf8");
  }
}
run();
