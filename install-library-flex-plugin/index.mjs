import { exit } from "process";

const {
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_FLEX_UI_VERSION,
  INPUT_PLUGIN_NAME,
  INPUT_VERSION_SID,
} = process.env;

const POLL_RATE_SECONDS = 10;
const POLL_COUNT = 30;

const MAX_RETRY_COUNT = 3;
const BASE_DELAY_MS = 2000;

/**
 * @typedef response
 * @property {object} body
 * @property {number} status
 * @property {boolean} ok
 *
 * @param {string} url
 * @param {"GET" | "POST"} method
 * @param {object} bodyJson
 * @param {number} retryNumber
 * @returns {Promise<response>}
 */
const asyncTwilioJsonRequest = async (
  url,
  method,
  bodyJson = undefined,
  retryNumber = 0
) => {
  try {
    console.log(`::debug::Request: ${method} ${url}`);
    const headers = {
      Authorization:
        "Basic " +
        Buffer.from(
          `${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`
        ).toString("base64"),
    };

    let body = undefined;
    if (bodyJson) {
      const undefinedParams = [];
      for (const [key, value] of Object.entries(bodyJson)) {
        if (value === undefined) {
          undefinedParams.push(key);
        }
      }
      for (const key of undefinedParams) {
        delete bodyJson[key];
      }
      body = JSON.stringify(bodyJson);
    }

    if (method === "POST" && body) {
      headers["Content-Type"] = "application/json"; // Requires JSON unlike other Twilio endpoints
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = await fetch(url, { method, headers, body });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error("Exceeded retry attempts after 429 errors");
      }
      const retryDelay = BASE_DELAY_MS * 2 ** retryNumber;
      console.log(`::debug::Rate-limit hit, retrying in ${retryDelay} ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return asyncTwilioJsonRequest(url, method, body, retryNumber + 1);
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
      ok,
    };
  } catch (err) {
    console.error(`::error::${err.message}`);
    exit(1);
  }
};

const attributes = Object.entries(process.env)
  .filter(([key]) => key.startsWith("ATTRIBUTE_"))
  .map(([key, value]) => ({ name: key.substring("ATTRIBUTE_".length), value }));

const flexApiUrl = "https://flex-api.twilio.com/v1";
const libraryServiceUrl = `${flexApiUrl}/PluginService/Library`;

const pluginInfo = await asyncTwilioJsonRequest(
  `${libraryServiceUrl}/Plugins/${INPUT_PLUGIN_NAME}?UiVersion=${INPUT_FLEX_UI_VERSION}`,
  "GET"
);
const { friendly_name, installed_version, sid } = pluginInfo.body;

if (installed_version && installed_version.sid === INPUT_VERSION_SID) {
  console.log(
    `Library Plugin '${friendly_name}' version ${installed_version.version} is already installed.`
  );
  exit(0);
}

const installResponse = await asyncTwilioJsonRequest(
  `${libraryServiceUrl}/Plugins/${sid}/Install`,
  "POST",
  {
    plugin_sid: sid,
    plugin_version_sid: INPUT_VERSION_SID,
    attributes,
  }
);

const installSid = installResponse.body.sid;

console.log(
  `Installing plugin '${friendly_name}' with version sid ${INPUT_VERSION_SID}... (timeout: ${
    POLL_RATE_SECONDS * POLL_COUNT
  } seconds)`
);

let installStatus = "INITIATED";
for (let i = 1; i <= POLL_COUNT; i++) {
  await new Promise((resolve) => setTimeout(resolve, POLL_RATE_SECONDS * 1000));
  process.stdout.write(
    `[${i * POLL_RATE_SECONDS} seconds] Polling install status... `
  );

  const statusResponse = await asyncTwilioJsonRequest(
    `${libraryServiceUrl}/Tasks/${installSid}/Status`,
    "GET"
  );
  const { status } = statusResponse.body;
  installStatus = status;

  console.log(installStatus);

  if (installStatus === "INSTALLED") {
    break;
  } else if (installStatus === "INSTALLING") {
    continue;
  } else {
    console.error(`::error::Unexpected install status '${installStatus}'`);
    exit(1);
  }
}

if (installStatus !== "INSTALLED") {
  console.error(
    `::error::Installation timed out after ${
      POLL_COUNT * POLL_RATE_SECONDS
    } seconds`
  );
  exit(1);
}

console.log("✅ Installation complete.");
