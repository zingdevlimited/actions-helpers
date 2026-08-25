import { readFileSync } from "fs";
import { taskrouterSchema } from "../helpers/taskrouter-schema.mjs";
import { commands } from "../services/commands.mjs";

const run = async () => {
  try {
    const INPUT_CONFIG_PATH = commands.getInput("CONFIG_PATH", true);

    const fileContent = readFileSync(INPUT_CONFIG_PATH, "utf8");

    const config = JSON.parse(fileContent);

    const result = taskrouterSchema.safeParse(config);

    const fail = () => {
      commands.setFailed("Check failed ❌");
    };

    if (!result.success) {
      result.error.issues.forEach((issue) => {
        commands.logError(`${issue.path.join(".")}: ${issue.message}`);
      });

      fail();
      return;
    }

    const activityNames = new Set(
      (config.activities ?? []).map((a) => a.friendlyName.toLowerCase()),
    );

    //if there is no friendly name, we know there is a sid as zod mandates
    const activityExists = (reference) => {
      if (!reference?.friendlyName) {
        return true;
      }

      return activityNames.has(reference.friendlyName.toLowerCase());
    };

    const queueNames = new Set();

    const validateQueueActivityReferences = () => {
      for (const queue of config.queues ?? []) {
        queueNames.add(queue.friendlyName.toLowerCase());

        if (
          queue.assignmentActivity &&
          !activityExists(queue.assignmentActivity)
        ) {
          commands.logError(
            `Queue '${queue.friendlyName}' references unknown assignmentActivity '${queue.assignmentActivity.friendlyName}'`,
          );
          return false;
        }

        if (
          queue.reservationActivity &&
          !activityExists(queue.reservationActivity)
        ) {
          commands.logError(
            `Queue '${queue.friendlyName}' references unknown reservationActivity '${queue.reservationActivity.friendlyName}'`,
          );
          return false;
        }
      }
      return true;
    };
    const queueExists = (reference) => {
      if (!reference?.friendlyName) {
        return true;
      }

      return queueNames.has(reference.friendlyName.toLowerCase());
    };

    const validateWorkspaceActivityReferences = () => {
      if (
        config.workspace?.defaultActivity &&
        !activityExists(config.workspace.defaultActivity)
      ) {
        commands.logError(
          `workspace.defaultActivity references unknown activity '${config.workspace.defaultActivity.friendlyName}'`,
        );
        return false;
      }
      if (
        config.workspace?.timeoutActivity &&
        !activityExists(config.workspace.timeoutActivity)
      ) {
        commands.logError(
          `workspace.timeoutActivity references unknown activity '${config.workspace.timeoutActivity.friendlyName}'`,
        );
        return false;
      }

      return true;
    };

    const validateWorkflowReferences = () => {
      for (const workflow of config.workflows ?? []) {
        const routing = workflow.configuration.task_routing;

        if (
          routing.default_filter?.queue &&
          !queueExists(routing.default_filter.queue)
        ) {
          commands.logError(
            `Workflow '${workflow.friendlyName}' references unknown queue '${routing.default_filter.queue.friendlyName}' in default_filter`,
          );
          return false;
        }

        for (const filter of routing.filters) {
          for (const target of filter.targets) {
            if (!queueExists(target.queue)) {
              commands.logError(
                `Workflow '${workflow.friendlyName}' filter '${filter.filter_friendly_name}' references unknown queue '${target.queue.friendlyName}'`,
              );
              return false;
            }
          }
        }
      }

      return true;
    };

    if (!validateQueueActivityReferences()) {
      fail();
      return;
    }

    if (!validateWorkspaceActivityReferences()) {
      fail();
      return;
    }

    if (!validateWorkflowReferences()) {
      fail();
      return;
    }

    commands.logInfo("Passed ✅", "green");
  } catch (err) {
    commands.setFailed(err instanceof Error ? err.message : String(err));
  }
};

run();
