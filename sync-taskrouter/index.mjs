import { writeFileSync } from "fs";
import { GithubService } from "../services/github-service.mjs";
import { commands } from "../services/commands.mjs";

//gets inputs
const INPUT_CONFIG_PATH =
    commands.getInput("CONFIG_PATH", true);

const INPUT_TWILIO_API_KEY =
    commands.getInput("TWILIO_API_KEY", true);

const INPUT_TWILIO_API_SECRET =
    commands.getInput("TWILIO_API_SECRET", true);

const INPUT_WORKSPACE_NAME =
    commands.getOptionalInput("WORKSPACE_NAME");
    

//copied exactly from update-taskrouter
//asyncTwilioRequest helper
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

//finds workspace
const taskrouterUrl = 'https://taskrouter.twilio.com/v1';

//requests workspaces
const workspaceListResp = await asyncTwilioRequest(
    `${taskrouterUrl}/Workspaces`,
    'GET',
);
//gets workspaces list
const workspaceList = workspaceListResp.body.workspaces;

//if none found
if (!workspaceList.length) {
    throw new Error('No Taskrouter Workspaces found');
}

//resolve the workspace - which workspace to use
let workspaceSid;
const trimmedWorkspaceName = INPUT_WORKSPACE_NAME?.trim();

//if none given in inputs
if (!trimmedWorkspaceName) {
    workspaceSid = workspaceList[0].sid; //go to default workspace 
} else {
    //find workspace based on friendly name
    workspaceSid = workspaceList.find(
        w =>
        w.friendly_name.toLowerCase() ===
        trimmedWorkspaceName.toLowerCase(),
    )?.sid;

    if (!workspaceSid) {
        throw new Error(
        `Workspace '${trimmedWorkspaceName}' not found`
        );
    }
}

//build workspace url
const workspaceUrl =
    `${taskrouterUrl}/Workspaces/${workspaceSid}`;



/* Download all resources from that workspace 
   Activities, channels, queues, worflows
*/

const activityListResp = await asyncTwilioRequest(
    `${workspaceUrl}/Activities`,
    'GET',
);

const activityList = activityListResp.body.activities;

const channelListResp = await asyncTwilioRequest(
    `${workspaceUrl}/TaskChannels`,
    'GET',
);

const channelList = channelListResp.body.channels;

const queueListResp = await asyncTwilioRequest(
    `${workspaceUrl}/TaskQueues?PageSize=1000`,
    'GET',
);

const queueList = queueListResp.body.task_queues;

const workflowListResp = await asyncTwilioRequest(
    `${workspaceUrl}/Workflows`,
    'GET',
);

const workflowList = workflowListResp.body.workflows;


//workspace configuration
const workspaceResp = await asyncTwilioRequest(
    workspaceUrl,
    'GET',
);

const workspace = workspaceResp.body;

console.log(`Activities: ${activityList.length}`);

console.log(`Channels: ${channelList.length}`);

console.log(
  `Queues: ${queueList.length}`
);

console.log(
  `Workflows: ${workflowList.length}`
);

// console.log(
//     JSON.stringify(
//         JSON.parse(
//             workflowList[0].configuration
//         ),
//         null,
//         2
//     )
// );


//PUTTING DATA FROM TWILIO INTO SCHEMA 

//creating object based on schema that wew ill populate witht he twilio data
const config = {
    //code editor checks against schema - not actually run at runtime (this line only)
    $schema:
    "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/update-taskrouter.json",

    activities: [],
    workspace: {},
    channels: [],
    queues: [],
    workflows: [],
};

//activities
//loops throuh every activity and creates array for each one
config.activities = activityList.map(activity => (
    {
        friendlyName: activity.friendly_name,
        available: activity.available,
    }
));

//channels
config.channels = channelList.map(channel => ({
    friendlyName: channel.friendly_name,
    uniqueName: channel.unique_name,
    channelOptimizedRouting:channel.channel_optimized_routing,
}));

