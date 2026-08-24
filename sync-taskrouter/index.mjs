import { writeFileSync, readFileSync, existsSync } from "fs";
import { commands } from "../services/commands.mjs";
import { GithubService } from "../services/github-service.mjs";

const INPUT_CONFIG_PATH = commands.getInput("CONFIG_PATH", true);

const INPUT_TWILIO_API_KEY = commands.getInput("TWILIO_API_KEY", true);

const INPUT_TWILIO_API_SECRET = commands.getInput("TWILIO_API_SECRET", true);

const INPUT_WORKSPACE_NAME = commands.getOptionalInput("WORKSPACE_NAME");

const MAX_RETRY_COUNT = 3;
const BASE_DELAY_MS = 2000;

/*
 * Twilio API helper
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
        "Basic " +
        Buffer.from(
          `${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`,
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

const run = async () => {
  const taskrouterUrl = "https://taskrouter.twilio.com/v1";

  const workspaceListResp = await asyncTwilioRequest(
    `${taskrouterUrl}/Workspaces`,
    "GET",
  );
  const workspaceList = workspaceListResp.body.workspaces;

  if (!workspaceList.length) {
    throw new Error("No Taskrouter Workspaces found");
  }

  let workspaceSid;
  const trimmedWorkspaceName = INPUT_WORKSPACE_NAME?.trim();

  if (!trimmedWorkspaceName) {
    workspaceSid = workspaceList[0].sid; //go to default workspace (for flex account)
  } else {
    workspaceSid = workspaceList.find(
      (w) =>
        w.friendly_name.toLowerCase() === trimmedWorkspaceName.toLowerCase(),
    )?.sid;

    if (!workspaceSid) {
      throw new Error(`Workspace '${trimmedWorkspaceName}' not found`);
    }
  }

  const workspaceUrl = `${taskrouterUrl}/Workspaces/${workspaceSid}`;

  /*
   * Download workspace resources from TaskRouter
   */

  const activityListResp = await asyncTwilioRequest(
    `${workspaceUrl}/Activities?PageSize=1000`,
    "GET",
  );

  const activityList = activityListResp.body.activities;

  const channelListResp = await asyncTwilioRequest(
    `${workspaceUrl}/TaskChannels?PageSize=1000`,
    "GET",
  );

  const channelList = channelListResp.body.channels;

  const queueListResp = await asyncTwilioRequest(
    `${workspaceUrl}/TaskQueues?PageSize=1000`,
    "GET",
  );

  const queueList = queueListResp.body.task_queues;

  const workflowListResp = await asyncTwilioRequest(
    `${workspaceUrl}/Workflows?PageSize=1000`,
    "GET",
  );

  const workflowList = workflowListResp.body.workflows;

  const workspaceResp = await asyncTwilioRequest(workspaceUrl, "GET");

  const workspace = workspaceResp.body;

  /*
   *  Transform Twilio resources into TaskRouter configuration schema
   */

  const config = {
    $schema:
      "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v5/.schemas/update-taskrouter.json",

    activities: [],
    workspace: {},
    channels: [],
    queues: [],
    workflows: [],
  };

  config.activities = activityList.map((activity) => ({
    friendlyName: activity.friendly_name,
    available: activity.available,
  }));

  config.channels = channelList.map((channel) => ({
    friendlyName: channel.friendly_name,
    uniqueName: channel.unique_name,
    channelOptimizedRouting: channel.channel_optimized_routing,
  }));

  const getActivityReference = (sid) => {
    const activity = activityList.find((a) => a.sid === sid);

    if (!activity) {
      return undefined;
    }

    return {
      friendlyName: activity.friendly_name,
    };
  };

  config.queues = queueList.map((queue) => ({
    friendlyName: queue.friendly_name,

    assignmentActivity: getActivityReference(queue.assignment_activity_sid),

    reservationActivity: getActivityReference(queue.reservation_activity_sid),

    maxReservedWorkers: queue.max_reserved_workers,

    targetWorkers: queue.target_workers,

    taskOrder: queue.task_order,
  }));

  config.workspace = {
    defaultActivity: getActivityReference(workspace.default_activity_sid),

    eventCallbackUrl: workspace.event_callback_url,

    eventsFilter: workspace.events_filter
      ? workspace.events_filter.split(",")
      : undefined,

    timeoutActivity: getActivityReference(workspace.timeout_activity_sid),

    prioritizeQueueOrder: workspace.prioritize_queue_order,
  };

  const getQueueReference = (sid) => {
    const queue = queueList.find((q) => q.sid === sid);

    if (!queue) {
      return undefined;
    }

    return {
      friendlyName: queue.friendly_name,
    };
  };

  config.workflows = workflowList.map((workflow) => {
    const workflowConfiguration = JSON.parse(workflow.configuration);

    if (workflowConfiguration.task_routing?.default_filter?.queue) {
      workflowConfiguration.task_routing.default_filter.queue =
        getQueueReference(
          workflowConfiguration.task_routing.default_filter.queue,
        );
    }
    for (const filter of workflowConfiguration.task_routing.filters ?? []) {
      for (const target of filter.targets ?? []) {
        target.queue = getQueueReference(target.queue);
      }
    }

    return {
      friendlyName: workflow.friendly_name,

      assignmentCallbackUrl: workflow.assignment_callback_url || undefined,

      fallbackAssignmentCallbackUrl:
        workflow.fallback_assignment_callback_url || undefined,

      taskReservationTimeout: workflow.task_reservation_timeout,

      configuration: workflowConfiguration,
    };
  });

  /*
   * Write configuration file
   */

  const fileContent = JSON.stringify(config, null, 2);

  let existingContent = "";
  if (existsSync(INPUT_CONFIG_PATH)) {
    existingContent = readFileSync(INPUT_CONFIG_PATH, "utf8");
  }

  /*
   * Skip PR creation if no TaskRouter changes were detected
   */

  if (existingContent === fileContent) {
    commands.logInfo(
      "No changes detected in Twilio. Skipping PR creation.",
      "green",
    );
    return;
  }

  writeFileSync(INPUT_CONFIG_PATH, fileContent, "utf8");

  commands.logInfo("Config file written successfully", "green");

  /*
   * Commit generated configuration and open a pull request
   */

  if (!process.env.GITHUB_RUN_NUMBER) {
    console.log("Not running in Actions.");
  } else {
    const { GITHUB_RUN_NUMBER } = process.env;

    const branch = `taskrouter/update-run-${GITHUB_RUN_NUMBER}`;

    const filesToCommit = [
      {
        path: INPUT_CONFIG_PATH,
        content: fileContent,
      },
    ];

    const githubService = GithubService(commands.getInput("TOKEN", true));

    await githubService.commitFiles(
      filesToCommit,
      branch,
      `auto: Sync TaskRouter configuration (${GITHUB_RUN_NUMBER})`,
    );

    await githubService.openPullRequest(
      branch,
      `Sync TaskRouter Configuration (Run ${GITHUB_RUN_NUMBER})`,
      `Generated TaskRouter configuration from run ${GITHUB_RUN_NUMBER}.`,
    );
  }
};

run().catch((err) => {
  commands.setFailed(err instanceof Error ? err.message : String(err));
});
