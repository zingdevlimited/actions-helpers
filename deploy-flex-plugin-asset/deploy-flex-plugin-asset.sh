#!/bin/bash
### DEPENDENCY scripts/src/deploy-twilio-asset.sh --> scripts/src/lib/check-env.sh ###
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

### DEPENDENCY scripts/src/deploy-twilio-asset.sh --> scripts/src/lib/twilio-serverless/services.sh ###
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

### DEPENDENCY scripts/src/deploy-twilio-asset.sh --> scripts/src/lib/twilio-serverless/environments.sh ###
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

function listEnvironments {
  local serviceSid

  serviceSid=$1
  environmentListResponse=$(curl -sX GET "https://serverless.twilio.com/v1/Services/$serviceSid/Environments" \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET")

  environments="$(echo "$environmentListResponse" | jq '.environments // empty')"

  if [ -z "$environments" ]; then
    echo "::error::Failed to list Environments. Response:" >&2
    echo "::error::$environmentListResponse" >&2
    exit 1
  fi

  echo "$environments"
}

function createEnvironment {
  local serviceSid environmentName environmentSuffix

  serviceSid=$1
  environmentName=$2
  environmentSuffix=$3

  local environmentResponse environmentSid

  environmentResponse=$(curl -sX POST "https://serverless.twilio.com/v1/Services/$serviceSid/Environments" \
    --data-urlencode "DomainSuffix=$environmentSuffix" \
    --data-urlencode "UniqueName=$environmentName" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  environmentSid=$(echo "$environmentResponse" | jq -r '.sid // empty')

  if [ -z "$environmentSid" ]; then
    echo "::error::Failed to get/create Environment '$environmentSuffix'. Response:" >&2
    echo "::error::$environmentResponse" >&2
    exit 1
  fi
  
  echo "Functions Environment $environmentSuffix/$environmentSid" >&2

  echo "$environmentResponse"
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

### DEPENDENCY scripts/src/deploy-twilio-asset.sh --> scripts/src/lib/twilio-serverless/asset-funcs.sh ###
### SOURCE scripts/src/lib/twilio-serverless/asset-funcs.sh ###

function listAssets {
  local serviceSid

  serviceSid=$1

  assetListResponse=$(curl -sX GET "https://serverless.twilio.com/v1/Services/$serviceSid/Assets" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  assets=$(echo "$assetListResponse" | jq ".assets // empty")

  if [ -z "$assets" ]; then
    echo "::error::Failed to list Assets. Response:" >&2
    echo "::error::$assetListResponse" >&2
    exit 1
  fi

  echo "$assets"
}

function listFunctions {
  local serviceSid

  serviceSid=$1

  functionListResponse=$(curl -sX GET "https://serverless.twilio.com/v1/Services/$serviceSid/Functions" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  functions=$(echo "$functionListResponse" | jq ".functions // empty")

  if [ -z "$functions" ]; then
    echo "::error::Failed to list Functions. Response:" >&2
    echo "::error::$functionListResponse" >&2
    exit 1
  fi

  echo "$functions"
}

function upsertAssetOrFunction {
  local apiType serviceSid itemList sourceFilePath friendlyName saveToPath fileType visibility

  apiType=$1
  serviceSid=$2
  itemList=$3
  sourceFilePath=$4
  friendlyName=$5
  saveToPath=$6
  fileType=$7
  visibility=$8

  if [ ! -f "$sourceFilePath" ]; then
    echo "::error::Could not find file path '$sourceFilePath'" >&2
    exit 1
  fi

  [[ -z "$visibility" ]] && visibility="private"

  local itemSid itemResponse itemVersionResponse itemVersionSid

  itemSid=$(echo "$itemList" | jq -r \
    --arg ITEM_NAME "$friendlyName" '.[] | select(.friendly_name==$ITEM_NAME) | .sid // empty')

  if [ -z "$itemSid" ]; then
    itemResponse=$(curl -sX POST "https://serverless.twilio.com/v1/Services/$serviceSid/$apiType" \
      --data-urlencode "FriendlyName=$friendlyName" \
      -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
    itemSid=$(echo "$itemResponse" | jq -r '.sid // empty')

    if [ -z "$itemSid" ]; then
      echo "::error::Failed to create $apiType '$friendlyName'. Response:" >&2
      echo "::error::$itemResponse" >&2
      exit 1
    fi
  fi

  echo "$apiType $friendlyName/$itemSid" >&2

  itemVersionResponse=$(curl -sX POST "https://serverless-upload.twilio.com/v1/Services/$serviceSid/$apiType/$itemSid/Versions" \
    -F "Content=@$sourceFilePath; type=$fileType" \
    -F "Path=/$saveToPath" \
    -F "Visibility=$visibility" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
  itemVersionSid=$(echo "$itemVersionResponse" | jq -r '.sid // empty')

  if [ -z "$itemVersionSid" ]; then
    echo "::error::Failed to create $apiType version for '$friendlyName' with File '$sourceFilePath' at URL path '$saveToPath' ($visibility). Response:" >&2
    echo "::error::$itemVersionResponse" >&2
    exit 1
  fi

  echo "Created $apiType version ($friendlyName/$itemVersionSid) (/$saveToPath)[$visibility]" >&2

  echo "$itemVersionSid"
}

function upsertAsset {
  # $1 $2 $3 $4 $5 $6 $7
  # serviceSid assetList sourceFilePath friendlyName saveToPath fileType visibility
  upsertAssetOrFunction Assets "$1" "$2" "$3" "$4" "$5" "$6" "$7" || exit 1
}

function upsertFunction {
  # $1 $2 $3 $4 $5 $6
  # serviceSid functionList sourceFilePath friendlyName saveToPath visibility
  upsertAssetOrFunction Functions "$1" "$2" "$3" "$4" "$5" "application/javascript" "$6" || exit 1
}

### DEPENDENCY scripts/src/deploy-twilio-asset.sh --> scripts/src/lib/twilio-serverless/builds.sh ###
### SOURCE scripts/src/lib/twilio-serverless/builds.sh ###
BUILD_POLL_RATE=5
BUILD_POLL_COUNT=10

function getBuild {
  local serviceSid buildSid

  serviceSid=$1
  buildSid=$2

  local buildResponse

  buildResponse=$(curl -sX GET "https://serverless.twilio.com/v1/Services/$serviceSid/Builds/$buildSid" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  if [ -z "$(echo "$buildResponse" | jq -r '.sid // empty')" ]; then
    echo "::error::Failed to fetch Build $buildSid. Response:" >&2
    echo "::error::$buildResponse" >&2
    exit 1
  fi

  echo "$buildResponse"
}

function isArray {
  inputString=$1
  isArray=$(echo "$inputString" | jq -e 'if type == "array" then true else false end' 2>/dev/null)
  [[ "$isArray" == "true" ]] && echo "true" || echo ""
}

function createBuild {
  local serviceSid functionVersions assetVersions

  serviceSid=$1
  functionVersions=$2
  assetVersions=$3

  local buildResponse buildSid timeout timePassed buildStatus statusResponse

  data=""

  if [[ -n $(isArray "$functionVersions") ]]; then
    for version in $(echo "$functionVersions" | jq -r '.[]'); do
      data+="FunctionVersions=$version&"
    done
  elif [[ -n "$functionVersions" ]]; then
    data+="FunctionVersions=$functionVersions&"
  fi

  if [[ -n $(isArray "$assetVersions") ]]; then
    for version in $(echo "$assetVersions" | jq -r '.[]'); do
      data+="AssetVersions=$version&"
    done
  elif [[ -n "$assetVersions" ]]; then
    data+="AssetVersions=$assetVersions&"
  fi

  if [ -z "$data" ]; then
    echo "::error:: No Function Versions or Asset Versions were provided" >&2
    exit 1
  fi
  data=${data::-1}

  buildResponse=$(curl -sX POST "https://serverless.twilio.com/v1/Services/$serviceSid/Builds" \
    -d "$data" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  buildSid=$(echo "$buildResponse" | jq -r '.sid // empty')

  if [ -z "$buildSid" ]; then
    echo "::error::Failed to create Build with Function Versions: $2 / Asset Versions: $3. Response:" >&2
    echo "::error::$buildResponse" >&2
    exit 1
  fi

  timeout=$((BUILD_POLL_RATE * BUILD_POLL_COUNT))
  echo "Starting Build $serviceSid/$buildSid... (Timeout: $timeout seconds)" >&2

  buildStatus="building"
  for ((it = 1; it <= BUILD_POLL_COUNT; it++)); do
    sleep $BUILD_POLL_RATE
    timePassed=$((it * BUILD_POLL_RATE))

    echo -n "[$timePassed seconds] Polling build status... " >&2
    statusResponse=$(curl -sX GET "https://serverless.twilio.com/v1/Services/$serviceSid/Builds/$buildSid/Status" \
      -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
    buildStatus=$(echo "$statusResponse" | jq -r .status)
    echo "$buildStatus" >&2

    if [ -z "$buildStatus" ]; then
      echo "::error::Failed to fetch Build Status for $buildSid. Response:" >&2
      echo "::error:: $statusResponse" >&2
      echo "$buildSid"
      exit 1
    fi

    if [ "$buildStatus" == "completed" ]; then
      break
    else
      if [ "$buildStatus" == "failed" ]; then
        echo "::error::Build $buildSid return failed status. Full response:" >&2
        echo "::error::$statusResponse" >&2
        echo "$buildSid"
        exit 1
      fi
    fi
  done

  if [ "$buildStatus" != "completed" ]; then
    echo "::error::Timed out building $buildSid" >&2
    echo "$buildSid"
    exit 1
  fi

  echo "Build $serviceSid/$buildSid completed" >&2
  echo "$buildSid"
}

function deployBuild {
  local serviceSid environmentSid buildSid

  serviceSid=$1
  environmentSid=$2
  buildSid=$3

  deploymentResponse=$(curl -sX POST "https://serverless.twilio.com/v1/Services/$serviceSid/Environments/$environmentSid/Deployments" \
    --data-urlencode "BuildSid=$buildSid" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
  deploymentSid="$(echo "$deploymentResponse" | jq -r '.sid // empty')"

  if [ -z "$deploymentSid" ]; then
    echo "::error::Failed to deploy Build $buildSid to $serviceSid/$environmentSid Response:" >&2
    echo "::error::$deploymentResponse" >&2
    exit 1
  fi

  echo "Completed deployment $deploymentSid of Build $buildSid to $serviceSid/$environmentSid" >&2
  echo "$deploymentSid"
}

### SOURCE scripts/src/deploy-twilio-asset.sh ###

set -e

filePath=$1
pluginName=$2
pluginVersion=$3

if [ -z "$filePath" ]; then
  echo "::error::Missing argument $\1: FILE_PATH" >&2
  exit 1
fi
if [ -z "$pluginName" ]; then
  echo "::error::Missing argument $\2: PLUGIN_NAME" >&2
  exit 1
fi
if [ -z "$pluginVersion" ]; then
  echo "::error::Missing argument $\3: PLUGIN_VERSION" >&3
fi

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1

function generateSuffix {
  local suffixList generatedSuffix

  suffixList=$1
  # shellcheck disable=SC2002
  generatedSuffix=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 7 | head -n 1)

  if [ "$(echo "$suffixList" | jq "any(index(\"$generatedSuffix\"))")" == "true" ]; then
    generatedSuffix=$(generateSuffix "$suffixList")
  fi

  echo "$generatedSuffix"
}

service=$(getService "default") || exit 1
serviceSid=$(echo "$service" | jq -r .sid)

environments=$(listEnvironments "$serviceSid") || exit 1

pluginEnvironment=$(echo "$environments" | jq \
 --arg PLUGIN "$pluginName" '.[] | select(.unique_name == $PLUGIN) // empty')

if [ -z "$pluginEnvironment" ]; then
  suffixList=$(echo "$environments" | jq '[.[] | .domain_suffix]')
  suffix=$(generateSuffix "$suffixList")
  pluginEnvironment=$(createEnvironment "$serviceSid" "$pluginName" "$suffix") || exit 1
fi
environmentSid=$(echo "$pluginEnvironment" | jq -r '.sid')
environmentDomainName=$(echo "$pluginEnvironment" | jq -r 'domain_name')

assetVersions="[]"
buildSid=$(echo "$pluginEnvironment" | jq -r '.build_sid // empty')

if [ -n "$buildSid" ]; then
  build=$(getBuild "$serviceSid" "$buildSid") || exit 1
  assetVersions=$(echo "$build" | jq -c '[.asset_versions[] | select(.path | endswith(".js")) | .sid]')
fi

assetList=$(listAssets "$serviceSid") || exit 1
assetVersionSid=$(upsertAsset \
  "$serviceSid" "$assetList" "$filePath" "$pluginName@$pluginVersion" "plugins/$pluginName/$pluginVersion/bundle.js" "application/javascript" "protected") || exit 1

assetVersions=$(echo "$assetVersions" | jq -rc \
  --arg VERSION_SID "$assetVersionSid" '. + [$VERSION_SID]')

buildSid=$(createBuild "$serviceSid" "" "$assetVersions") || exit 1

deploySid=$(deployBuild "$serviceSid" "$environmentSid" "$buildSid") || exit 1

if [ -n "$GITHUB_OUTPUT" ]; then
  echo "DEPLOY_SID=$deploySid" >> "$GITHUB_OUTPUT"
  assetUrl="https://$environmentDomainName/plugins/$pluginName/$pluginVersion/bundle.js"
  echo "ASSET_URL=$assetUrl" >> "$GITHUB_OUTPUT"
fi
