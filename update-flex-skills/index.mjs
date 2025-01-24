const {
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_MODE,
  INPUT_SIMPLE_SKILLS,
  INPUT_COMPLEX_SKILLS
} = process.env;

if (!INPUT_SIMPLE_SKILLS?.trim() && !INPUT_COMPLEX_SKILLS?.trim()) {
  throw new Error("Require either Input SIMPLE_SKILLS or COMPLEX_SKILLS");
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
 * @param {object} bodyJson 
 * @param {number} retryNumber 
 * @returns {Promise<response>}
 */
const asyncTwilioJsonRequest = async (url, method, bodyJson = undefined, retryNumber = 0) => {
  try {
    console.log(`::debug::Request: ${method} ${url}`);
    const headers = {
      "Authorization": "Basic " + Buffer.from(`${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`).toString("base64")
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

    if (method === "POST") {
      headers["Content-Type"] = "application/json"; // Requires JSON unlike other Twilio endpoints
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = await fetch(url, { method, headers, body });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error("Exceeded retry attempts after 429 errors");
      }
      const retryDelay = BASE_DELAY_MS * (2 ** retryNumber);
      console.log(`::debug::Rate-limit hit, retrying in ${retryDelay} ms...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return asyncTwilioJsonRequest(url, method, bodyParams, retryNumber + 1);
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
      ok
    };
  } catch (err) {
    console.error(`::error::${err.message}`);
    process.exit(1);
  }
}


const flexConfigurationUrl = "https://flex-api.twilio.com/v1/Configuration";

const currentFlexConfigResponse = await asyncTwilioJsonRequest(flexConfigurationUrl, "GET");
const currentFlexConfig = currentFlexConfigResponse.body;

let skillsArray = currentFlexConfig.taskrouter_skills;
const twilioAccountSid = currentFlexConfig.account_sid;

if (!skillsArray || INPUT_MODE === "replace") {
  skillsArray = [];
}

if (INPUT_SIMPLE_SKILLS) {
  for (const line of INPUT_SIMPLE_SKILLS.split("\n")) {
    const skillName = line.trim();
    if (!line) {
      continue;
    }
    if (!skillsArray.some((x) => x.name === skillName)) {
      skillsArray.push({
        name: skillName,
        multivalue: false,
        minimum: null,
        maximum: null
      });
    }
  }
}
if (INPUT_COMPLEX_SKILLS) {
  const complexArray = JSON.parse(INPUT_COMPLEX_SKILLS);
  if (!Array.isArray(complexArray)) {
    throw new Error("Input COMPLEX_SKILLS must be a valid JSON array");
  }
  const filteredComplexArray = complexArray.filter((x) => !skillsArray.some((y) => y.name === x.name));
  skillsArray.push(...filteredComplexArray);
}

console.log(`::debug::${JSON.stringify(skillsArray, undefined, 2)}`);

await asyncTwilioJsonRequest(
  flexConfigurationUrl,
  "POST", 
  {
    account_sid: twilioAccountSid,
    taskrouter_skills: skillsArray
  }
);