import { isDeepStrictEqual } from 'util';
import { readFileSync } from 'fs';
import { appendFileSync } from 'fs';

const {
  INPUT_CONFIG_PATH,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_WORKSPACE_NAME,
  INPUT_WORKSPACE_CALLBACK_URL,
  GITHUB_OUTPUT,
} = process.env;

if (!INPUT_CONFIG_PATH?.trim()) {
  throw new Error('Missing Input CONFIG_PATH');
}
if (!INPUT_TWILIO_API_KEY?.trim()) {
  throw new Error('Missing Input TWILIO_API_KEY');
}
if (!INPUT_TWILIO_API_SECRET?.trim()) {
  throw new Error('Missing Input TWILIO_API_SECRET');
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
 * @param {object | undefined} bodyParams
 * @param {number} retryNumber
 * @returns {Promise<response>}
 */
const asyncTwilioRequest = async (
  url,
  method,
  bodyParams = undefined,
  retryNumber = 0,
) => {
  try {
    console.log(`::debug::Request: ${method} ${url}`);
    const headers = {
      Authorization:
        'Basic ' +
        Buffer.from(
          `${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`,
        ).toString('base64'),
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

    if (method === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Content-Length'] = Buffer.byteLength(body ?? '');
    }

    const req = await fetch(url, { method, headers, body });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error('Exceeded retry attempts after 429 errors');
      }
      const retryDelay = BASE_DELAY_MS * 2 ** retryNumber;
      console.log(`::debug::Rate-limit hit, retrying in ${retryDelay} ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return asyncTwilioRequest(url, method, bodyParams, retryNumber + 1);
    }

    console.log(`::debug::Status: ${req.status} ${req.statusText}`);

    const ok = req.status >= 200 && req.status < 300;
    if (!ok) {
      throw { message: await req.text(), status: req.status };
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
 * @param {object} prevObj
 * @param {object} newObj
 */
const hasBeenChanged = (prevObj, newObj) => {
  const comp = Object.keys(newObj).reduce(
    (prev, curr) => ({
      ...prev,
      [curr]: newObj[curr] !== undefined ? prevObj[curr] : undefined,
    }),
    {},
  );
  return isDeepStrictEqual(comp, newObj);
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
 * @property {boolean | undefined} channelOptimizedRouting
 *
 * @typedef Queue
 * @property {string} friendlyName
 * @property {Reference | undefined} assignmentActivity
 * @property {Reference | undefined} reservationActivity
 * @property {number | undefined} maxReservedWorkers
 * @property {string | undefined} targetWorkers
 * @property {"FIFO" | "LIFO" | undefined} taskOrder
 *
 * @typedef Workflow
 * @property {string} friendlyName
 * @property {string | undefined} assignmentCallbackUrl
 * @property {string | undefined} fallbackAssignmentCallbackUrl
 * @property {number | undefined} taskReservationTimeout
 * @property {any | undefined} configuration
 *
 * @typedef Workspace
 * @property {Reference | undefined} defaultActivity
 * @property {string | undefined} eventCallbackUrl
 * @property {string[] | undefined} eventsFilter
 * @property {Reference | undefined} timeoutActivity
 * @property {"FIFO" | "LIFO" | undefined} prioritizeQueueOrder
 *
 * @typedef ConfigFile
 * @property {Activity[]} activities
 * @property {Channel[]} channels
 * @property {Queue[]} queues
 * @property {Workflow[]} workflows
 * @property {Workspace} workspace
 */

/** @type {ConfigFile} */
const configFile = JSON.parse(readFileSync(INPUT_CONFIG_PATH, 'utf8'));

const taskrouterUrl = 'https://taskrouter.twilio.com/v1';

const workspaceListResp = await asyncTwilioRequest(
  `${taskrouterUrl}/Workspaces`,
  'GET',
);
/** @type {Array} */
const workspaceList = workspaceListResp.body.workspaces;

if (!workspaceList.length) {
  throw new Error('No Taskrouter Workspaces found');
}

let workspaceSid;
const trimmedWorkspaceName = INPUT_WORKSPACE_NAME?.trim();
if (!trimmedWorkspaceName) {
  workspaceSid = workspaceList[0].sid; // Use Default Flex Workspace
} else {
  workspaceSid = workspaceList.find(
    w => w.friendly_name.toLowerCase() === trimmedWorkspaceName.toLowerCase(),
  )?.sid;
  if (!workspaceSid) {
    const postBody = {
      FriendlyName: trimmedWorkspaceName,
    };
    const response = await asyncTwilioRequest(
      `${taskrouterUrl}/Workspaces`,
      'POST',
      postBody,
    );
    if (!response.ok) {
      throw new Error(
        `Unable to create workspace ${trimmedWorkspaceName} - ${response.status}`,
      );
    }
    workspaceSid = response.body.sid;
  }
}

const workspaceUrl = `${taskrouterUrl}/Workspaces/${workspaceSid}`;

const activityListResp = await asyncTwilioRequest(
  `${workspaceUrl}/Activities`,
  'GET',
);
/** @type {Array} */
const activityList = activityListResp.body.activities;

const queueListResp = await asyncTwilioRequest(
  `${workspaceUrl}/TaskQueues?PageSize=1000`,
  'GET',
);
/** @type {Array} */
const queueList = queueListResp.body.task_queues;

const channelListResp = await asyncTwilioRequest(
  `${workspaceUrl}/TaskChannels`,
  'GET',
);
/** @type {Array} */
const channelList = channelListResp.body.channels;

const workflowListResp = await asyncTwilioRequest(
  `${workspaceUrl}/Workflows`,
  'GET',
);
/** @type {Array} */
const workflowList = workflowListResp.body.workflows;

const results = {
  activities: {},
  channels: {},
  queues: {},
  workflows: {},
  workspace: {},
};

// ACTIVITIES
for (const activity of configFile.activities ?? []) {
  const existing = activityList.find(
    a => a.friendly_name.toLowerCase() === activity.friendlyName.toLowerCase(),
  );
  // Only Create is allowed. You cannot update an activity's Available property
  if (!existing) {
    const postBody = {
      FriendlyName: activity.friendlyName,
      Available: activity.available,
    };
    const response = await asyncTwilioRequest(
      `${workspaceUrl}/Activities`,
      'POST',
      postBody,
    );

    console.log(`Activity ${activity.friendlyName} ${response.body.sid}`);

    results.activities[activity.friendlyName] = response.body;
    activityList.push(response.body);
  } else {
    console.log(
      `(Unchanged) Activity ${activity.friendlyName} ${existing.sid}`,
    );
    results.activities[activity.friendlyName] = existing;
  }
}
// /ACTIVITES

// WORKSPACE
if (configFile.workspace || INPUT_WORKSPACE_CALLBACK_URL) {
  let workspaceDefaultActivitySid = undefined;
  let workspaceTimeoutActivitySid = undefined;
  if (configFile.workspace?.defaultActivity) {
    workspaceDefaultActivitySid = activityList.find(
      a =>
        a.sid === configFile.workspace.defaultActivity.sid ||
        a.friendly_name.toLowerCase() ===
          configFile.workspace.defaultActivity.friendlyName?.toLowerCase(),
    )?.sid;
  }
  if (configFile.workspace?.timeoutActivity) {
    workspaceTimeoutActivitySid = activityList.find(
      a =>
        a.sid === configFile.workspace.timeoutActivity.sid ||
        a.friendly_name.toLowerCase() ===
          configFile.workspace.timeoutActivity.friendlyName?.toLowerCase(),
    )?.sid;
  }

  const workspacePostBody = {
    DefaultActivitySid: workspaceDefaultActivitySid,
    EventCallbackUrl:
      configFile.workspace?.eventCallbackUrl !== undefined
        ? configFile.workspace?.eventCallbackUrl
        : INPUT_WORKSPACE_CALLBACK_URL,
    EventsFilter:
      configFile.workspace?.eventsFilter === undefined
        ? undefined
        : configFile.workspace.eventsFilter.join(','),
    TimeoutActivitySid: workspaceTimeoutActivitySid,
    PrioritizeQueueOrder: configFile.workspace?.prioritizeQueueOrder,
  };
  const workspaceResponse = await asyncTwilioRequest(
    workspaceUrl,
    'POST',
    workspacePostBody,
  );
  results.workspace = workspaceResponse.body;
}
// /WORKSPACE

// CHANNELS
for (const channel of configFile.channels ?? []) {
  const existing = channelList.find(
    c => c.unique_name.toLowerCase() === channel.uniqueName.toLowerCase(),
  );

  const postBody = {
    FriendlyName: channel.friendlyName,
    UniqueName: existing ? undefined : channel.uniqueName,
    ChannelOptimizedRouting: channel.channelOptimizedRouting,
  };

  if (
    existing &&
    hasBeenChanged(
      { channelOptimizedRouting: existing.channel_optimized_routing },
      { channelOptimizedRouting: channel.channelOptimizedRouting },
    )
  ) {
    results.channels[channel.friendlyName] = existing;
    console.log(
      `(Unchanged) TaskChannel ${channel.friendlyName} ${existing.sid}`,
    );
    continue;
  }

  const postUrl = existing
    ? `${workspaceUrl}/TaskChannels/${existing.sid}`
    : `${workspaceUrl}/TaskChannels`;
  const response = await asyncTwilioRequest(postUrl, 'POST', postBody);

  console.log(
    `TaskChannel ${channel.friendlyName} (${channel.uniqueName}) ${response.body.sid}`,
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
      a =>
        a.sid === queue.assignmentActivity?.sid ||
        a.friendly_name.toLowerCase() ===
          queue.assignmentActivity?.friendlyName?.toLowerCase(),
    )?.sid;
  }
  if (queue.reservationActivity) {
    reservationActivitySid = activityList.find(
      a =>
        a.sid === queue.reservationActivity?.sid ||
        a.friendly_name.toLowerCase() ===
          queue.reservationActivity?.friendlyName?.toLowerCase(),
    )?.sid;
  }

  const postBody = {
    FriendlyName: queue.friendlyName,
    TargetWorkers: queue.targetWorkers,
    MaxReservedWorkers: queue.maxReservedWorkers,
    TaskOrder: queue.taskOrder,
    AssignmentActivitySid: assignmentActivitySid,
    ReservationActivitySid: reservationActivitySid,
  };

  const existing = queueList.find(
    q => q.friendly_name.toLowerCase() === queue.friendlyName.toLowerCase(),
  );

  if (
    existing &&
    hasBeenChanged(
      {
        assignmentActivitySid: existing.assignment_activity_sid,
        reservationActivitySid: existing.reservation_activity_sid,
        maxReservedWorkers: existing.max_reserved_workers,
        targetWorkers: existing.target_workers,
        taskOrder: existing.task_order,
      },
      {
        assignmentActivitySid: assignmentActivitySid,
        reservationActivitySid: reservationActivitySid,
        maxReservedWorkers: queue.maxReservedWorkers,
        targetWorkers: queue.targetWorkers,
        taskOrder: queue.taskOrder,
      },
    )
  ) {
    results.queues[queue.friendlyName] = existing;
    console.log(`(Unchanged) TaskQueue ${queue.friendlyName} ${existing.sid}`);
    continue;
  }

  const postUrl = existing
    ? `${workspaceUrl}/TaskQueues/${existing.sid}`
    : `${workspaceUrl}/TaskQueues`;
  const response = await asyncTwilioRequest(postUrl, 'POST', postBody);

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
      q =>
        q.sid === configuration.default_filter.queue.sid ||
        q.friendly_name.toLowerCase() ===
          configuration.default_filter.queue.friendlyName.toLowerCase(),
    )?.sid;
    configuration.default_filter.queue = defaultQueueSid;
  }
  for (const filter of configuration.filters) {
    for (const target of filter.targets) {
      const queueSid = queueList.find(
        q =>
          q.sid === target.queue.sid ||
          q.friendly_name.toLowerCase() ===
            target.queue.friendlyName.toLowerCase(),
      )?.sid;
      target.queue = queueSid;
    }
  }

  const postBody = {
    FriendlyName: workflow.friendlyName,
    Configuration: JSON.stringify(workflow.configuration),
    AssignmentCallbackUrl: workflow.assignmentCallbackUrl,
    FallbackAssignmentCallbackUrl: workflow.fallbackAssignmentCallbackUrl,
    TaskReservationTimeout: workflow.taskReservationTimeout,
  };

  const existing = workflowList.find(
    w => w.friendly_name.toLowerCase() === workflow.friendlyName.toLowerCase(),
  );

  if (
    existing &&
    hasBeenChanged(
      {
        assignmentCallbackUrl: existing.assignment_callback_url,
        fallbackAssignmentCallbackUrl:
          existing.fallback_assignment_callback_url,
        taskReservationTimeout: existing.task_reservation_timeout,
        configuration: JSON.parse(existing.configuration),
      },
      {
        assignmentCallbackUrl: workflow.assignmentCallbackUrl,
        fallbackAssignmentCallbackUrl: workflow.fallbackAssignmentCallbackUrl,
        taskReservationTimeout: workflow.taskReservationTimeout,
        configuration: workflow.configuration,
      },
    )
  ) {
    results.workflows[workflow.friendlyName] = existing;
    console.log(
      `(Unchanged) Workflow ${workflow.friendlyName} ${existing.sid}`,
    );
    continue;
  }

  const postUrl = existing
    ? `${workspaceUrl}/Workflows/${existing.sid}`
    : `${workspaceUrl}/Workflows`;
  const response = await asyncTwilioRequest(postUrl, 'POST', postBody);

  console.log(`Workflow ${workflow.friendlyName} ${response.body.sid}`);

  results.workflows[workflow.friendlyName] = response.body;
  if (!existing) {
    workflowList.push(response.body);
  }
}
// /WORKFLOWS

const resultsJson = JSON.stringify(results);

if (GITHUB_OUTPUT) {
  appendFileSync(GITHUB_OUTPUT, `RESOURCES=${resultsJson}\n`, 'utf8');
  appendFileSync(GITHUB_OUTPUT, `WORKSPACE_SID=${workspaceSid}\n`, 'utf8');
}
