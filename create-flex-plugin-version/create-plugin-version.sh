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

### DEPENDENCY scripts/src/create-plugin-version.sh --> scripts/src/lib/twilio-serverless/services.sh ###
### SOURCE scripts/src/lib/twilio-serverless/services.sh ###

function getService {
  local serviceName ignoreNotFound

  serviceName=$1
  ignoreNotFound=$2

  local serviceResponse serviceSid

  serviceResponse=$(curl -sX GET "https://serverless.twilio.com/v1/Services/$serviceName" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
  responseStatus=$(echo "$serviceResponse" | jq -r .status)

  if [ "$responseStatus" == "404" ] && [ "$ignoreNotFound" == "true" ]; then
    echo "Service '$serviceName' not found. Returning empty" >&2
    echo ""
    exit 0
  fi

  serviceSid=$(echo "$serviceResponse" | jq -r '.sid // empty')

  if [ -z "$serviceSid" ]; then
    echo "::error::Failed to fetch Functions Service '$serviceName'. Response:" >&2
    echo "::error::$serviceResponse" >&2
    exit 1
  fi

  echo "$serviceResponse"
}

function prepareService {
  local serviceName includeCredentials

  serviceName=$1
  [[ "$2" == "true" ]] && includeCredentials="True" || includeCredentials="False"

  local serviceResponse serviceSid

  serviceResponse=$(getService "$serviceName" "true") || exit 1

  if [ -z "$serviceResponse" ]; then
    serviceResponse=$(curl -sX POST "https://serverless.twilio.com/v1/Services" \
      --data-urlencode "IncludeCredentials=$includeCredentials" \
      --data-urlencode "UiEditable=True" \
      --data-urlencode "UniqueName=$serviceName" \
      --data-urlencode "FriendlyName=$serviceName" \
      -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")
  fi

  serviceSid=$(echo "$serviceResponse" | jq -r '.sid // empty')

  if [ -z "$serviceSid" ]; then
    echo "::error::Failed to get/create Service '$serviceName'. Response:" >&2
    echo "::error::$serviceResponse" >&2
    exit 1
  fi

  echo "Functions Service $serviceName/$serviceSid" >&2

  echo "$serviceSid"
}

### DEPENDENCY scripts/src/create-plugin-version.sh --> scripts/src/lib/twilio-serverless/environments.sh ###
### SOURCE scripts/src/lib/twilio-serverless/environments.sh ###

function getEnvironment {
  local serviceSid environmentSuffix

  serviceSid=$1
  environmentSuffix=$2
  ignoreNotFound=$3

  [[ -z "$environmentSuffix" ]] && environmentSuffix="null"

  local environmentListResponse environments searchValue environment

  environmentListResponse=$(curl -sX GET "https://serverless.twilio.com/v1/Services/$serviceSid/Environments" \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

  environments="$(echo "$environmentListResponse" | jq '.environments // empty')"

  if [ -z "$environments" ]; then
    echo "::error::Failed to list Environments. Response:" >&2
    echo "::error::$environmentListResponse" >&2
    exit 1
  fi

  [[ "$environmentSuffix" == "null" ]] && searchValue="null" || searchValue="\"$environmentSuffix\""
  environment=$(echo "$environments" | jq \
    --argjson SUFFIX "$searchValue" '.[] | select(.domain_suffix==$SUFFIX) // empty')

  if [ -z "$environment" ]; then

    if [ "$ignoreNotFound" == "true" ]; then
      echo "Environment with suffix $environmentSuffix not found. Returning empty." >&2
      echo ""
      exit 0
    fi

    echo "::error::Environment with the provided suffix $environmentSuffix does not exist." >&2
    exit 1
  fi

  echo "$environment"
}

function prepareEnvironment {
  local serviceSid environmentSuffix envName

  serviceSid=$1
  environmentSuffix=$2
  [[ "$environmentSuffix" == "null" ]] && envName="production" || envName="$environmentSuffix"

  [[ -z "$environmentSuffix" ]] && environmentSuffix="null"

  local environmentResponse environmentSid

  environmentResponse=$(getEnvironment "$serviceSid" "$environmentSuffix" "true") || exit 1

  if [ -z "$environmentResponse" ]; then
    environmentResponse=$(curl -sX POST "https://serverless.twilio.com/v1/Services/$serviceSid/Environments" \
      --data-urlencode "DomainSuffix=$environmentSuffix" \
      --data-urlencode "UniqueName=$envName" \
      -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
  fi

  environmentSid=$(echo "$environmentResponse" | jq -r '.sid // empty')

  if [ -z "$environmentSid" ]; then
    echo "::error::Failed to get/create Environment '$environmentSuffix'. Response:" >&2
    echo "::error::$environmentResponse" >&2
    exit 1
  fi

  echo "Functions Environment $environmentSuffix/$environmentSid" >&2

  echo "$environmentSid"
}

### SOURCE scripts/src/create-plugin-version.sh ###

set -e

pluginName=$1
pluginVersion=$2

if [ -z "$pluginName" ]; then
  echo "::error::Missing argument $\1: PLUGIN_NAME" >&2
  exit 1
fi

if [ -z "$pluginVersion" ]; then
  echo "::error::Missing argument $\2: PLUGIN_VERSION" >&2
  exit 1
fi

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1


pluginService=$(getService "default") || exit 1
pluginServiceSid=$(echo "$pluginService" | jq -r .sid)

pluginEnvironment=$(getEnvironment "$pluginServiceSid" "ci") || exit 1
pluginDomainName=$(echo "$pluginEnvironment" | jq -r '.domain_name')

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
  echo "::warning::Plugin Version $pluginName@$pluginVersion already exists. ($existingPluginVersionSid). Skipping deployment."
  exit 0
fi

createPluginVersionResponse=$(curl -sX POST "https://flex-api.twilio.com/v1/PluginService/Plugins/$pluginSid/Versions" \
  --data-urlencode "Version=$pluginVersion" \
  --data-urlencode "PluginUrl=https://$pluginDomainName/plugins/$pluginName/$pluginVersion/bundle.js" \
  --data-urlencode "Private=True" \
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

echo "$createPluginVersionResponse"
