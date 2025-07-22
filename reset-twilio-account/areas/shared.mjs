import { env } from "process";

const { INPUT_TWILIO_API_KEY, INPUT_TWILIO_API_SECRET } = env;

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
 * @param {"GET" | "POST" | "DELETE"} method
 * @param {URLSearchParams | undefined} bodyParams
 * @param {number} retryNumber
 * @returns {Promise<response>}
 */
export const asyncTwilioRequest = async (
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

const nameMatch = (remoteItem, defaultItem) =>
  (remoteItem.unique_name &&
    remoteItem.unique_name === defaultItem.UniqueName) ||
  (remoteItem.friendly_name &&
    remoteItem.friendly_name === defaultItem.FriendlyName);

/**
 * @typedef Options
 * @property {boolean} [skipCreate]
 * @property {boolean} [skipUpdate]
 * @property {boolean} [skipDelete]
 *
 * @param {string} baseUrl
 * @param {string} resourceType
 * @param {Array<Object>} defaults
 * @param {Options | null} options
 */
export const listDeleteUpdateCreate = async (
  baseUrl,
  resourceType,
  defaults,
  options = null
) => {
  const listResp = await asyncTwilioRequest(
    `${baseUrl}/${resourceType}`,
    "GET"
  );
  /** @type {array} */
  const list = listResp.body[listResp.body.meta.key];

  if (!options?.skipDelete) {
    const toDelete = list
      .filter((item) => !defaults.some((def) => nameMatch(item, def)))
      .map((item) =>
        asyncTwilioRequest(`${baseUrl}/${resourceType}/${item.sid}`, "DELETE")
      );
    await Promise.all(toDelete);
  }

  if (!options?.skipUpdate) {
    const toUpdate = defaults
      .map((def) => [list.find((item) => nameMatch(item, def)), def])
      .filter(([item]) => item !== undefined)
      .map(([item, def]) => {
        if (def.UniqueName) {
          delete def.UniqueName;
        }
        return asyncTwilioRequest(
          `${baseUrl}/${resourceType}/${item.sid}`,
          "POST",
          new URLSearchParams(def)
        );
      });
    await Promise.all(toUpdate);
  }

  if (!options?.skipCreate) {
    const toCreate = defaults
      .filter((def) => !list.some((item) => nameMatch(item, def)))
      .map((def) =>
        asyncTwilioRequest(
          `${baseUrl}/${resourceType}`,
          "POST",
          new URLSearchParams(def)
        )
      );
    await Promise.all(toCreate);
  }
};

export const getResourceSid = async (baseUrl, resourceType, friendlyName) => {
  const listResponse = await asyncTwilioRequest(
    `${baseUrl}/${resourceType}`,
    "GET"
  );
  /** @type {array} */
  const items = listResponse.body[listResponse.body.meta.key];
  return items.find(
    (i) => i.friendly_name === friendlyName || i.unique_name === friendlyName
  )?.sid;
};
