import {
  appendFileSync,
  readdirSync,
  existsSync,
  statSync,
  readFileSync,
} from "fs";
import path from "path";
const {
  INPUT_SERVICE_NAME,
  INPUT_ENVIRONMENT_NAME,
  INPUT_ENVIRONMENT_SUFFIX,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_ASSETS_DIRECTORY,
  INPUT_UI_EDITABLE,
  GITHUB_STEP_SUMMARY,
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
if (!INPUT_ASSETS_DIRECTORY?.trim()) {
  throw new Error("Missing Input INPUT_ASSETS_DIRECTORY");
}

if (!existsSync(INPUT_ASSETS_DIRECTORY)) {
  throw new Error(
    `Path '${INPUT_ASSETS_DIRECTORY}' does not exist. Are you missing a checkout?`
  );
}
if (!statSync(INPUT_ASSETS_DIRECTORY).isDirectory()) {
  throw new Error(`Path '${INPUT_ASSETS_DIRECTORY}' is not a directory.`);
}

const mimeTypesFetch = await fetch(
  "https://raw.githubusercontent.com/jshttp/mime-db/refs/tags/v1.54.0/db.json"
);
const mimeTypes = Object.entries(await mimeTypesFetch.json());

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
 * @param {FormData | undefined} formData
 * @param {number} retryNumber
 * @returns {Promise<response>}
 */
const asyncTwilioRequest = async (
  url,
  method,
  bodyParams = undefined,
  formData = undefined,
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
    if (formData) {
      body = formData;
    }

    if (method === "POST" && bodyParams && body) {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(
        /** @type {string} */ (body)
      );
    }
    const req = await fetch(url, { method, headers, body });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error("Exceeded retry attempts after 429 errors");
      }
      const retryDelay = BASE_DELAY_MS * 2 ** retryNumber;
      console.log(`::debug::Rate-limit hit, retrying in ${retryDelay} ms...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return asyncTwilioRequest(
        url,
        method,
        bodyParams,
        formData,
        retryNumber + 1
      );
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

const environmentName =
  INPUT_ENVIRONMENT_NAME || INPUT_ENVIRONMENT_SUFFIX || "production";
const environmentSuffix =
  INPUT_ENVIRONMENT_SUFFIX?.toLowerCase() ||
  INPUT_ENVIRONMENT_NAME?.toLowerCase() ||
  null;

const assetFileList = /** @type {string[]} */ (
  readdirSync(INPUT_ASSETS_DIRECTORY, { recursive: true, withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) =>
      path.relative(
        INPUT_ASSETS_DIRECTORY,
        path.join(dirent.parentPath, dirent.name)
      )
    )
);

if (!assetFileList.length) {
  throw new Error(
    `No files found in the directory '${INPUT_ASSETS_DIRECTORY}'.`
  );
}

const serverlessBaseUrl = "https://serverless.twilio.com/v1/Services";

let serviceSid;
try {
  const serviceRes = await asyncTwilioRequest(
    `${serverlessBaseUrl}/${INPUT_SERVICE_NAME}`,
    "GET"
  );
  serviceSid = serviceRes.body.sid;
} catch (err) {
  if (err.status === 404) {
    const serviceRes = await asyncTwilioRequest(
      `${serverlessBaseUrl}`,
      "POST",
      new URLSearchParams({
        UniqueName: INPUT_SERVICE_NAME,
        FriendlyName: INPUT_SERVICE_NAME,
        IncludeCredentials: "false",
        UiEditable: (INPUT_UI_EDITABLE === "true").toString(),
      })
    );
    serviceSid = serviceRes.body.sid;

    console.log(`Created Service ${INPUT_SERVICE_NAME} (${serviceSid})`);
  } else {
    throw err;
  }
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

if (!environment) {
  const urlParams = new URLSearchParams({
    UniqueName: environmentName,
  });
  if (environmentSuffix) {
    urlParams.append("DomainSuffix", environmentSuffix);
  }

  const environmentRes = await asyncTwilioRequest(
    `${serverlessBaseUrl}/${serviceSid}/Environments`,
    "POST",
    urlParams
  );

  environment = environmentRes.body;
  console.log(
    `Created Environment ${environmentName} with suffix ${environmentSuffix} (${environment.sid})`
  );
}

const listAssetsResp = await asyncTwilioRequest(
  `${serverlessBaseUrl}/${serviceSid}/Assets`,
  "GET"
);

/** @type {Array} */
const assetList = listAssetsResp.body.assets;

const assetsToUpdate = [];

for (const assetFile of assetFileList) {
  const content = readFileSync(`${INPUT_ASSETS_DIRECTORY}/${assetFile}`);
  let assetPath = path.join("/", assetFile);
  let visibility = "public";

  if (assetPath.includes(".private")) {
    visibility = "private";
    assetPath = assetPath.replace(".private", "");
  } else if (assetPath.includes(".protected")) {
    visibility = "protected";
    assetPath = assetPath.replace(".protected", "");
  }

  const existing = assetList.find((a) => a.friendly_name === assetPath);
  if (existing) {
    assetsToUpdate.push({
      sid: existing.sid,
      name: assetPath,
      content,
      visibility,
    });
  } else {
    const assetCreateResp = await asyncTwilioRequest(
      `${serverlessBaseUrl}/${serviceSid}/Assets`,
      "POST",
      new URLSearchParams({ FriendlyName: assetPath })
    );
    assetsToUpdate.push({
      sid: assetCreateResp.body.sid,
      name: assetPath,
      content,
      visibility,
    });

    console.log(
      `Created Asset Resource ${assetPath} (${assetCreateResp.body.sid})`
    );
  }
}

if (GITHUB_STEP_SUMMARY) {
  appendFileSync(
    GITHUB_STEP_SUMMARY,
    `## Deployed Assets to ${INPUT_SERVICE_NAME} ${environmentName}\n\n` +
      `| Path | Type | Visibility |\n` +
      `| --- | --- | --- |\n`
  );
}

