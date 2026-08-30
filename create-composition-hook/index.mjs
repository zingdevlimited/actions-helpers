import { appendFileSync, readFileSync } from "fs";

const MAX_RETRY_COUNT = 3;
const BASE_DELAY_MS = 2000;

const checkInputs = (/** @type {string[]} */ ...inputs) => {
  let missing = false;
  /** @type {Object.<string, string>} */
  const output = {};

  for (const input of inputs) {
    if (!process.env[`INPUT_${input}`]?.trim()) {
      console.error(`::error::Missing input ${input}`);
      missing = true;
    } else {
      output[input] = process.env[`INPUT_${input}`]?.trim() ?? "";
    }
  }

  if (missing) {
    process.exit(1);
  }

  return output;
};

const { CONFIG_PATH, TWILIO_API_KEY, TWILIO_API_SECRET } = checkInputs(
  "CONFIG_PATH",
  "TWILIO_API_KEY",
  "TWILIO_API_SECRET",
);

/**
 * @typedef response
 * @property {object} body
 * @property {number} status
 * @property {boolean} ok
 *
 * @param {string} url
 * @param {"GET" | "POST" | "DELETE"} method
 * @param {URLSearchParams | FormData | undefined} bodyParams
 * @param {number} retryNumber
 * @returns {Promise<response>}
 */
const asyncTwilioRequest = async (
  url,
  method,
  bodyParams = undefined,
  retryNumber = 0,
) => {
  try {
    console.log(`::debug::Request: ${method} ${url}`);
    const headers = {
      Authorization:
        "Basic " +
        Buffer.from(`${TWILIO_API_KEY}:${TWILIO_API_SECRET}`).toString(
          "base64",
        ),
    };

    let body = undefined;
    if (bodyParams instanceof FormData) {
      // Used for composition hooks, don't support partial updates
      body = bodyParams;
    } else if (bodyParams) {
      const undefinedParams = [];
      for (const [key, value] of bodyParams.entries()) {
        if (value === undefined || value === "undefined") {
          undefinedParams.push(key);
        }
      }
      for (const key of undefinedParams) {
        bodyParams.delete(key);
      }
      body = bodyParams.toString();
    }

    if (method === "POST" && bodyParams instanceof URLSearchParams) {
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
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return asyncTwilioRequest(url, method, bodyParams, retryNumber + 1);
    }

    console.log(`::debug::Status: ${req.status} ${req.statusText}`);

    const ok = req.status >= 200 && req.status < 300;
    if (!ok) {
      throw { message: await req.text(), status: req.status };
    }

    let responseBody;
    if (
      req.headers.get("Content-Type")?.startsWith("application/json") &&
      req.status !== 204
    ) {
      responseBody = await req.json();
    } else {
      responseBody = {};
    }

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

const configFile = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));

const videoUrl = "https://video.twilio.com/v1";
// Request JSON format differs from the returned format, so this will be used as default if needed
const defaultVideoLayout = {
  grid: {
    video_sources: ["*"],
  },
};

const compositionHooksResponse = await asyncTwilioRequest(
  `${videoUrl}/CompositionHooks?PageSize=1&FriendlyName=${encodeURIComponent(configFile.hook.friendlyName)}`,
  "GET",
);
/** @type {array} */
const compositionHooksList =
  compositionHooksResponse.body?.composition_hooks || [];

let currentCompositionHook;

const existing = compositionHooksList[0];

if (existing) {
  currentCompositionHook = existing;

  // Can't reliably compare video layout due to differing format, always do update (no partials allowed)
  const updateParams = new FormData();
  updateParams.append("FriendlyName", configFile.hook.friendlyName);
  updateParams.append(
    "Format",
    configFile.hook.format || currentCompositionHook.format,
  );
  updateParams.append(
    "Resolution",
    configFile.hook.resolution || currentCompositionHook.resolution,
  );
  updateParams.append("Enabled", "true");
  updateParams.append(
    "VideoLayout",
    JSON.stringify(configFile.hook.videoLayout || defaultVideoLayout),
  );
  if (configFile.hook.audioSources === undefined) {
    updateParams.append("AudioSources", "*");
  } else if (configFile.hook.audioSources.length === 0) {
    updateParams.append("AudioSources", "");
  } else {
    for (const source of configFile.hook.audioSources) {
      updateParams.append(
        "AudioSources",
        source,
      );
    }
  }
  if (configFile.hook.audioSourcesExcluded?.length === 0) {
    updateParams.append("AudioSourcesExcluded", "");
  } else {
    for (const source of configFile.hook.audioSourcesExcluded) {
      updateParams.append(
        "AudioSourcesExcluded",
        source,
      );
    }
  }
  updateParams.append(
    "StatusCallback",
    configFile.hook.statusCallback || currentCompositionHook.status_callback,
  );
  updateParams.append(
    "StatusCallbackMethod",
    configFile.hook.statusCallbackMethod ||
      currentCompositionHook.status_callback_method ||
      "POST",
  );
  updateParams.append(
    "Trim",
    configFile.hook.trim !== undefined
      ? String(configFile.hook.trim)
      : currentCompositionHook.trim !== undefined
      ? String(currentCompositionHook.trim)
      : "true",
  );

  const updatedHookResponse = await asyncTwilioRequest(
    `${videoUrl}/CompositionHooks/${currentCompositionHook.sid}`,
    "POST",
    updateParams,
  );
  currentCompositionHook = updatedHookResponse.body;
  console.log(
    `Updated existing Composition Hook "${configFile.hook.friendlyName}" (${currentCompositionHook.sid})`,
  );
} else {
  const createParams = new FormData();
  createParams.append("FriendlyName", configFile.hook.friendlyName);
  createParams.append("Enabled", "true");
  createParams.append("AudioSources", "*");
  createParams.append("Format", configFile.hook.format || "mp4");
  createParams.append("Resolution", configFile.hook.resolution || "640x480");
  createParams.append(
    "VideoLayout",
    JSON.stringify(configFile.hook.videoLayout || defaultVideoLayout),
  );
  if (configFile.hook.audioSources === undefined) {
    createParams.append("AudioSources", "*");
  } else if (configFile.hook.audioSources.length === 0) {
    createParams.append("AudioSources", "");
  } else {
    for (const source of configFile.hook.audioSources) {
      createParams.append(
        "AudioSources",
        source,
      );
    }
  }
  if (configFile.hook.audioSourcesExcluded?.length === 0) {
    createParams.append("AudioSourcesExcluded", "");
  } else {
    for (const source of configFile.hook.audioSourcesExcluded) {
      createParams.append(
        "AudioSourcesExcluded",
        source,
      );
    }
  }
  createParams.append(
    "StatusCallback",
    configFile.hook.statusCallback || "",
  );
  createParams.append(
    "StatusCallbackMethod",
    configFile.hook.statusCallbackMethod ||
      "POST",
  );
  createParams.append(
    "Trim",
    configFile.hook.trim !== undefined
      ? String(configFile.hook.trim)
      : "true",
  );

  const compositionHookCreateResponse = await asyncTwilioRequest(
    `${videoUrl}/CompositionHooks`,
    "POST",
    createParams,
  );

  currentCompositionHook = compositionHookCreateResponse.body;
  console.log(
    `Created Composition Hook "${configFile.hook.friendlyName}" (${currentCompositionHook.sid})`,
  );
}

const { GITHUB_OUTPUT } = process.env;

if (GITHUB_OUTPUT) {
  appendFileSync(
    GITHUB_OUTPUT,
    `COMPOSITION_HOOK_SID=${currentCompositionHook.sid}\n`,
    "utf8",
  );
}
