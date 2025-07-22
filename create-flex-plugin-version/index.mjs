import { appendFileSync } from "fs";

const {
  INPUT_PLUGIN_NAME,
  INPUT_PLUGIN_VERSION,
  INPUT_ASSET_URL,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  GITHUB_STEP_SUMMARY,
  GITHUB_OUTPUT,
} = process.env;

if (!INPUT_PLUGIN_NAME?.trim()) {
  throw new Error("Missing Input PLUGIN_NAME");
}
if (!INPUT_PLUGIN_VERSION?.trim()) {
  throw new Error("Missing Input PLUGIN_VERSION");
}
if (!INPUT_ASSET_URL?.trim()) {
  throw new Error("Missing Input ASSET_URL");
}
if (!INPUT_TWILIO_API_KEY?.trim()) {
  throw new Error("Missing Input TWILIO_API_KEY");
}
if (!INPUT_TWILIO_API_SECRET?.trim()) {
  throw new Error("Missing Input TWILIO_API_SECRET");
}

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

let pluginResponse;
try {
  pluginResponse = await asyncTwilioRequest(
    `${pluginServiceUrl}/Plugins/${INPUT_PLUGIN_NAME}`,
    "GET"
  );
} catch (err) {
  if (err.status === 404) {
    console.log("Plugin not found, creating...");
    pluginResponse = await asyncTwilioRequest(
      `${pluginServiceUrl}/Plugins`,
      "POST",
      new URLSearchParams({
        UniqueName: INPUT_PLUGIN_NAME,
        FriendlyName: INPUT_PLUGIN_NAME,
      })
    );
  } else {
    throw err;
  }
}

const pluginSid = pluginResponse.body.sid;

try {
  const existingPluginVersionResponse = await asyncTwilioRequest(
    `${pluginServiceUrl}/Plugins/${pluginSid}/Versions/${INPUT_PLUGIN_VERSION}`,
    "GET"
  );
  console.log(
    `::warning::Plugin Version ${INPUT_PLUGIN_NAME}@${INPUT_PLUGIN_VERSION} already exists. (${existingPluginVersionResponse.body.sid}). Skipping creation.`
  );
  if (GITHUB_OUTPUT) {
    appendFileSync(
      GITHUB_OUTPUT,
      `PLUGIN_VERSION_SID=${existingPluginVersionResponse.body.sid}`
    );
  }
} catch (err) {
  if (err.status === 404) {
    const createPluginVersionResponse = await asyncTwilioRequest(
      `${pluginServiceUrl}/Plugins/${pluginSid}/Versions`,
      "POST",
      new URLSearchParams({
        Version: INPUT_PLUGIN_VERSION,
        PluginUrl: INPUT_ASSET_URL,
        Private: "True",
      })
    );

    if (GITHUB_OUTPUT) {
      appendFileSync(
        GITHUB_OUTPUT,
        `PLUGIN_VERSION_SID=${createPluginVersionResponse.body.sid}`
      );
    }

    const versionUrl = createPluginVersionResponse.body.url;

    console.log(`✅ Plugin version ${INPUT_PLUGIN_NAME}@${INPUT_PLUGIN_VERSION} has been created.\nRelease this update to Flex: https://flex.twilio.com/admin/plugins/custom`);

    if (GITHUB_STEP_SUMMARY) {
      appendFileSync(GITHUB_STEP_SUMMARY, `## Created Plugin Version ${INPUT_PLUGIN_NAME}@${INPUT_PLUGIN_VERSION}\n`);
      appendFileSync(GITHUB_STEP_SUMMARY, `**Bundle URL**: ${INPUT_ASSET_URL}\n\n`);
      appendFileSync(GITHUB_STEP_SUMMARY, `**Version URL**: ${versionUrl}\n\n`);
      appendFileSync(GITHUB_STEP_SUMMARY, `**Version Sid**: ${createPluginVersionResponse.body.sid}\n\n`);
    }
  } else {
    throw err;
  }
}