const buildParams = new URLSearchParams();

for (const asset of assetsToUpdate) {
  const ext = asset.name.split(".").at(-1);
  const mimeTypeLookup = mimeTypes.find(([, properties]) =>
    properties.extensions?.includes(ext)
  );

  const mimeType = mimeTypeLookup?.[0] ?? "text/plain";
  const formData = new FormData();
  formData.set("Path", asset.name);
  formData.set("Visibility", asset.visibility);
  formData.set(
    "Content",
    new Blob([asset.content], { type: mimeType }),
    asset.name
  );

  const uploadRes = await asyncTwilioRequest(
    `https://serverless-upload.twilio.com/v1/Services/${serviceSid}/Assets/${asset.sid}/Versions`,
    "POST",
    undefined,
    formData
  );
  console.log(
    `Uploaded ${asset.visibility} asset version '${asset.name}' (${uploadRes.body.sid})`
  );
  buildParams.append("AssetVersions", uploadRes.body.sid);

  if (GITHUB_STEP_SUMMARY) {
    appendFileSync(
      GITHUB_STEP_SUMMARY,
      `| ${asset.name} | ${mimeType} | ${asset.visibility} |\n`
    );
  }
}

const build = await asyncTwilioRequest(
  `${serverlessBaseUrl}/${serviceSid}/Builds`,
  "POST",
  buildParams
);
const buildSid = build.body.sid;
let buildStatus = "building";
console.log(`Starting Build ${buildSid}...`);

for (let i = 0; i < 10; i++) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log(`[${(i + 1) * 5} seconds] Polling build status... `);

  const statusResponse = await asyncTwilioRequest(
    `${serverlessBaseUrl}/${serviceSid}/Builds/${buildSid}/Status`,
    "GET"
  );
  buildStatus = statusResponse.body.status;
  console.log(buildStatus);

  if (buildStatus === "completed") {
    break;
  } else if (buildStatus === "failed") {
    throw new Error(
      `Build ${buildSid} returned failed status. Full response: ${statusResponse.body}`
    );
  }
}

if (buildStatus !== "completed") {
  throw new Error(`Build ${buildSid} has timed out`);
}

console.log(`Build ${buildSid} has been completed`);

const deploymentResp = await asyncTwilioRequest(
  `${serverlessBaseUrl}/${serviceSid}/Environments/${environment.sid}/Deployments`,
  "POST",
  new URLSearchParams({
    BuildSid: buildSid,
  })
);

console.log(
  `✅ Deployment ${deploymentResp.body.sid} created to Environment ${environment.sid}`
);
