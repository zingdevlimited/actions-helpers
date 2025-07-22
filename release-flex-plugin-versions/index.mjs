import { appendFileSync } from "fs";

const {
  INPUT_PLUGIN_VERSIONS,
  INPUT_RELEASE_NAME,
  INPUT_RELEASE_DESCRIPTION,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  GITHUB_STEP_SUMMARY,
  GITHUB_RUN_NUMBER,
} = process.env;

if (!INPUT_PLUGIN_VERSIONS?.trim()) {
  throw new Error("Missing Input PLUGIN_VERSIONS");
}
if (!INPUT_TWILIO_API_KEY?.trim()) {
  throw new Error("Missing Input TWILIO_API_KEY");
}
if (!INPUT_TWILIO_API_SECRET?.trim()) {
  throw new Error("Missing Input TWILIO_API_SECRET");
}

const releaseName =
  INPUT_RELEASE_NAME ||
  `Autorelease #${GITHUB_RUN_NUMBER || new Date().valueOf()}`;
const releaseDescription = INPUT_RELEASE_DESCRIPTION;

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
 * @param {URLSearchParams | undefined} bodyParams
 * @param {number} retryNumber
 * @returns {Promise<response>}
 */
const asyncTwilioRequest = async (
  url,
  method,
  bodyParams = undefined,
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

    let body;
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

    if (method === "POST" && body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
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
      return asyncTwilioRequest(url, method, bodyParams, retryNumber + 1);
    }

    console.log(`::debug::Status: ${req.status} ${req.statusText}`);

    const ok = req.status >= 200 && req.status < 300;
    if (!ok) {
      throw { message: await req.text(), status: req.status };
    }

    const responseBody = await req.json();

    return {
      body: responseBody,
      status: req.status,
      ok,
    };
  } catch (err) {
    throw err;
    // return { body: undefined, status: 500, ok: false };
  }
};

const pluginServiceUrl = "https://flex-api.twilio.com/v1/PluginService";

// Split lines of PLUGIN_NAME=PLUGIN_VERSION
const pluginVersions = INPUT_PLUGIN_VERSIONS.split("\n")
  .filter((l) => l?.split("=").length === 2)
  .map((l) => l.split("="));

let summary = "## Flex Plugin Release\n\n";
summary += `**Name**: ${releaseName}\n\n`;
summary += `**Description**: ${releaseDescription}\n\n`;
summary += `| Plugin | Version |\n| ----- | ----- |\n`;

const pluginVersionSids = {};

for (const [pluginName, pluginVer] of pluginVersions) {
  const verResponse = await asyncTwilioRequest(
    `${pluginServiceUrl}/Plugins/${pluginName}/Versions/${pluginVer}`,
    "GET"
  );
  pluginVersionSids[pluginName] = verResponse.body.sid;
  summary += `| **${pluginName}** | **${pluginVer}** |\n`;
}

try {
  const activeReleaseResponse = await asyncTwilioRequest(
    `${pluginServiceUrl}/Releases/Active`,
    "GET"
  );
  const activeConfigurationPluginsResponse = await asyncTwilioRequest(
    `${pluginServiceUrl}/Configurations/${activeReleaseResponse.body.configuration_sid}/Plugins`,
    "GET"
  );
  /** @type {Array} */
  const activePlugins = activeConfigurationPluginsResponse.body.plugins;
  for (const plugin of activePlugins) {
    if (!pluginVersionSids[plugin.unique_name]) {
      pluginVersionSids[plugin.unique_name] = plugin.plugin_version_sid;
      summary += `| ${plugin.unique_name} | ${plugin.version} |\n`;
    }
  }
} catch (err) {
  if (err.status === 404) {
    // continue;
  } else {
    throw err;
  }
}

const configurationPayload = new URLSearchParams({
  Name: releaseName,
});
if (releaseDescription) {
  configurationPayload.append("Description", releaseDescription);
}
for (const versionSid of Object.values(pluginVersionSids)) {
  configurationPayload.append(
    "Plugins",
    JSON.stringify({ plugin_version: versionSid })
  );
}

let newConfigurationSid;
try {
  const newConfigurationResponse = await asyncTwilioRequest(
    `${pluginServiceUrl}/Configurations`,
    "POST",
    configurationPayload
  );
  newConfigurationSid = newConfigurationResponse.body.sid;
} catch (err) {
  if (err.message?.includes("duplicate")) {
    console.log("::warning::Configuration is duplicate. Skipping release");
    process.exit(0);
  }
  throw err;
}

const newReleaseResponse = await asyncTwilioRequest(
  `${pluginServiceUrl}/Releases`,
  "POST",
  new URLSearchParams({
    ConfigurationId: newConfigurationSid,
  })
);
summary += `\n**Configuration Sid**: ${newConfigurationSid}\n\n**Release Sid**: ${newReleaseResponse.body.sid}\n`;

if (GITHUB_STEP_SUMMARY) {
  appendFileSync(GITHUB_STEP_SUMMARY, summary);
}

console.log(newReleaseResponse.body);
