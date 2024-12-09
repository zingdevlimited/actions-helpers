const { disableCustomFlexPlugins, resetFlexUiAttributes } = require("./areas/flex");
const { resetSync } = require("./areas/sync");
const { resetTaskrouter } = require("./areas/taskrouter");
const { resetServerless } = require("./areas/serverless");
const { resetStudio } = require("./areas/studio");

const {
  INPUT_TASKROUTER,
  INPUT_SYNC,
  INPUT_STUDIO,
  INPUT_SERVERLESS,
  INPUT_FLEX_CUSTOM_PLUGINS,
  INPUT_FLEX_UI_ATTRIBUTES,
} = process.env;

const run = async () => {
  if (INPUT_TASKROUTER?.trim() === "true") {
    console.log("Resetting Taskrouter...");
    await resetTaskrouter();
  }

  if (INPUT_SYNC?.trim() === "true") {
    console.log("Resetting Sync...");
    await resetSync();
  }

  if (INPUT_STUDIO?.trim() === "true") {
    console.log("Resetting Studio...");
    await resetStudio();
  }

  if (INPUT_SERVERLESS?.trim() === "true") {
    console.log("Resetting Serverless..");
    await resetServerless();
  }

  if (INPUT_FLEX_CUSTOM_PLUGINS?.trim() === "true") {
    console.log("Disabling all Custom Flex Plugins...");
    await disableCustomFlexPlugins();
  }

  if (INPUT_FLEX_UI_ATTRIBUTES?.trim() === "true") {
    console.log("Resetting Flex Configuration UI Attributes...");
    await resetFlexUiAttributes();
  }
}
run();
