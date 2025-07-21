import { appendFileSync } from "fs";
import { exit } from "process";
const {
  INPUT_SERVICE_NAME,
  INPUT_ENVIRONMENT_SUFFIX,
  INPUT_IGNORE_NOT_FOUND,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  GITHUB_OUTPUT,
} = process.env;

if (!INPUT_SERVICE_NAME?.trim()) {
  throw new Error("Missing Input SERVICE_NAME");
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

const environmentSuffix = INPUT_ENVIRONMENT_SUFFIX?.toLowerCase() || null;
const serverlessBaseUrl = "https://serverless.twilio.com/v1/Services";

let serviceSid;
try {
  const serviceRes = await asyncTwilioRequest(
    `${serverlessBaseUrl}/${INPUT_SERVICE_NAME}`,
    "GET"
  );
  serviceSid = serviceRes.body.sid;
} catch (err) {
  if (err.status === 404 && INPUT_IGNORE_NOT_FOUND === "true") {
    exit(0);
  }
  throw err;
}

const environmentListResp = await asyncTwilioRequest(
  `${serverlessBaseUrl}/${serviceSid}/Environments`,
  "GET"
);
/** @type {Array} */
const environmentList = environmentListResp.body.environments;
let environment = environmentList.find(
  (e) => e.domain_suffix === (environmentSuffix || null)
);

if (!environment && INPUT_IGNORE_NOT_FOUND !== "true") {
  console.error(
    `::error::Service ${INPUT_SERVICE_NAME} (${serviceSid}) does not have Environment with suffix ${environmentSuffix}`
  );
  process.exit(1);
}

if (GITHUB_OUTPUT) {
  appendFileSync(
    GITHUB_OUTPUT,
    `SERVICE_SID=${serviceSid}\n` +
      `ENVIRONMENT_SID=${environment?.sid}\n` +
      `BUILD_SID=${environment?.build_sid}\n` +
      `BASE_URL=https://${environment?.domain_name}\n`
  );
}
