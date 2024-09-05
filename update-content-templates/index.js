const readFileSync = require("fs").readFileSync;
const appendFileSync = require("fs").appendFileSync;

const {
  INPUT_CONFIG_PATH,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  GITHUB_OUTPUT,
} = process.env;

if (!INPUT_CONFIG_PATH?.trim()) {
  throw new Error("Missing Input CONFIG_PATH");
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
 * @param {object} requestBody
 * @param {number} retryNumber
 * @returns {Promise<response>}
 */
const asyncTwilioRequest = async (
  url,
  method,
  requestBody = undefined,
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
    if (requestBody) {
      body = JSON.stringify({ ...requestBody });
    }

    if (method === "POST") {
      headers["Content-Type"] = "application/json";
    }

    const req = await fetch(url, { method, headers, body });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error("Exceeded retry attempts after 429 errors");
      }
      const retryDelay = BASE_DELAY_MS * 2 ** retryNumber;
      console.log(`::debug::Rate-limit hit, retrying in ${retryDelay} ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return asyncTwilioRequest(url, method, requestBody, retryNumber + 1);
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
    throw err;
    // return { body: undefined, status: 500, ok: false };
  }
};

const configFile = JSON.parse(readFileSync(INPUT_CONFIG_PATH, "utf8"));

const contentUrl = "https://content.twilio.com/v1/Content";

const run = async () => {
  const contentListResp = await asyncTwilioRequest(
    contentUrl,
    "GET"
  );
  /** @type {array} */
  const contentList = contentListResp.body.contents;

  const results = {
    templates: {},
  };

  for (const template of configFile.templates ?? []) {
    const existing = contentList.find(
      (c) =>
        c.friendly_name.toLowerCase() === template.friendly_name.toLowerCase() &&
        c.language.toLowerCase() === template.language.toLowerCase()
    );
    // Only Create is allowed. You cannot update a Content Templates configuration
    if (!existing) {
      const response = await asyncTwilioRequest(
        contentUrl,
        "POST",
        template
      );

      console.log(`Content Template ${template.friendly_name} (${template.language}) ${response.body.sid}`);

      if (!results.templates[template.language]) {
        results.templates[template.language] = {};
      }
      results.templates[template.language][template.friendly_name] = response.body;
      contentList.push(response.body);
    } else {
      console.log(`Content Template ${template.friendly_name} (${template.language}) ${existing.sid}`);

      if (!results.templates[template.language]) {
        results.templates[template.language] = {};
      }
      results.templates[template.language][template.friendly_name] = existing;
    }
  }

  const resultsJson = JSON.stringify(results);

  appendFileSync(GITHUB_OUTPUT, `RESOURCES=${resultsJson}\n`, "utf8");
};

run();
