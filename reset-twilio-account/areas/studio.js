const { listDeleteUpdateCreate } = require("./shared");

const resetStudio = async () => {
  await listDeleteUpdateCreate("https://studio.twilio.com/v2", "Flows", [], { skipCreate: true, skipUpdate: true });
}

module.exports = { resetStudio };
