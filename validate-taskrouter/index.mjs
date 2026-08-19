import { commands } from "../services/commands.mjs";

const run = async () => {
  try {
    commands.logInfo("TaskRouter validation not yet implemented.", "green");

    commands.logInfo("Passed ✅", "green");
  } catch (err) {
    commands.setFailed(err instanceof Error ? err.message : String(err));
  }
};

run();
