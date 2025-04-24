const isDeepStrictEqual = require("util").isDeepStrictEqual;
const readFileSync = require("fs").readFileSync;
const appendFileSync = require("fs").appendFileSync;

const {
  INPUT_CONFIG_PATH,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_WORKSPACE_NAME,
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

    let body = undefined;
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

/**
 * @template T
 * @param {object} obj1
 * @param {T} obj2
 * @param {Array<keyof T>} properties
 * @returns
 */
const deepEquals = (obj1, obj2, properties) => {
  const comp1 = properties.reduce(
    (prev, curr) => ({ ...prev, [curr]: obj1[curr] }),
    {}
  );
  const comp2 = properties.reduce(
    (prev, curr) => ({ ...prev, [curr]: obj2[curr] }),
    {}
  );
  return isDeepStrictEqual(comp1, comp2);
};

/**
 * @typedef Reference
 * @property {string | undefined} friendlyName
 * @property {string | undefined} sid
 *
 * @typedef Activity
 * @property {string} friendlyName
 * @property {boolean} available
 *
 * @typedef Channel
 * @property {string} friendlyName
 * @property {string} uniqueName
 * @property {boolean} channelOptimizedRouting
 *
 * @typedef Queue
 * @property {string} friendlyName
 * @property {Reference} assignmentActivity
 * @property {Reference} reservationActivity
 * @property {number} maxReservedWorkers
 * @property {string} targetWorkers
 * @property {"FIFO" | "LIFO"} taskOrder
 *
 * @typedef Workflow
 * @property {string} friendlyName
 * @property {string} assignmentCallbackUrl
 * @property {string} fallbackAssignmentCallbackUrl
 * @property {number} taskReservationTimeout
 * @property {any} configuration
 *
 * @typedef ConfigFile
 * @property {Activity[]} activities
 * @property {Channel[]} channels
 * @property {Queue[]} queues
 * @property {Workflow[]} workflows
 */

/** @type {ConfigFile} */
const configFile = JSON.parse(readFileSync(INPUT_CONFIG_PATH, "utf8"));

const taskrouterUrl = "https://taskrouter.twilio.com/v1";

const run = async () => {
  const workspaceListResp = await asyncTwilioRequest(
    `${taskrouterUrl}/Workspaces`,
    "GET"
  );
  /** @type {array} */
  const workspaceList = workspaceListResp.body.workspaces;

  if (!workspaceList.length) {
    throw new Error("No Taskrouter Workspaces found");
  }

  let workspaceSid;
  if (!INPUT_WORKSPACE_NAME?.trim()) {
    workspaceSid = workspaceList[0].sid; // Use Default Flex Workspace
  } else {
    workspaceSid = workspaceList.find(
      (w) =>
        w.friendly_name.toLowerCase() ===
        INPUT_WORKSPACE_NAME.trim().toLowerCase()
    );
    if (!workspaceSid) {
      throw new Error(
        `Taskrouter Workspace with name '${INPUT_WORKSPACE_NAME}' not found`
      );
    }
  }

  const workspaceUrl = `${taskrouterUrl}/Workspaces/${workspaceSid}`;

  const activityListResp = await asyncTwilioRequest(
    `${workspaceUrl}/Activities`,
    "GET"
  );
  /** @type {array} */
  const activityList = activityListResp.body.activities;

  const queueListResp = await asyncTwilioRequest(
    `${workspaceUrl}/TaskQueues`,
    "GET"
  );
  /** @type {array} */
  const queueList = queueListResp.body.task_queues;

  const channelListResp = await asyncTwilioRequest(
    `${workspaceUrl}/TaskChannels`,
    "GET"
  );
  /** @type {array} */
  const channelList = channelListResp.body.channels;

  const workflowListResp = await asyncTwilioRequest(
    `${workspaceUrl}/Workflows`,
    "GET"
  );
  /** @type {array} */
  const workflowList = workflowListResp.body.workflows;

  const results = {
    activities: {},
    channels: {},
    queues: {},
    workflows: {},
  };

  // ACTIVITIES
  for (const activity of configFile.activities ?? []) {
    const existing = activityList.find(
      (a) =>
        a.friendly_name.toLowerCase() === activity.friendlyName.toLowerCase()
    );
    // Only Create is allowed. You cannot update an activity's Available property
    if (!existing) {
      const postBody = new URLSearchParams({
        FriendlyName: activity.friendlyName,
        Available: activity.available.toString(),
      });
      const response = await asyncTwilioRequest(
        `${workspaceUrl}/Activities`,
        "POST",
        postBody
      );

      console.log(`Activity ${activity.friendlyName} ${response.body.sid}`);

      results.activities[activity.friendlyName] = response.body;
      activityList.push(response.body);
    } else {
      console.log(`Activity ${activity.friendlyName} ${existing.sid}`);
      results.activities[activity.friendlyName] = existing;
    }
  }
  // /ACTIVITES

  // CHANNELS
  for (const channel of configFile.channels ?? []) {
    const existing = channelList.find(
      (c) => c.unique_name.toLowerCase() === channel.uniqueName.toLowerCase()
    );

    const postBody = new URLSearchParams({
      FriendlyName: channel.friendlyName,
      ChannelOptimizedRouting: channel.channelOptimizedRouting.toString(),
    });
    if (!existing) {
      postBody.append("UniqueName", channel.uniqueName);
    }

    if (
      existing &&
      deepEquals(existing, channel, ["channelOptimizedRouting"])
    ) {
      results.channels[channel.friendlyName] = existing;
      console.log(
        `(Unchanged) TaskChannel ${channel.friendlyName} ${existing.sid}`
      );
      continue;
    }

    const postUrl = existing
      ? `${workspaceUrl}/TaskChannels/${existing.sid}`
      : `${workspaceUrl}/TaskChannels`;
    const response = await asyncTwilioRequest(postUrl, "POST", postBody);

    console.log(
      `TaskChannel ${channel.friendlyName} (${channel.uniqueName}) ${response.body.sid}`
    );

    results.channels[channel.uniqueName] = response.body;
    if (!existing) {
      channelList.push(response.body);
    }
  }
  // /CHANNELS

  // QUEUES
  for (const queue of configFile.queues ?? []) {
    let assignmentActivitySid = undefined;
    let reservationActivitySid = undefined;
    if (queue.assignmentActivity) {
      assignmentActivitySid = activityList.find(
        (a) =>
          a.sid === queue.assignmentActivity.sid ||
          a.friendly_name.toLowerCase() ===
            queue.assignmentActivity.friendlyName?.toLowerCase()
      )?.sid;
    }
    if (queue.reservationActivity) {
      reservationActivitySid = activityList.find(
        (a) =>
          a.sid === queue.reservationActivity.sid ||
          a.friendly_name.toLowerCase() ===
            queue.reservationActivity.friendlyName?.toLowerCase()
      )?.sid;
    }

    const postBody = new URLSearchParams({
      FriendlyName: queue.friendlyName,
      TargetWorkers: queue.targetWorkers,
      MaxReservedWorkers: queue.maxReservedWorkers.toString(),
      TaskOrder: queue.taskOrder,
      AssignmentActivitySid: assignmentActivitySid,
      ReservationActivitySid: reservationActivitySid,
    });

    const existing = queueList.find(
      (q) => q.friendly_name.toLowerCase() === queue.friendlyName.toLowerCase()
    );

    if (
      existing &&
      deepEquals(
        existing,
        { ...queue, assignmentActivitySid, reservationActivitySid },
        ["assignmentActivitySid", "reservationActivitySid", "targetWorkers"]
      )
    ) {
      results.queues[queue.friendlyName] = existing;
      console.log(
        `(Unchanged) TaskQueue ${queue.friendlyName} ${existing.sid}`
      );
      continue;
    }

    const postUrl = existing
      ? `${workspaceUrl}/TaskQueues/${existing.sid}`
      : `${workspaceUrl}/TaskQueues`;
    const response = await asyncTwilioRequest(postUrl, "POST", postBody);

    console.log(`TaskQueue ${queue.friendlyName} ${response.body.sid}`);

    results.queues[queue.friendlyName] = response.body;
    if (!existing) {
      queueList.push(response.body);
    }
  }
  // /QUEUES

  // WORKFLOWS
  for (const workflow of configFile.workflows ?? []) {
    const configuration = workflow.configuration.task_routing;

    if (configuration.default_filter) {
      const defaultQueueSid = queueList.find(
        (q) =>
          q.sid === configuration.default_filter.queue.sid ||
          q.friendly_name.toLowerCase() ===
            configuration.default_filter.queue.friendlyName.toLowerCase()
      )?.sid;
      configuration.default_filter.queue = defaultQueueSid;
    }
    for (const filter of configuration.filters) {
      for (const target of filter.targets) {
        const queueSid = queueList.find(
          (q) =>
            q.sid === target.queue.sid ||
            q.friendly_name.toLowerCase() ===
              target.queue.friendlyName.toLowerCase()
        )?.sid;
        target.queue = queueSid;
      }
    }

    const postBody = new URLSearchParams({
      FriendlyName: workflow.friendlyName,
      Configuration: JSON.stringify(workflow.configuration),
      AssignmentCallbackUrl: workflow.assignmentCallbackUrl,
      FallbackAssignmentCallbackUrl: workflow.fallbackAssignmentCallbackUrl,
      TaskReservationTimeout: workflow.taskReservationTimeout.toString(),
    });

    const existing = workflowList.find(
      (w) =>
        w.friendly_name.toLowerCase() === workflow.friendlyName.toLowerCase()
    );

    if (
      existing &&
      deepEquals(
        { ...existing, configuration: JSON.parse(existing.configuration) },
        workflow,
        [
          "assignmentCallbackUrl",
          "fallbackAssignmentCallbackUrl",
          "taskReservationTimeout",
          "configuration",
        ]
      )
    ) {
      results.workflows[workflow.friendlyName] = existing;
      console.log(
        `(Unchanged) Workflow ${workflow.friendlyName} ${existing.sid}`
      );
      continue;
    }

    const postUrl = existing
      ? `${workspaceUrl}/Workflows/${existing.sid}`
      : `${workspaceUrl}/Workflows`;
    const response = await asyncTwilioRequest(postUrl, "POST", postBody);

    console.log(`Workflow ${workflow.friendlyName} ${response.body.sid}`);

    results.workflows[workflow.friendlyName] = response.body;
    if (!existing) {
      workflowList.push(response.body);
    }
  }
  // /WORKFLOWS

  const resultsJson = JSON.stringify(results);

  if (GITHUB_OUTPUT) {
    appendFileSync(GITHUB_OUTPUT, `RESOURCES=${resultsJson}\n`, "utf8");
    appendFileSync(GITHUB_OUTPUT, `WORKSPACE_SID=${workspaceSid}\n`, "utf8");
  }
};

run();
