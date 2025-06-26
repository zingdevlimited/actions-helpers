import {
  asyncTwilioRequest,
  listDeleteUpdateCreate,
  getResourceSid,
} from "./shared.mjs";

const DEFAULTS = {
  Activities: [
    {
      FriendlyName: "Offline",
      Available: false,
    },
    {
      FriendlyName: "Available",
      Available: true,
    },
    {
      FriendlyName: "Unavailable",
      Available: false,
    },
    {
      FriendlyName: "Break",
      Available: false,
    },
  ],
  TaskChannels: [
    {
      FriendlyName: "Default",
      UniqueName: "default",
    },
    {
      FriendlyName: "Voice",
      UniqueName: "voice",
    },
    {
      FriendlyName: "Chat",
      UniqueName: "chat",
    },
    {
      FriendlyName: "SMS",
      UniqueName: "sms",
    },
    {
      FriendlyName: "Video",
      UniqueName: "video",
    },
    {
      FriendlyName: "Email",
      UniqueName: "email",
    },
  ],
  TaskQueues: [
    {
      FriendlyName: "Everyone",
      ReservationActivitySid: "",
      AssignmentActivitySid: "",
      MaximumReservedWorkers: 1,
      TargetWorkers: "1==1",
      TaskOrder: "FIFO",
    },
  ],
  Workflows: [
    {
      FriendlyName: "Assign to Anyone",
      TaskReservationTimeout: 120,
      AssignmentCallbackUrl: "",
      FallbackAssignmentCallbackUrl: "",
      Configuration: JSON.stringify({
        task_routing: {
          filters: [],
          default_filter: {
            queue: "<Everyone Queue Sid>",
          },
        },
      }),
    },
  ],
};

export const resetTaskrouter = async () => {
  const workspaceResponse = await asyncTwilioRequest(
    "https://taskrouter.twilio.com/v1/Workspaces",
    "GET"
  );
  const workspaceSid = workspaceResponse.body.workspaces[0].sid;
  const workspaceUrl = `https://taskrouter.twilio.com/v1/Workspaces/${workspaceSid}`;

  let everyoneQueueSid = await getResourceSid(
    workspaceUrl,
    "TaskQueues",
    "Everyone"
  );

  await listDeleteUpdateCreate(workspaceUrl, "Tasks", [], {
    skipCreate: true,
    skipUpdate: true,
  });
  await listDeleteUpdateCreate(workspaceUrl, "Workers", [], {
    skipCreate: true,
    skipUpdate: true,
  });

  if (everyoneQueueSid) {
    const defaultConfig = JSON.parse(DEFAULTS.Workflows[0].Configuration);
    defaultConfig.task_routing.default_filter.queue = everyoneQueueSid;
    DEFAULTS.Workflows[0].Configuration = JSON.stringify(defaultConfig);
    await listDeleteUpdateCreate(workspaceUrl, "Workflows", DEFAULTS.Workflows);
  } else {
    // Everyone Queue doesn't exist yet, just delete all workflows for now
    await listDeleteUpdateCreate(workspaceUrl, "Workflows", [], {
      skipCreate: true,
      skipUpdate: true,
    });
  }

  await listDeleteUpdateCreate(workspaceUrl, "TaskQueues", DEFAULTS.TaskQueues);

  if (!everyoneQueueSid) {
    // Create the default Workflow now that the Everyone queue exists
    everyoneQueueSid = await getResourceSid(
      workspaceUrl,
      "TaskQueues",
      "Everyone"
    );
    const defaultConfig = JSON.parse(DEFAULTS.Workflows[0].Configuration);
    defaultConfig.task_routing.default_filter.queue = everyoneQueueSid;
    DEFAULTS.Workflows[0].Configuration = JSON.stringify(defaultConfig);
    await listDeleteUpdateCreate(workspaceUrl, "Workflows", DEFAULTS.Workflows);
  }

  await listDeleteUpdateCreate(
    workspaceUrl,
    "TaskChannels",
    DEFAULTS.TaskChannels,
    { skipUpdate: true }
  );

  await listDeleteUpdateCreate(
    workspaceUrl,
    "Activities",
    DEFAULTS.Activities,
    { skipUpdate: true }
  );

  const offlineActivitySid = await getResourceSid(
    workspaceUrl,
    "Activities",
    "Offline"
  );
  await asyncTwilioRequest(
    `https://taskrouter.twilio.com/v1/Workspaces/${workspaceSid}`,
    "POST",
    new URLSearchParams({
      EventCallbackUrl: "",
      DefaultActivitySid: offlineActivitySid,
      TimeoutActivitySid: offlineActivitySid,
      PrioritizeQueueOrder: "FIFO",
      EventsFilter: "",
    })
  );
};
