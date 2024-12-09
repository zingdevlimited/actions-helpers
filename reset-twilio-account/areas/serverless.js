const { listDeleteUpdateCreate } = require("./shared");

const DEFAULTS = {
  Services: [
    {
      FriendlyName: "Flex Plugins Service (Autogenerated) - Do Not Delete",
      UniqueName: "default"
    }
  ]
};

const resetServerless = async () => {
  await listDeleteUpdateCreate("https://serverless.twilio.com/v1", "Services", DEFAULTS.Services, { skipCreate: true, skipUpdate: true });
}

module.exports = { resetServerless };
