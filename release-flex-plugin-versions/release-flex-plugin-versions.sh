#!/bin/bash

function checkEnv {
  local missingEnv=0
  local requiredEnv=$1

  for envVar in $requiredEnv
  do
    if [ -z "${!envVar}" ]
    then
      echo "::error::Missing environment variable \$$envVar" >&2
      missingEnv=1
    fi
  done
  if [ $missingEnv != 0 ]
  then
    exit 1
  fi
}

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1

pluginList=$1
configurationName=$2
configurationDescription=$3

pluginListJson="{"
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  if [[ -z "$key" ]]; then
    continue
  fi

  key=$(echo "$key" | awk '{$1=$1};1')
  value=$(echo "$value" | awk '{$1=$1};1')

  pluginListJson+="\"$key\": \"$value\","
done <<< "$pluginList"

pluginListJson=${pluginListJson%,*}
pluginListJson+="}"

activeReleaseResponse=$(curl -sX GET "https://flex-api.twilio.com/v1/PluginService/Releases/Active" \
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

activeReleaseStatus=$(echo "$activeReleaseResponse" | jq -r '.status')
if [ "$activeReleaseStatus" == "404" ]; then
  # Fresh Flex account, no release exists.
  activeConfigurationSid=""
else
  activeConfigurationSid=$(echo "$activeReleaseResponse" | jq -r '.configuration_sid // empty')

  if [ -z "$activeConfigurationSid" ]; then
    echo "::error::Failed to retrieve Active Flex Plugin Release. Response: $activeReleaseResponse" >&2
    exit 1
  fi
fi

SUMMARY_FILE="TEMP_FLEX_PLUGIN_RELEASE_SUMMARY.md"
echo "## Flex Plugin Release" > "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "**Name**: $configurationName" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
if [ -n "$configurationDescription" ]; then
  echo "**Description**: $configurationDescription" >> "$SUMMARY_FILE"
  echo "" >> "$SUMMARY_FILE"
fi
echo "| Plugin | Version |" >> "$SUMMARY_FILE"
echo "| ------ | ------- |" >> "$SUMMARY_FILE"

dataPayload="";
if [ -n "$activeConfigurationSid" ]; then
  configurationPluginsResponse=$(curl -sX GET "https://flex-api.twilio.com/v1/PluginService/Configurations/$activeConfigurationSid/Plugins" \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

  configurationPlugins=$(echo "$configurationPluginsResponse" | jq -r '.plugins // empty')

  if [ -z "$configurationPlugins" ]; then
    echo "::error::Failed to retrieve Active Plugin List. Response: $configurationPluginsResponse" >&2
    exit 1
  fi

  for plugin in $(echo "$configurationPlugins" | jq -c '.[]'); do
    pluginName=$(echo "$plugin" | jq -r '.unique_name')

    if [ "$(echo "$pluginListJson" | jq "keys | any(. == \"$pluginName\") | not")" == "true" ]; then
      pluginVersion=$(echo "$plugin" | jq -r '.version')
      pluginVersionSid=$(echo "$plugin" | jq -r '.plugin_version_sid')
      pluginVersionEncoded=$(echo "{\"plugin_version\": \"$pluginVersionSid\"}" | jq -jr '@uri')
      dataPayload+="Plugins=$pluginVersionEncoded&"

      echo "| $pluginName | $pluginVersion |" >> "$SUMMARY_FILE"
    fi
  done
fi

for pluginName in $(echo "$pluginListJson" | jq -rc 'keys[]'); do
  pluginVersion=$(echo "$pluginListJson" | jq -r ".[\"$pluginName\"]")
  pluginVersionResponse=$(curl -sX GET "https://flex-api.twilio.com/v1/PluginService/Plugins/$pluginName/Versions/$pluginVersion" \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

  pluginVersionSid=$(echo "$pluginVersionResponse" | jq -r '.sid')
  pluginVersionEncoded=$(echo "{\"plugin_version\": \"$pluginVersionSid\"}" | jq -jr '@uri')
  dataPayload+="Plugins=$pluginVersionEncoded&"

  echo "| **$pluginName** | **$pluginVersion** |" >> "$SUMMARY_FILE"
done
while IFS= read -r line && [[ -n $line ]]; do
  pluginVersionSid=$(echo "$line" | xargs)
  pluginVersionEncoded=$(echo "{\"plugin_version\": \"$pluginVersionSid\"}" | jq -jr '@uri')
  dataPayload+="Plugins=$pluginVersionEncoded&"
done <<< "$pluginList"

if [ -n "$configurationDescription" ]; then
  descriptionEncoded=$(echo "$configurationDescription" | jq -jRr '@uri')
  dataPayload+="Description=$descriptionEncoded&"
fi

nameEncoded=$(echo "$configurationName" | jq -jRr '@uri')
dataPayload+="Name=$nameEncoded"

newConfigurationResponse=$(curl -sX POST "https://flex-api.twilio.com/v1/PluginService/Configurations" \
  -d "$dataPayload" \
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

newConfigurationSid=$(echo "$newConfigurationResponse" | jq -r '.sid // empty')

if [ -z "$newConfigurationSid" ]; then
  echo "::error::Failed to create new Plugin Configuration. Response: $newConfigurationResponse" >&2
  exit 1
fi

newReleaseResponse=$(curl -sX POST "https://flex-api.twilio.com/v1/PluginService/Releases" \
  --data-urlencode "ConfigurationId=$newConfigurationSid" \
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

newReleaseSid=$(echo "$newReleaseResponse" | jq -r ".sid // empty")

if [ -z "$newReleaseSid" ]; then
  echo "::error::Failed to create new Plugin Release. Response: $newReleaseResponse" >&2
  exit 1
fi

echo "" >> "$SUMMARY_FILE"
echo "**Configuration Sid**: $newConfigurationSid" >> "$SUMMARY_FILE"
echo "" >> "$SUMMARY_FILE"
echo "**Release Sid**: $newReleaseSid" >> "$SUMMARY_FILE"

if [ -n "$GITHUB_STEP_SUMMARY" ]; then
  cat "$SUMMARY_FILE" >> "$GITHUB_STEP_SUMMARY"
fi

if [ -n "$GITHUB_OUTPUT" ]; then
  echo "CONFIGURATION_SID=$newConfigurationSid" >> "$GITHUB_OUTPUT"
  echo "RELEASE_SID=$newReleaseSid" >> "$GITHUB_OUTPUT"
fi

echo "$newReleaseResponse"
