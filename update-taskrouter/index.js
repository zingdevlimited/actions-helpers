const readFileSync = require("fs").readFileSync;

const { INPUT_CONFIG_PATH, INPUT_TWILIO_API_KEY, INPUT_TWILIO_API_SECRET, INPUT_WORKSPACE_NAME } = process.env;

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
const asyncTwilioRequest = async (url, method, bodyParams = undefined, retryNumber = 0) => {
  try {
    console.log(`::debug::Request: ${method} ${url}`);
    const headers = {
      "Authorization": "Basic " + Buffer.from(`${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`).toString("base64")
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
      ok
    };
  } catch (err) {
    throw err;
    // return { body: undefined, status: 500, ok: false };
  }
}

const configFile = JSON.parse(readFileSync(INPUT_CONFIG_PATH, "utf8"));

const taskrouterUrl = "https://taskrouter.twilio.com/v1";

const run = async () => {
  const workspaceListResp = await asyncTwilioRequest(`${taskrouterUrl}/Workspaces`, "GET");
  /** @type {array} */
  const workspaceList = workspaceListResp.body.workspaces;

  if (!workspaceList.length) {
    throw new Error("No Taskrouter Workspaces found");
  }

  let workspaceSid;
  if (!INPUT_WORKSPACE_NAME?.trim()) {
    workspaceSid = workspaceList[0].sid; // Use Default Flex Workspace
  } else {
    workspaceSid = workspaceList.find((w) => w.friendly_name === INPUT_WORKSPACE_NAME.trim());
    if (!workspaceSid) {
      throw new Error(`Taskrouter Workspace with name '${INPUT_WORKSPACE_NAME}' not found`);
    }
  }

  const workspaceUrl = `${taskrouterUrl}/Workspaces/${workspaceSid}`;

  const activityListResp = await asyncTwilioRequest(`${workspaceUrl}/Activities`, "GET");
  /** @type {array} */
  const activityList = activityListResp.body.activities;

  const queueListResp = await asyncTwilioRequest(`${workspaceUrl}/TaskQueues`, "GET");
  /** @type {array} */
  const queueList = queueListResp.body.task_queues;
  
  const channelListResp = await asyncTwilioRequest(`${workspaceUrl}/TaskChannels`, "GET");
  /** @type {array} */
  const channelList = channelListResp.body.channels;

  const workflowListResp = await asyncTwilioRequest(`${workspaceUrl}/Workflows`, "GET");
  /** @type {array} */
  const workflowList = workflowListResp.body.workflows;

  for (const activity of configFile.activities ?? []) {
    const existing = activityList.find((a) => a.friendly_name === activity.friendlyName);
    // Only Create is allowed. You cannot update an activity's Available property
    if (!existing) {
      const postBody = new URLSearchParams({
        FriendlyName: activity.friendlyName,
        Available: activity.available
      });
      const response = await asyncTwilioRequest(`${workspaceUrl}/Activities`, "POST", postBody);

      console.log(`Activity ${activity.friendlyName} ${response.body.sid}`);

      activityList.push(response.body);
    } else {
      console.log(`Activity ${activity.friendlyName} ${existing.sid}`);
    }
  }

  for (const channel of configFile.channels ?? []) {
    const existing = channelList.find((c) => c.unique_name === channel.uniqueName);

    const postBody = new URLSearchParams({
      FriendlyName: channel.friendlyName,
      UniqueName: existing ? undefined : channel.uniqueName,
      ChannelOptimizedRouting: channel.channelOptimizedRouting
    });

    const postUrl = existing ? `${workspaceUrl}/TaskChannels/${existing.sid}` : `${workspaceUrl}/TaskChannels`;
    const response = await asyncTwilioRequest(postUrl, "POST", postBody);

    console.log(`TaskChannel ${channel.friendlyName} ${response.body.sid}`);

    if (!existing) {
      channelList.push(response.body);
    }
  }

  for (const queue of configFile.queues ?? []) {
    let assignmentActivitySid = undefined;
    let reservationActivitySid = undefined;
    if (queue.assignmentActivity) {
      assignmentActivitySid = activityList.find(
        (a) => a.sid === queue.assignmentActivity.sid || 
          a.friendly_name === queue.assignmentActivity.friendlyName
      )?.sid;
    }
    if (queue.reservationActivity) {
      reservationActivitySid = activityList.find(
        (a) => a.sid === queue.reservationActivity.sid || 
          a.friendly_name === queue.reservationActivity.friendlyName
      )?.sid;
    }

    const postBody = new URLSearchParams({
      FriendlyName: queue.friendlyName,
      TargetWorkers: queue.targetWorkers,
      MaxReservedWorkers: queue.maxReservedWorkers,
      TaskOrder: queue.taskOrder,
      AssignmentActivitySid: assignmentActivitySid,
      ReservationActivitySid: reservationActivitySid,
    });

    const existing = queueList.find((q) => q.friendly_name === queue.friendlyName);
    const postUrl = existing ? `${workspaceUrl}/TaskQueues/${existing.sid}` : `${workspaceUrl}/TaskQueues`;
    const response = await asyncTwilioRequest(postUrl, "POST", postBody);
    
    console.log(`TaskQueue ${queue.friendlyName} ${response.body.sid}`);

    if (!existing) {
      queueList.push(response.body);
    }
  }

  for (const workflow of configFile.workflows ?? []) {

    const configuration = workflow.configuration.task_routing;

    if (configuration.default_filter) {
      const defaultQueueSid = queueList.find((q) => 
        q.sid === configuration.default_filter.queue.sid ||
        q.friendly_name === configuration.default_filter.queue.friendlyName
      )?.sid;
      configuration.default_filter.queue = defaultQueueSid;
    }
    for (const filter of configuration.filters) {
      for (const target of filter.targets) {
        const queueSid = queueList.find((q) => 
          q.sid === target.queue.sid ||
          q.friendly_name === target.queue.friendlyName
        )?.sid;
        target.queue = queueSid;
      }
    }

    const postBody = new URLSearchParams({
      FriendlyName: workflow.friendlyName,
      Configuration: JSON.stringify(workflow.configuration),
      AssignmentCallbackUrl: workflow.assignmentCallbackUrl,
      FallbackAssignmentCallbackUrl: workflow.fallbackAssignmentCallbackUrl,
      TaskReservationTimeout: workflow.taskReservationTimeout
    });

    const existing = workflowList.find((w) => w.friendly_name === workflow.friendlyName);
    const postUrl = existing ? `${workspaceUrl}/Workflows/${existing.sid}` : `${workspaceUrl}/Workflows`;
    const response = await asyncTwilioRequest(postUrl, "POST", postBody);

    console.log(`Workflow ${workflow.friendlyName} ${response.body.sid}`);
    
    if (!existing) {
      workflowList.push(response.body);
    }
  }
}

run();
