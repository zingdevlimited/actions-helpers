import { appendFileSync } from "fs";
const {
  INPUT_TWILIO_AREA,
  INPUT_API_TYPE,
  INPUT_SEARCH_BY,
  INPUT_SEARCH_VALUE,
  INPUT_VERSION,
  INPUT_ALLOW_NO_RESULTS,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  GITHUB_OUTPUT,
} = process.env;

if (!INPUT_TWILIO_AREA?.trim()) {
  throw new Error("Missing Input TWILIO_AREA");
}
if (!INPUT_API_TYPE?.trim()) {
  throw new Error("Missing Input API_TYPE");
}

if (
  !INPUT_SEARCH_BY?.trim() &&
  (INPUT_TWILIO_AREA !== "taskrouter" || INPUT_API_TYPE !== "Workspaces")
) {
  throw new Error("Missing Input SEARCH_BY");
}
if (
  !INPUT_SEARCH_VALUE?.trim() &&
  (INPUT_TWILIO_AREA !== "taskrouter" || INPUT_API_TYPE !== "Workspaces")
) {
  throw new Error("Missing Input SEARCH_VALUE");
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
 * @param {"GET"} method
 * @param {number} retryNumber
 * @returns {Promise<response>}
 */
const asyncTwilioRequest = async (url, method, retryNumber = 0) => {
  try {
    console.log(`::debug::Request: ${method} ${url}`);
    const headers = {
      Authorization:
        "Basic " +
        Buffer.from(
          `${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`
        ).toString("base64"),
    };

    const req = await fetch(url, { method, headers });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error("Exceeded retry attempts after 429 errors");
      }
      const retryDelay = BASE_DELAY_MS * 2 ** retryNumber;
      console.log(`::debug::Rate-limit hit, retrying in ${retryDelay} ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return asyncTwilioRequest(url, method, retryNumber + 1);
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

const apiVersion = INPUT_VERSION || "v1";

let apiUrl;
if (INPUT_TWILIO_AREA === "taskrouter") {
  const workspaceListResp = await asyncTwilioRequest(
    `https://taskrouter.twilio.com/${apiVersion}/Workspaces`,
    "GET"
  );
  /** @type {Array} */
  const workspaceList = workspaceListResp.body.workspaces;
  if (!workspaceList.length) {
    throw new Error("No Taskrouter Workspaces found");
  }
  const workspaceSid = workspaceList[0].sid;
  if (INPUT_API_TYPE === "Workspaces" || INPUT_API_TYPE === "Workspace") {
    if (GITHUB_OUTPUT) {
      appendFileSync(GITHUB_OUTPUT, `SID=${workspaceSid}\n`);
    }
    process.exit(0);
  }

  apiUrl = `https://taskrouter.twilio.com/${apiVersion}/Workspaces/${workspaceSid}/${INPUT_API_TYPE}`;
} else {
  apiUrl = `https://${INPUT_TWILIO_AREA}.twilio.com/${apiVersion}/${INPUT_API_TYPE}`;
}

const listResp = await asyncTwilioRequest(apiUrl, "GET");
const keyName = listResp.body.meta.key;

/** @type {Array} */
const resourceList = listResp.body[keyName];

const matches = resourceList.filter(
  (r) => r[INPUT_SEARCH_BY ?? ""] === INPUT_SEARCH_VALUE
);

if (!matches.length) {
  if (INPUT_ALLOW_NO_RESULTS === "true") {
    console.log(
      `${INPUT_TWILIO_AREA} ${INPUT_API_TYPE} with ${INPUT_SEARCH_BY} '${INPUT_SEARCH_VALUE}' does not exist. Returning empty sid.`
    );
    process.exit(0);
  }
  console.error(
    `::error::${INPUT_TWILIO_AREA} ${INPUT_API_TYPE} with ${INPUT_SEARCH_BY} '${INPUT_SEARCH_VALUE}' does not exist.`
  );
  process.exit(1);
}

if (matches.length > 1) {
  console.error(
    `::error::Searching for ${INPUT_TWILIO_AREA} ${INPUT_API_TYPE} with ${INPUT_SEARCH_BY} '${INPUT_SEARCH_VALUE}' returned ${matches.length} results..`
  );
  process.exit(1);
}

if (GITHUB_OUTPUT) {
  appendFileSync(GITHUB_OUTPUT, `SID=${matches[0].sid}\n`);
}
