import { appendFileSync } from "fs";

const {
  INPUT_SERVICE_NAME,
  INPUT_ENVIRONMENT_SUFFIX,
  INPUT_VARIABLES_ENV,
  INPUT_OPTIONAL_VARIABLES,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  GITHUB_STEP_SUMMARY,
} = process.env;

if (!INPUT_SERVICE_NAME?.trim()) {
  throw new Error("Missing Input SERVICE_NAME");
}
if (!INPUT_VARIABLES_ENV?.trim()) {
  throw new Error("Missing Input VARIABLES_ENV");
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
 * @param {"GET" | "POST" | "DELETE"} method
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
      throw new Error(`Error Response: ${await req.text()}`);
    }

    let responseBody;
    if (req.headers.get("Content-Type")?.startsWith("application/json") && req.status !== 204) {
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

const optionalVariables =
  INPUT_OPTIONAL_VARIABLES?.replace(/\s/g, "")
    ?.split(",")
    ?.filter((v) => !!v)
    ?.map((v) => v) ?? [];

const variablesToSet = {};
const missingVariables = [];
for (const [ind, line] of INPUT_VARIABLES_ENV.split("\n").entries()) {
  if (!line?.trim()) continue;
  const splitter = line.indexOf("=");
  if (splitter < 0) {
    throw new Error(
      `Invalid key-value pair assignment on line ${ind + 1}. '=' not found.`
    );
  }
  const key = line.substring(0, splitter).trim();
  const value = line.substring(splitter + 1).trim();

  if (value) {
    variablesToSet[key] = value;
  } else if (!optionalVariables.includes(key)) {
    missingVariables.push(key);
  }
}

if (missingVariables.length) {
  throw new Error(
    `Empty value for required Variables: ${missingVariables}. Please provide a value or mark as optional`
  );
}

const serverlessBaseUrl = "https://serverless.twilio.com/v1/Services";
const service = await asyncTwilioRequest(
  `${serverlessBaseUrl}/${INPUT_SERVICE_NAME}`,
  "GET"
);
const serviceSid = service.body.sid;
console.log(`Service Sid: ${serviceSid}`);

const environmentListResp = await asyncTwilioRequest(
  `${serverlessBaseUrl}/${serviceSid}/Environments`,
  "GET"
);
/** @type {Array} */
const environmentList = environmentListResp.body.environments;
const environment = environmentList.find(
  (e) => e.domain_suffix === (INPUT_ENVIRONMENT_SUFFIX ?? null)
);
if (!environment) {
  throw new Error(
    `Environment with the provided suffix ${
      INPUT_ENVIRONMENT_SUFFIX ?? "null"
    } does not exist.`
  );
}
const environmentSid = environment.sid;
console.log(`Environment Sid: ${environmentSid}`);

const variableListResp = await asyncTwilioRequest(
  `${serverlessBaseUrl}/${serviceSid}/Environments/${environmentSid}/Variables`,
  "GET"
);
/** @type {Array} */
const variableList = variableListResp.body.variables;

/**
 * @typedef VarMapping
 * @property {string} sid
 * @property {string} value
 */
/** @type {Record<string, VarMapping>} */
const currentlySetVariables = variableList.reduce(
  (prev, curr) => ({
    ...prev,
    [curr.key]: { sid: curr.sid, value: curr.value },
  }),
  {}
);

if (GITHUB_STEP_SUMMARY) {
  appendFileSync(
    GITHUB_STEP_SUMMARY,
    `## Updated Variables for ${INPUT_SERVICE_NAME} ${
      INPUT_ENVIRONMENT_SUFFIX ?? "production"
    }\n`
  );
}

const variablesBaseUrl = `${serverlessBaseUrl}/${serviceSid}/Environments/${environmentSid}/Variables`;
for (const [variable, value] of Object.entries(variablesToSet)) {
  let outcome;
  const bodyParams = new URLSearchParams({
    Key: variable,
    Value: value,
  });
  if (currentlySetVariables[variable]) {
    if (currentlySetVariables[variable].value === value) {
      console.log(`Variable '${variable}' has the same value. Skipping`);
      outcome = "unchanged";
    } else {
      const res = await asyncTwilioRequest(
        `${variablesBaseUrl}/${currentlySetVariables[variable].sid}`,
        "POST",
        bodyParams
      );
      console.log(
        `~ Updated Environment Variable '${variable}' (${res.body.sid})`
      );
      outcome = "updated";
    }
  } else {
    const res = await asyncTwilioRequest(variablesBaseUrl, "POST", bodyParams);
    console.log(
      `+ Created Environment Variable '${variable}' (${res.body.sid})`
    );
    outcome = "created";
  }

  if (GITHUB_STEP_SUMMARY) {
    appendFileSync(GITHUB_STEP_SUMMARY, `- ${variable}: \`${outcome}\`\n`);
  }
}

const variablesToSetKeys = Object.keys(variablesToSet);
const toDelete = Object.entries(currentlySetVariables).filter(
  ([key]) => !variablesToSetKeys.includes(key) && !optionalVariables.includes(key)
);

for (const [key, { sid }] of toDelete) {
  try {
    await asyncTwilioRequest(`${variablesBaseUrl}/${sid}`, "DELETE");
    console.log(`- Deleted Environment Variable '${key}' (${sid})`);
    if (GITHUB_STEP_SUMMARY) {
      appendFileSync(GITHUB_STEP_SUMMARY, `- ~~${key}~~: \`deleted\`\n`);
    }
  } catch (err) {
    if (err.status === 404) continue;
    throw err;
  }
}
