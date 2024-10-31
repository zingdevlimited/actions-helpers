const { asyncTwilioRequest } = require("./shared");

const {
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET
} = process.env;

const DEFAULTS = {
  uiAttributes: {
    notifications: {
      browser: false
    },
    theme: {
      isLight: true
    },
    version_compatibility: "yes",
    warmTransfers: {
      enabled: true
    }
  }
}

const disableCustomFlexPlugins = async () => {
  const pluginConfigResp = await asyncTwilioRequest("https://flex-api.twilio.com/v1/PluginService/Configurations", "POST", new URLSearchParams({
    Name: "Disable All Custom Plugins"
  }));
  const configSid = pluginConfigResp.body.sid;

  await asyncTwilioRequest("https://flex-api.twilio.com/v1/PluginService/Releases", "POST", new URLSearchParams({
    ConfigurationId: configSid
  }));
}


const resetFlexUiAttributes = async () => {
  const headers = {
    "Authorization": "Basic " + Buffer.from(`${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`).toString("base64"),
    "Content-Type": "application/json"
  };
  const configurationUrl = "https://flex-api.twilio.com/v1/Configuration";

  const currentConfigResp = await fetch(configurationUrl, { headers });
  if (currentConfigResp.status < 200 || currentConfigResp.status >= 300) {
    throw new Error(`Error fetching config: ${await currentConfigResp.text()}`);
  }
  
  const currentConfig = await currentConfigResp.json();

  const updatedConfigResp = await fetch(configurationUrl, {
    headers,
    method: "POST",
    body: JSON.stringify({ ui_attributes: DEFAULTS.uiAttributes, account_sid: currentConfig.account_sid })
  });

  if (updatedConfigResp.status < 200 || updatedConfigResp >= 300) {
    throw new Error(`Error updating config: ${await updatedConfigResp.text()}`);
  }
}

module.exports = { disableCustomFlexPlugins, resetFlexUiAttributes }