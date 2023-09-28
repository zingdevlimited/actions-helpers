#!/bin/bash
### DEPENDENCY scripts/src/create-plugin-version.sh --> scripts/src/lib/check-env.sh ###
### SOURCE scripts/src/lib/check-env.sh ###

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

### SOURCE scripts/src/create-plugin-version.sh ###

set -e

pluginName=$1
pluginVersion=$2
assetUrl=$3

if [ -z "$pluginName" ]; then
  echo "::error::Missing argument $\1: PLUGIN_NAME" >&2
  exit 1
fi

if [ -z "$pluginVersion" ]; then
  echo "::error::Missing argument $\2: PLUGIN_VERSION" >&2
  exit 1
fi

if [ -z "$assetUrl" ]; then
  echo "::error::Missing argument $\3: ASSET_URL" >&2
  exit 1
fi

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1

pluginResponse=$(curl -sX GET "https://flex-api.twilio.com/v1/PluginService/Plugins/$pluginName" \
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

if [ "$(echo "$pluginResponse" | jq -r .status)" == "404" ]; then
  pluginResponse=$(curl -sX POST "https://flex-api.twilio.com/v1/PluginService/Plugins" \
    --data-urlencode "UniqueName=$pluginName" \
    --data-urlencode "FriendlyName=$pluginName" \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")
fi

pluginSid=$(echo "$pluginResponse" | jq -r '.sid // empty')

if [ -z "$pluginSid" ]; then
  echo "::error::Error preparing plugin '$pluginName'. Response:" >&2
  echo "::error::$pluginResponse" >&2
  exit 1
fi

existingPluginVersionResponse=$(curl -sX GET "https://flex-api.twilio.com/v1/PluginService/Plugins/$pluginSid/Versions/$pluginVersion" \
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")
existingPluginVersionSid=$(echo "$existingPluginVersionResponse" | jq -r '.sid // empty')

if [ -n "$existingPluginVersionSid" ]; then
  echo "::warning::Plugin Version $pluginName@$pluginVersion already exists. ($existingPluginVersionSid). Skipping creation."
  exit 0
fi

createPluginVersionResponse=$(curl -sX POST "https://flex-api.twilio.com/v1/PluginService/Plugins/$pluginSid/Versions" \
  --data-urlencode "Version=$pluginVersion" \
  --data-urlencode "PluginUrl=$assetUrl" \
  --data-urlencode "Private=True" \
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

echo "$createPluginVersionResponse"