//helper
// given an activity sid, returns friendly name for that activity (worker status)
const getActivityReference = (sid) => {
    //look through activities, return first activity taht matches sid specified 
    const activity = activityList.find(
        a => a.sid === sid
    );

    if (!activity) {
        return undefined;
    }

    return {
        friendlyName: activity.friendly_name,
    };
};

//queues 
config.queues = queueList.map(queue => ({
    friendlyName: queue.friendly_name,

    //what status worker should be in when task assigned to them
    assignmentActivity:
        getActivityReference(
        queue.assignment_activity_sid
        ),

    //what status worker should be in when task given to them (reserved)
    reservationActivity:
        getActivityReference(
        queue.reservation_activity_sid
        ),

    maxReservedWorkers:
        queue.max_reserved_workers,

    targetWorkers:
        queue.target_workers,

    taskOrder:
        queue.task_order,
}));

//workspaces
config.workspace = {

    //the status worker should be set to when worker created in that workspace  
    defaultActivity: getActivityReference(workspace.default_activity_sid),

    eventCallbackUrl: workspace.event_callback_url,

    eventsFilter: workspace.events_filter? workspace.events_filter.split(","): undefined,

    //status set when timeout
    timeoutActivity: getActivityReference(workspace.timeout_activity_sid),

    prioritizeQueueOrder: workspace.prioritize_queue_order,
};

//workflows - replace queue SID with queue friendly name

//helper - gets queue friendly name based on queue sid
const getQueueReference = (sid) => {
    const queue = queueList.find(
        q => q.sid === sid
    );

    if (!queue) {
        return undefined;
    }

    return {
        friendlyName: queue.friendly_name,
    };
};

//goes through workflows 
config.workflows = workflowList.map(workflow => {
    
    const workflowConfiguration =JSON.parse(workflow.configuration);

    //checks if a default queue exists 
    if (workflowConfiguration.task_routing?.default_filter?.queue) 
    {
        //replaces queue sid with friendly name
        workflowConfiguration.task_routing.default_filter.queue = 
        getQueueReference(workflowConfiguration.task_routing.default_filter.queue);
    }

    //loops through every worflow filter and target in that filter, replacing queue sids with friendly names
    for (const filter of workflowConfiguration.task_routing.filters ?? []) 
    {
        for (const target of filter.targets ?? []) 
        {
            target.queue =
            getQueueReference(target.queue);
        }
    }

    //populates the schema
    return {
        friendlyName:
        workflow.friendly_name,

        assignmentCallbackUrl:
        workflow.assignment_callback_url || undefined,

        fallbackAssignmentCallbackUrl:
        workflow.fallback_assignment_callback_url || undefined,

        taskReservationTimeout:
        workflow.task_reservation_timeout,

        configuration:
        workflowConfiguration,
    };
});



//WRITING CONFIG FILE

// console.log(
//     JSON.stringify(config, null, 2)
// );

const fileContent = JSON.stringify(config, null, 2);

writeFileSync(
    INPUT_CONFIG_PATH,
    fileContent,
    "utf8"
);

console.log(
    'Config file written successfully'
);


//COMMITING and OPEN PR 


if (!process.env.GITHUB_RUN_NUMBER) {
    console.log("Not running in Actions.");
} else {
    const { GITHUB_RUN_NUMBER } = process.env;

    const branch =
        `taskrouter/update-run-${GITHUB_RUN_NUMBER}`;

    const filesToCommit = [
        {
            path: INPUT_CONFIG_PATH,
            content: fileContent,
        },
    ];

    const githubService = GithubService(
        commands.getInput("TOKEN", true)
    );

    await githubService.commitFiles(
        filesToCommit,
        branch,
        `auto: Sync TaskRouter configuration (${GITHUB_RUN_NUMBER})`
    );

    await githubService.openPullRequest(
        branch,
        `Sync TaskRouter Configuration (Run ${GITHUB_RUN_NUMBER})`,
        `Generated TaskRouter configuration from run ${GITHUB_RUN_NUMBER}.`
    );
}