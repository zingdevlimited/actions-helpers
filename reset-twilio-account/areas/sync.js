const { listDeleteUpdateCreate, getResourceSid } = require("./shared");

const DEFAULTS = {
  Services: [
    {
      FriendlyName: "Default Service",
      UniqueName: "default",
      AclEnabled: false,
      ReachabilityEnabled: false,
      WebhookUrl: ""
    }
  ]
};

const resetSync = async () => {
  await listDeleteUpdateCreate("https://sync.twilio.com/v1", "Services", DEFAULTS.Services, { skipCreate: true });
    
  const defaultServiceSid = await getResourceSid("https://sync.twilio.com/v1", "Services", "default");

  if (defaultServiceSid) {
    const defaultServiceUrl = "https://sync.twilio.com/v1/Services/default";
    await listDeleteUpdateCreate(defaultServiceUrl, "Documents", [], { skipCreate: true, skipUpdate: true });
    await listDeleteUpdateCreate(defaultServiceUrl, "Lists", [], { skipCreate: true, skipUpdate: true });
    await listDeleteUpdateCreate(defaultServiceUrl, "Maps", [], { skipCreate: true, skipUpdate: true });
    await listDeleteUpdateCreate(defaultServiceUrl, "Streams", [], { skipCreate: true, skipUpdate: true });
  }
}

module.exports = { resetSync };
