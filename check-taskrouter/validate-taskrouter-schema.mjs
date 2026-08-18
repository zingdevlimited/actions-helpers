import { z } from "zod";

const activitySchema = z
  .object({
    friendlyName: z.string(),
    available: z.boolean(),
  })
  .strict();


//a reference to an existing activity for queue to use
const activityReferenceSchema = z
  .object({
    friendlyName: z.string().optional(),
    sid: z.string().optional(),
  })
  .strict()
  //schema allows no friendly name or sid but this would not be helpful 
  .refine(
    activity => activity.friendlyName || activity.sid,
    {
      message:
        "Either friendlyName or sid must be provided",
    }
  );

const workspaceSchema = z
  .object({
    defaultActivity:
      activityReferenceSchema.optional(),

    eventCallbackUrl:
      z.string().optional(),

    eventsFilter:
      z.array(z.string()).optional(),

    timeoutActivity:
      activityReferenceSchema.optional(),

    prioritizeQueueOrder: z
      .enum(["FIFO", "LIFO"])
      .optional(),
  })
  .strict();

const channelSchema = z
  .object({
    friendlyName: z.string(),

    uniqueName: z.string(),

    channelOptimizedRouting:
      z.boolean().optional(),
  })
  .strict();



const queueSchema = z
  .object({
    friendlyName: z.string(),

    assignmentActivity:
      activityReferenceSchema.optional(),

    reservationActivity:
      activityReferenceSchema.optional(),

    maxReservedWorkers: z
      .number()
      .min(1)
      .max(50)
      .optional(),

    targetWorkers: z.string().optional(),

    taskOrder: z
      .enum(["FIFO", "LIFO"])
      .optional(),
  })
  .strict();


const queueReferenceSchema = z
  .object({
    friendlyName: z.string().optional(),
    sid: z.string().optional(),
  })
  .strict()
  .refine(
    queue => queue.friendlyName || queue.sid,
    {
      message:
        "Either friendlyName or sid must be provided",
    }
  );

const workflowTargetSchema = z
  .object({
    queue: queueReferenceSchema,

    priority: z.number().optional(),

    timeout: z.number().min(1).optional(),

    expression: z.string().optional(),

    known_worker_sid: z.string().optional(),

    known_worker_friendly_name:
      z.string().optional(),

    order_by: z.string().optional(),

    skip_if: z.string().optional(),
  })
  .strict();

const workflowFilterSchema = z
  .object({
    filter_friendly_name:
      z.string(),

    expression:
      z.string(),

    targets:
      z.array(workflowTargetSchema),
  })
  .strict();

const taskRoutingSchema = z
  .object({
    filters:
      z.array(workflowFilterSchema),

    default_filter: z
      .object({
        queue:
          queueReferenceSchema,
      })
      .strict()
      .optional(),
  })
  .strict();

const workflowConfigurationSchema = z
  .object({
    task_routing:
      taskRoutingSchema,
  })
  .strict();

const workflowSchema = z
  .object({
    friendlyName: z.string(),

    assignmentCallbackUrl:
      z.string().optional(),

    fallbackAssignmentCallbackUrl:
      z.string().optional(),

    taskReservationTimeout: z
      .number()
      .min(1)
      .max(86400)
      .optional(),

    configuration:
      workflowConfigurationSchema,
  })
  .strict();

export const taskrouterSchema = z
  .object({
    $schema: z.string().optional(),

    //empty arrays allowed

    activities: z.array(activitySchema).optional(),

    workspace: workspaceSchema.optional(), //just one workspace 

    channels: z.array(channelSchema).optional(),

    queues: z.array(queueSchema).optional(),

    workflows: z.array(workflowSchema).optional(),
  })
  .strict();