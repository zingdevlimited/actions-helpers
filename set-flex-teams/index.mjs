import { readFile } from "fs/promises";

const {
  INPUT_OVERWRITE,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_CONFIG_PATH,
} = process.env;

if (!INPUT_TWILIO_API_KEY || !INPUT_TWILIO_API_SECRET || !INPUT_CONFIG_PATH) {
  console.error("TWILIO_API_SECRET or TWILIO_API_KEY missing or CONFIG_PATH");
  process.exit(-1);
}

const jsonText = await readFile(INPUT_CONFIG_PATH, "utf-8");
const requiredTeams = JSON.parse(jsonText).teams;
const BASE_URL = "https://flex-api.twilio.com/v1";
const MAX_RETRY_COUNT = 3;
const BASE_DELAY_MS = 2000;

/**
 * Generic Twilio request handler with retry logic.
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

    let body = undefined;
    if (bodyParams) {
      const undefinedParams = [];
      for (const [key, value] of Object.entries(bodyParams)) {
        if (value === undefined) {
          undefinedParams.push(key);
        }
      }
      for (const key of undefinedParams) {
        delete bodyParams[key];
      }
      body = new URLSearchParams(bodyParams).toString();
    }

    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(body ?? "");
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

    let responseBody = null;
    if (req.status !== 204) {
      const text = await req.text();
      responseBody = text ? JSON.parse(text) : null;
    }

    return {
      body: responseBody,
      status: req.status,
      ok,
    };
  } catch (err) {
    throw err;
  }
};

const instance = await asyncTwilioRequest(`${BASE_URL}/Configuration`, "GET");

if (!instance.body.flex_instance_sid) {
  console.error("Flex instance sid not found");
  process.exit(-1);
}

const instanceSid = instance.body.flex_instance_sid;
const levels = [3, 2, 1];

const teamsJson = await asyncTwilioRequest(
  `${BASE_URL}/Instances/${instanceSid}/Teams?PageSize=1000`,
  "GET"
);

const fetchedTeams = teamsJson.body.teams;

if (INPUT_OVERWRITE?.toLowerCase() === "true") {
  for (const level of [1, 2, 3]) {
    const teamsAtLevel = fetchedTeams.filter((t) => t.level === level);
    const requiredTeamNamesAtLevel = requiredTeams.filter((t) => t.level === level);

    for (const team of teamsAtLevel) {
      if (team.friendly_name === "default") {
        console.log(`::debug::Skipping default team: ${team.friendly_name}`);
        continue;
      }

      if (!requiredTeamNamesAtLevel.some((t) => t.friendlyName === team.friendly_name)) {
        console.log(
          `::debug::Deleting team: ${team.friendly_name} (Level ${level})`
        );
        await asyncTwilioRequest(
          `${BASE_URL}/Instances/${instanceSid}/Teams/${team.team_sid}`,
          "DELETE"
        );
      } else {
        console.log(
          `::debug::Deleting team: ${team.friendly_name} (Level ${level})`
        );
      }
    }
  }
  fetchedTeams.length = 0;
}

for (const level of levels) {
  const teamsAtLevel = requiredTeams.filter((team) => team.level === level);

  for (const requiredTeam of teamsAtLevel) {
    const exists = fetchedTeams.some(
      (fetchedTeam) => fetchedTeam.friendly_name === requiredTeam.friendlyName
    );
    if (!exists) {
      // Team does not exist, create
      console.log(
        `::debug::Creating team: ${requiredTeam.friendlyName} (Level ${level})`
      );

      const body = {
        FriendlyName: requiredTeam.friendlyName,
        Description: requiredTeam.description,
        Level: level,
      };

      if (level < 3 && requiredTeam.parentTeam) {
        const parentTeam = fetchedTeams.find(
          (team) => team.friendly_name === requiredTeam.parentTeam
        );
        if (parentTeam) {
          body["ParentTeamSid"] = parentTeam.team_sid;
        }
      }

      const createdTeam = await asyncTwilioRequest(
        `${BASE_URL}/Instances/${instanceSid}/Teams`,
        "POST",
        // @ts-ignore
        body
      );

      fetchedTeams.push(createdTeam.body);
    } else {
      console.log(
        `::debug::Skipping creation: Team ${requiredTeam.friendly_name} (Level ${level}) already exists`
      );
    }
  }
}

process.exit(0);
