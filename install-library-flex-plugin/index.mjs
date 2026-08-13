// @ts-nocheck
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
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    console.log("::debug::Request body:");
    console.dir(bodyJson, { depth: null });

    const req = await fetch(url, {
      method,
      headers,
      body,
    });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error("Exceeded retry attempts after 429 errors");
      }

      const retryDelay = BASE_DELAY_MS * 2 ** retryNumber;

      console.log(
        `::debug::Rate-limit hit, retrying in ${retryDelay} ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, retryDelay));

      return asyncTwilioJsonRequest(
        url,
        method,
        bodyJson,
        retryNumber + 1
      );
    }

    console.log(`::debug::Status: ${req.status} ${req.statusText}`);

    console.log("::debug::Response headers:");
    console.dir(Object.fromEntries(req.headers.entries()), {
      depth: null,
    });

    const ok = req.status >= 200 && req.status < 300;

    if (!ok) {
      const errorBody = await req.text();

      console.log("::debug::Error response body:");
      console.log(errorBody);

      throw {
        message: errorBody,
        status: req.status,
      };
    }

    const responseBody = await req.json();

    console.log("::debug::Response body:");
    console.dir(responseBody, { depth: null });

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
  .map(([key, value]) => ({
    name: key.substring("ATTRIBUTE_".length),
    value,
  }));

console.log("Incoming ATTRIBUTE_* values:");
console.dir(attributes, { depth: null });

const attributesAreEqual = (
  firstAttributes = [],
  secondAttributes = []
) => {
  const normalizeAttributes = (items) =>
    items
      .map(({ name, value }) => ({
        name,
        value,
      }))
      .sort((first, second) =>
        first.name.localeCompare(second.name)
      );

  const normalizedFirst = normalizeAttributes(firstAttributes);
  const normalizedSecond = normalizeAttributes(secondAttributes);

  console.log("Normalized first attributes:");
  console.dir(normalizedFirst, { depth: null });

  console.log("Normalized second attributes:");
  console.dir(normalizedSecond, { depth: null });

  return (
    JSON.stringify(normalizedFirst) ===
    JSON.stringify(normalizedSecond)
  );
};

const flexApiUrl = "https://flex-api.twilio.com/v1";
const libraryServiceUrl = `${flexApiUrl}/PluginService/Library`;

console.log("Fetching plugin information...");

const pluginInfo = await asyncTwilioJsonRequest(
  `${libraryServiceUrl}/Plugins/${INPUT_PLUGIN_NAME}?UiVersion=${INPUT_FLEX_UI_VERSION}`,
  "GET"
);

console.log("Full pluginInfo response:");
console.dir(pluginInfo, { depth: null });

console.log("Plugin info body:");
console.dir(pluginInfo.body, { depth: null });

const {
  friendly_name,
  installed_version,
  sid,
  install_status,
  compatible_version,
  latest_version,
} = pluginInfo.body;

console.log("Plugin SID:");
console.dir(sid, { depth: null });

console.log("Install status:");
console.dir(install_status, { depth: null });

console.log("Installed version:");
console.dir(installed_version, { depth: null });

console.log("Installed version attributes:");
console.dir(installed_version?.attributes, { depth: null });

console.log("Compatible version:");
console.dir(compatible_version, { depth: null });

console.log("Compatible version attributes:");
console.dir(compatible_version?.attributes, { depth: null });

console.log("Latest version:");
console.dir(latest_version, { depth: null });

console.log("Latest version attributes:");
console.dir(latest_version?.attributes, { depth: null });

if (
  installed_version &&
  installed_version.sid === INPUT_VERSION_SID
) {
  console.log("Requested version is already installed.");

  console.log("Comparing installed_version.attributes with incoming attributes...");

  const sameAttributes = attributesAreEqual(
    installed_version.attributes,
    attributes
  );

  console.log(`Attributes equal: ${sameAttributes}`);

  if (sameAttributes) {
    console.log(
      `Library Plugin '${friendly_name}' version ${installed_version.version} is already installed with matching attributes.`
    );
    exit(0);
  }

  console.log(
    "Plugin version matches, but attributes do not match. Continuing to install request..."
  );
}

console.log("Installing plugin with:");
console.log(`Plugin SID: ${sid}`);
console.log(`Version SID: ${INPUT_VERSION_SID}`);

console.log("Attributes being sent:");
console.dir(attributes, { depth: null });

const installResponse = await asyncTwilioJsonRequest(
  `${libraryServiceUrl}/Plugins/${sid}/Install`,
  "POST",
  {
    plugin_sid: sid,
    plugin_version_sid: INPUT_VERSION_SID,
    attributes,
  }
);

console.log("Full install response:");
console.dir(installResponse, { depth: null });

console.log("Install response body:");
console.dir(installResponse.body, { depth: null });

const installSid = installResponse.body.sid;

console.log(`Install task SID: ${installSid}`);

console.log(
  `Installing plugin '${friendly_name}' with version sid ${INPUT_VERSION_SID}... (timeout: ${
    POLL_RATE_SECONDS * POLL_COUNT
  } seconds)`
);

let installStatus = "INITIATED";

for (let i = 1; i <= POLL_COUNT; i++) {
  await new Promise((resolve) =>
    setTimeout(resolve, POLL_RATE_SECONDS * 1000)
  );

  process.stdout.write(
    `[${i * POLL_RATE_SECONDS} seconds] Polling install status... `
  );

  const statusResponse = await asyncTwilioJsonRequest(
    `${libraryServiceUrl}/Tasks/${installSid}/Status`,
    "GET"
  );

  console.log("Full task status response:");
  console.dir(statusResponse, { depth: null });

  console.log("Task status response body:");
  console.dir(statusResponse.body, { depth: null });

  const { status } = statusResponse.body;

  installStatus = status;

  console.log(`Current install status: ${installStatus}`);

  if (installStatus === "INSTALLED") {
    break;
  } else if (installStatus === "INSTALLING") {
    continue;
  } else {
    console.error(
      `::error::Unexpected install status '${installStatus}'`
    );
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

console.log("Fetching plugin information again after installation...");

const pluginInfoAfterInstall = await asyncTwilioJsonRequest(
  `${libraryServiceUrl}/Plugins/${INPUT_PLUGIN_NAME}?UiVersion=${INPUT_FLEX_UI_VERSION}`,
  "GET"
);

console.log("Full plugin info after installation:");
console.dir(pluginInfoAfterInstall, { depth: null });

console.log("Plugin info body after installation:");
console.dir(pluginInfoAfterInstall.body, { depth: null });

console.log("Installed version after installation:");
console.dir(
  pluginInfoAfterInstall.body.installed_version,
  { depth: null }
);

console.log("Installed version attributes after installation:");
console.dir(
  pluginInfoAfterInstall.body.installed_version?.attributes,
  { depth: null }
);