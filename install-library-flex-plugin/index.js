const { 
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_FLEX_UI_VERSION,
  INPUT_PLUGIN_SID,
  INPUT_VERSION_SID,
  INPUT_ATTRIBUTES
} = process.env;

const process = require("process");

const POLL_RATE_SECONDS = 10;
const POLL_COUNT = 20;

/**
 * @typedef response
 * @property {object} body
 * @property {number} status
 * @property {boolean} ok
 * 
 * @param {string} url 
 * @param {"GET" | "POST"} method 
 * @param {URLSearchParams} bodyParams 
 * @param {number} retryNumber 
 * @returns {Promise<response>}
 */
const asyncTwilioRequest = async (url, method, bodyParams = undefined, retryNumber = 0) => {
  try {
    console.log(`::debug::Request: ${method} ${url}`);
    const headers = {
      "Authorization": "Basic " + Buffer.from(`${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`).toString("base64")
    };
    
    let body = undefined;
    if (bodyParams) {
      const undefinedParams = [];
      for (const [key, value] of bodyParams.entries()) {
        if (value === "undefined") {
          undefinedParams.push(key);
        }
      }
      for (const key of undefinedParams) {
        bodyParams.delete(key);
      }
      body = bodyParams.toString();
    }

    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = await fetch(url, { method, headers, body });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error("Exceeded retry attempts after 429 errors");
      }
      const retryDelay = BASE_DELAY_MS * (2 ** retryNumber);
      console.log(`::debug::Rate-limit hit, retrying in ${retryDelay} ms...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return asyncTwilioRequest(url, method, bodyParams, retryNumber + 1);
    }

    console.log(`::debug::Status: ${req.status} ${req.statusText}`);

    const ok = req.status >= 200 && req.status < 300;
    if (!ok) {
      throw new Error(`Error Response: ${await req.text()}`);
    }

    const responseBody = await req.json();

    return {
      body: responseBody,
      status: req.status,
      ok
    };
  } catch (err) {
    throw err;
    // return { body: undefined, status: 500, ok: false };
  }
}

const attributes = (INPUT_ATTRIBUTES ?? "")
  .split("\n")
  .map((line) => line.split("="))
  .filter((lineParts) => lineParts.length === 2)
  .map(([name, value]) => ({
    name,
    value
  }));

const flexApiUrl = "https://flex-api.twilio.com/v1"
const libraryServiceUrl = `${flexApiUrl}/PluginService/Library`

const run = async () => {
  const pluginInfo = await asyncTwilioRequest(
    `${libraryServiceUrl}/Plugins/${INPUT_PLUGIN_SID}?UiVersion=${INPUT_FLEX_UI_VERSION}`,
    "GET"
  );
  
  const { friendly_name, installed_version } = pluginInfo.body;

  if (installed_version && installed_version.sid === INPUT_VERSION_SID) {
    console.log(`Library Plugin '${friendly_name}' version ${installed_version.version} is already installed.`);
    return;
  }

  const installResponse = await asyncTwilioRequest(
    `${libraryServiceUrl}/Plugins/${INPUT_PLUGIN_SID}/Install`,
    "POST",
    new URLSearchParams({
      plugin_sid: INPUT_PLUGIN_SID,
      plugin_version_sid: INPUT_VERSION_SID,
      attributes: JSON.stringify(attributes)
    })
  );

  const installSid = installResponse.body.sid;

  console.log(`Installing plugin '${friendly_name}' with version sid ${INPUT_VERSION_SID}... (timeout: ${POLL_RATE_SECONDS * POLL_COUNT} seconds)`);

  for (const i = 1; i <= POLL_COUNT; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_RATE_SECONDS / 1000));
    process.stdout.write(`[${i * POLL_RATE_SECONDS} seconds] Polling install status... `);
    
    const statusResponse = await asyncTwilioRequest(
      `${libraryServiceUrl}/Tasks/${installSid}/Status`,
      "GET"
    );
    const { status } = statusResponse.body;

    console.log(status);

    if (status === "INSTALLED") {
      break;
    } else if (status === "INSTALLING") {
      continue;
    } else {
      throw new Error(`Unexpected install status '${status}'`);
    }
  }

  console.log("Installation complete.");
}

run();
