import { readFileSync } from "fs";
import { taskrouterSchema } from "./validate-taskrouter-schema.mjs";
import { commands } from "../services/commands.mjs";

const run = async () => {
  try {
    const INPUT_CONFIG_PATH = commands.getInput("CONFIG_PATH", true);

    const fileContent = readFileSync(
      INPUT_CONFIG_PATH,
      "utf8"
    );

    const config = JSON.parse(fileContent);

    let success = true;


    const result = taskrouterSchema.safeParse(config);

    if (!result.success) {
      result.error.issues.forEach(issue => {
        commands.logError(
          `${issue.path.join(".")}: ${issue.message}`
        );
      });

      commands.setFailed("Check failed ❌");
      return;
    }

    const validateDuplicates = (values, description) => {
        const seen = new Set();

        for (const value of values) {
            const key = value.toLowerCase();

            if (seen.has(key)) {
                commands.logError(`Duplicate ${description}: '${value}'`);
                success = false;
            }

            seen.add(key);
        }
    };

    const activityNames = new Set(
        (config.activities ?? []).map(a => a.friendlyName.toLowerCase())
    );

    const queueNames = new Set(
        (config.queues ?? []).map(q => q.friendlyName.toLowerCase())
    );

    //if there is no friendly name, we know there is a sid as zod mandates
    const activityExists = reference => {
        if (!reference?.friendlyName) {
            return true;
        }

        return activityNames.has(reference.friendlyName.toLowerCase());
    };

    const queueExists = reference => {
        if (!reference?.friendlyName) {
            return true;
        }

        return queueNames.has(reference.friendlyName.toLowerCase());
    };


    validateDuplicates(
        (config.activities ?? []).map(a => a.friendlyName),
        "activity friendlyName"
    );

    validateDuplicates(
        (config.queues ?? []).map(q => q.friendlyName),
        "queue friendlyName"
    );

    validateDuplicates(
        (config.workflows ?? []).map(w => w.friendlyName),
        "workflow friendlyName"
    );

    validateDuplicates(
        (config.channels ?? []).map(c => c.uniqueName),
        "channel uniqueName"
    );

    if (config.workspace?.defaultActivity &&
        !activityExists(config.workspace.defaultActivity)
    ) {
        commands.logError(
            `workspace.defaultActivity references unknown activity '${config.workspace.defaultActivity.friendlyName}'`
        );
        success = false;
    }

    if (
        config.workspace?.timeoutActivity &&
        !activityExists(config.workspace.timeoutActivity)
    ) {
        commands.logError(
            `workspace.timeoutActivity references unknown activity '${config.workspace.timeoutActivity.friendlyName}'`
        );
        success = false;
    }

    for (const queue of config.queues ?? []) {
        if (
            queue.assignmentActivity &&
            !activityExists(queue.assignmentActivity)
        ) {
            commands.logError(
                `Queue '${queue.friendlyName}' references unknown assignmentActivity '${queue.assignmentActivity.friendlyName}'`
            );
            success = false;
        }

        if (
            queue.reservationActivity &&
            !activityExists(queue.reservationActivity)
        ) {
            commands.logError(
                `Queue '${queue.friendlyName}' references unknown reservationActivity '${queue.reservationActivity.friendlyName}'`
            );
            success = false;
        }
    }

    for (const workflow of config.workflows ?? []) {
        const routing =workflow.configuration.task_routing;

        if (
            routing.default_filter?.queue &&
            !queueExists(routing.default_filter.queue)
        ) {
            commands.logError(
                `Workflow '${workflow.friendlyName}' references unknown queue '${routing.default_filter.queue.friendlyName}' in default_filter`
            );
            success = false;
        }

        for (const filter of routing.filters) {
            for (const target of filter.targets) {
                if (!queueExists(target.queue)) {
                    commands.logError(
                        `Workflow '${workflow.friendlyName}' filter '${filter.filter_friendly_name}' references unknown queue '${target.queue.friendlyName}'`
                    );
                    success = false;
                }
            }
        }
    }

    if (!success) {
        commands.setFailed("Check failed ❌");
        return;
    }else{
        commands.logInfo("Passed ✅", "green");
    }

    
  } catch (err) {
    commands.setFailed(
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
};

run();