import { readFileSync } from "fs";
import { taskrouterSchema } from "./validate-taskrouter-schema.mjs";
import { commands } from "../services/commands.mjs";

const run = async () => {
  try {
    const INPUT_CONFIG_PATH =
      commands.getInput("CONFIG_PATH", true);

    const fileContent = readFileSync(
      INPUT_CONFIG_PATH,
      "utf8"
    );

    const config = JSON.parse(fileContent);

    const result =
      taskrouterSchema.safeParse(config);

    if (!result.success) {
      result.error.issues.forEach(issue => {
        commands.logError(
          `${issue.path.join(".")}: ${issue.message}`
        );
      });

      commands.setFailed("Check failed ❌");
      return;
    }

    commands.logInfo("Passed ✅", "green");
  } catch (err) {
    commands.setFailed(
      err instanceof Error
        ? err.message
        : String(err)
    );
  }
};

run();