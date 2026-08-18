import { readFileSync } from "fs";
import { taskrouterSchema } from "./validate-taskrouter-schema.mjs";
import { commands } from "../services/commands.mjs";

const INPUT_CONFIG_PATH =
  commands.getInput("CONFIG_PATH", true);

try {
    const fileContent = readFileSync(
        INPUT_CONFIG_PATH,
        "utf8"
    );

    const config = JSON.parse(fileContent);

    const result = taskrouterSchema.safeParse(config);

    if (!result.success) {
        commands.setFailed(
            JSON.stringify(
                result.error.issues,
                null,
                2
            )
        );
    }else{
        commands.logInfo("Passed");
    }

} catch (err) {
    commands.setFailed(err.message);
}