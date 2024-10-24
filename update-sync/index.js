const readFileSync = require("fs").readFileSync;
const appendFileSync = require("fs").appendFileSync;

const {
  INPUT_CONFIG_PATH,
  INPUT_SERVICE_NAME,
  INPUT_SERVICE_ACL_ENABLED,
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
 * @param {URLSearchParams} bodyParams
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

    if (method === "POST") {
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

/**
 * @typedef Permissions
 * @property {boolean} Read
 * @property {boolean} Write
 * @property {boolean} Manage
 * 
 * @param {string} permissionId
 * 
 * @returns {Permissions}
 */
const getPermissionFromId = (permissionId) => {
  switch (permissionId) {
    case "READ_ONLY":
      return { Read: true, Write: false, Manage: false };
    case "WRITE_ONLY":
      return { Read: false, Write: true, Manage: false };
    case "READ_WRITE":
      return { Read: true, Write: true, Manage: false };
    // Add other permission identities...
    default:
      console.warn(`::warning::Unrecognized Permission Id '${permissionId}'. Defaulting to no permissions`);
      return { Read: false, Write: false, Manage: false };
  }
};

const syncResources = {};
/**
 * @param {string} serviceUrlBase
 * @param {"Documents" | "Lists" | "Maps" | "Streams"} resourceType
 * @param {string} uniqueName
 * @param {Object} createParams
 * @param {Array.<string>} permissions
 */
const createSyncResourcesIfNotExists = async (
  serviceUrlBase,
  resourceType,
  uniqueName,
  createParams,
  permissions,
) => {
  if (syncResources[resourceType] === undefined) {
    const resourceListResp = await asyncTwilioRequest(`${serviceUrlBase}/${resourceType}`, "GET");
    const resourceList = resourceListResp.body[resourceListResp.body.meta.key];
    syncResources[resourceType] = resourceList;
  }
  /** @type {Array} */
  const existingList = syncResources[resourceType];

  const resourceExists = existingList.some((r) => r.unique_name === uniqueName);
  if (!resourceExists) {
    const createUrlParams = new URLSearchParams({ ...createParams, UniqueName: uniqueName });
    const createResp = await asyncTwilioRequest(
      `${serviceUrlBase}/${resourceType}`,
      "POST",
      createUrlParams
    );
    syncResources[resourceType].push(createResp.body);

    console.log(`Created Sync ${resourceType} '${uniqueName}'`);

    for (const permissionId of permissions) {
      const permission = getPermissionFromId(permissionId);

      await asyncTwilioRequest(
        `${serviceUrlBase}/${resourceType}/${uniqueName}/Permissions/${permissionId}`,
        "POST",
        new URLSearchParams(permission)
      );

      console.log(`Set Permission ${permissionId} (${permission.Read ? "Read" : ""}/${permission.Write ? "Write" : ""}/${permission.Manage ? "Manage" : ""}) on ${resourceType} '${uniqueName}'`);
    }
  }
};

/**
 * @typedef SyncMapItem
 * @property {string} key
 * @property {Object} data
 * 
 * @param {string} serviceUrlBase 
 * @param {string} syncMapName 
 * @param {Array.<SyncMapItem>} items
 */
const createSyncMapItemsIfNotExists = async (
  serviceUrlBase,
  syncMapName,
  items
) => {
  const syncMapItemsResp = await asyncTwilioRequest(`${serviceUrlBase}/Maps/${syncMapName}/Items`, "GET");
  /** @type {Array.<SyncMapItem>} */
  const syncMapItems = syncMapItemsResp.body.items;
  for (const { key, data } of items) {
    const existing = syncMapItems.find((i) => i.key === key);
    if (!existing) {
      await asyncTwilioRequest(
        `${serviceUrlBase}/Maps/${syncMapName}/Items`,
        "POST",
        new URLSearchParams({
          Key: key,
          Data: JSON.stringify(data)
        })
      );

      console.log(`Created Item '${key}' in SyncMap '${syncMapName}'`);
    }
  }
}

const syncUrlBase = "https://sync.twilio.com/v1";

const run = async () => {
  let syncServiceSid;
  if (INPUT_SERVICE_NAME?.trim()) {
    const serviceListResp = await asyncTwilioRequest(`${syncUrlBase}/Services`, "GET");
    /** @type {array} */
    const serviceList = serviceListResp.body.services;

    let service = serviceList.find(
      (s) => s.friendly_name.toLowerCase().trim() === INPUT_SERVICE_NAME.toLowerCase().trim()
    );

    if (!service) {
      const aclEnabled = INPUT_SERVICE_ACL_ENABLED?.toLowerCase().trim() === "true";
      const createParams = new URLSearchParams({
        FriendlyName: INPUT_SERVICE_NAME,
        AclEnabled: aclEnabled
      });
      const serviceCreateResp = await asyncTwilioRequest(
        `${syncUrlBase}/Services`,
        "POST",
        createParams
      );
      service = serviceCreateResp.body;
      console.log(`Created Service '${INPUT_SERVICE_NAME}' (ACL: ${aclEnabled})`);
    }

    syncServiceSid = service.sid;
  } else {
    syncServiceSid = "default";
  }
  if (GITHUB_OUTPUT?.trim()) {
    appendFileSync(GITHUB_OUTPUT, `SYNC_SERVICE_SID=${syncServiceSid}\n`);
  }

  const serviceUrlBase = `${syncUrlBase}/Services/${syncServiceSid}`;

  for (const document of configFile.documents ?? []) {
    await createSyncResourcesIfNotExists(
      serviceUrlBase,
      "Documents",
      document.uniqueName,
      {
        Data: JSON.stringify(document.defaultData)
      },
      document.aclPermissions ?? []
    );
  }
  for (const list of configFile.lists ?? []) {
    await createSyncResourcesIfNotExists(
      serviceUrlBase,
      "Lists",
      list.uniqueName,
      {},
      list.aclPermissions ?? []
    );
  }
  for (const map of configFile.maps ?? []) {
    await createSyncResourcesIfNotExists(
      serviceUrlBase,
      "Maps",
      map.uniqueName,
      {},
      map.aclPermissions ?? []
    );

    if (map.defaultItems?.length) {
      await createSyncMapItemsIfNotExists(
        serviceUrlBase,
        map.uniqueName,
        map.defaultItems
      );
    }
  }
  for (const stream of configFile.streams ?? []) {
    await createSyncResourcesIfNotExists(
      serviceUrlBase,
      "Streams",
      stream.uniqueName,
      {},
      []
    );
  }
};

run();
