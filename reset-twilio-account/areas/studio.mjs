import { listDeleteUpdateCreate } from "./shared.mjs";

export const resetStudio = async () => {
  await listDeleteUpdateCreate("https://studio.twilio.com/v2", "Flows", [], {
    skipCreate: true,
    skipUpdate: true,
  });
};
