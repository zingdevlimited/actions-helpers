#!/bin/bash
### DEPENDENCY scripts/src/update-studio-flows.sh --> scripts/src/lib/check-env.sh ###
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

### DEPENDENCY scripts/src/update-studio-flows.sh --> scripts/src/lib/twilio/utils.sh ###
### DEPENDENCY scripts/src/lib/twilio/utils.sh --> scripts/src/lib/twilio-serverless/services.sh ###
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

### DEPENDENCY scripts/src/lib/twilio/utils.sh --> scripts/src/lib/twilio-serverless/environments.sh ###
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

### DEPENDENCY scripts/src/lib/twilio/utils.sh --> scripts/src/lib/twilio-serverless/builds.sh ###
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

### SOURCE scripts/src/lib/twilio/utils.sh ###


function getDeployedFunctionMap {
  local serviceName environmentSuffix

  serviceName=$1
  environmentSuffix=$2

  local service serviceSid

  service=$(getService "$serviceName") || exit 1
  serviceSid=$(echo "$service" | jq -r '.sid')

  local environment environmentSid domainName buildSid

  environment=$(getEnvironment "$serviceSid" "$environmentSuffix") || exit 1
  environmentSid=$(echo "$environment" | jq -r '.sid')
  domainName=$(echo "$environment" | jq -r '.domain_name')
  buildSid=$(echo "$environment" | jq -r '.build_sid')

  local build functionVersions

  build=$(getBuild "$serviceSid" "$buildSid") || exit 1
  functionVersions=$(echo "$build" | jq '.function_versions')

  local fields functionMap

  fields="{
    \"service_sid\": \"$serviceSid\",
    \"environment_sid\": \"$environmentSid\",
    \"domain_name\": \"$domainName\"
  }"

  functionMap=$(
    echo "$functionVersions" |
      jq '. | map({ (.path): .sid }) | add' |
      jq --argjson OBJ "$(echo "$fields" | jq -c '')" '. += $OBJ'
  )

  echo "$functionMap"
}

### DEPENDENCY scripts/src/update-studio-flows.sh --> scripts/src/lib/twilio/taskrouter.sh ###
### SOURCE scripts/src/lib/twilio/taskrouter.sh ###

function getWorkspace {
  local workspaceListResponse

  workspaceListResponse=$(curl -sX GET "https://taskrouter.twilio.com/v1/Workspaces?PageSize=1" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  if [ -z "$(echo "$workspaceListResponse" | jq '.workspaces // empty')" ]; then
    echo "::error::Failed to list Workspaces. Response:" >&2
    echo "::error::$workspaceListResponse" >&2
    exit 1
  fi

  workspace=$(echo "$workspaceListResponse" | jq '.workspaces[0]')
  echo "$workspace"
}

function getWorkspaceSid {
  local workspaceSid

  workspaceSid=$(getWorkspace | jq -r '.sid') || exit 1
  echo "$workspaceSid"
}

function listAndFindTaskrouterResource {
  local apiType jsonType searchBy searchValue

  apiType=$1
  jsonType=$2
  searchBy=$3
  searchValue=$4

  local workspaceSid

  workspaceSid=$(getWorkspaceSid) || exit 1
  if [ "$apiType" == "Workspaces" ]; then
    getWorkspace || exit 1
  else
    local resourceListResponse resources resourceSearch resultCount

    resourceListResponse=$(curl -sX GET "https://taskrouter.twilio.com/v1/Workspaces/$workspaceSid/$apiType" \
      -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

    resources=$(echo "$resourceListResponse" | jq -r --arg TYPE "$jsonType" '.[$TYPE] // empty')

    if [ -z "$resources" ]; then
      echo "::error::Failed to list $apiType. Response:" >&2
      echo "::error::$resourceListResponse" >&2
      exit 1
    fi

    resourceSearch=$(
      echo "$resources" | jq \
        --arg PROP "$searchBy" \
        --arg VAL "$searchValue" \
        '[.[] | select(.[$PROP]==$VAL)]'
    )
    resultCount=$(echo "$resourceSearch" | jq 'length')

    if ((resultCount == 0)); then
      echo "::error::$apiType with $searchBy '$searchValue' does not exist." >&2
      exit 1
    fi
    if ((resultCount > 1)); then
      echo "::error::Searching for $apiType with $searchBy '$searchValue' returned $resultCount results." >&2
      exit 1
    fi

    echo "$resourceSearch" | jq '.[0]'
  fi
}

function getWorkflowsMap {
  local workspaceSid

  workspaceSid=$1
  if [ -z "$workspaceSid" ]; then
    workspaceSid="$(getWorkspaceSid)"
  fi

  local workflowListResponse workflows workflowMap

  workflowListResponse=$(curl -sX GET "https://taskrouter.twilio.com/v1/Workspaces/$workspaceSid/Workflows" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  workflows="$(echo "$workflowListResponse" | jq '.workflows // empty')"

  if [ -z "$workflows" ]; then
    echo "::error::Failed to list Workflows. Response:" >&2
    echo "::error::$workflowListResponse" >&2
    exit 1
  fi

  workflowMap=$(echo "$workflows" | jq 'map({ (.friendly_name): .sid }) | add')
  echo "$workflowMap"
}

function getTaskChannelMap {
  local workspaceSid

  workspaceSid=$1
  if [ -z "$workspaceSid" ]; then
    workspaceSid="$(getWorkspaceSid)"
  fi

  local taskChannelListResponse channels taskChannelMap

  taskChannelListResponse=$(curl -sX GET "https://taskrouter.twilio.com/v1/Workspaces/$workspaceSid/TaskChannels" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  channels="$(echo "$taskChannelListResponse" | jq '.channels // empty')"

  if [ -z "$channels" ]; then
    echo "::error::Failed to list Task Channels. Response:" >&2
    echo "::error::$taskChannelListResponse" >&2
    exit 1
  fi

  taskChannelMap=$(echo "$channels" | jq 'map({ (.unique_name): .sid }) | add')

  echo "$taskChannelMap"
}

### DEPENDENCY scripts/src/update-studio-flows.sh --> scripts/src/lib/twilio/studio.sh ###
### SOURCE scripts/src/lib/twilio/studio.sh ###

function getStudioFlowMap {
  local flowListResponse flows studioFlowMap

  flowListResponse=$(curl -sX GET "https://studio.twilio.com/v2/Flows" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  flows="$(echo "$flowListResponse" | jq '.flows // empty')"

  if [ -z "$flows" ]; then
    echo "::error::Failed to list Studio Flows. Response:" >&2
    echo "::error::$flowListResponse" >&2
    exit 1
  fi

  studioFlowMap=$(echo "$flows" | jq 'map({ (.friendly_name): .sid }) | add')
  echo "$studioFlowMap"
}

function updateStudioFlow {
  local flowSid flowDefinition allowCreate flowName

  flowSid=$1
  flowDefinition=$2
  allowCreate=$3
  flowName=$4

  # Compact
  flowDefinition=$(echo "$flowDefinition" | jq -c '')

  local flowResponse

  if [ -z "$flowSid" ]; then
    if [ "$allowCreate" == "true" ]; then
      flowResponse=$(curl -sX POST "https://studio.twilio.com/v2/Flows" \
        --data-urlencode "FriendlyName=$flowName" \
        --data-urlencode "CommitMessage=Script Created" \
        --data-urlencode "Definition=$flowDefinition" \
        --data-urlencode "Status=published" \
        -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
    fi
  else
    flowResponse=$(curl -sX POST "https://studio.twilio.com/v2/Flows/$flowSid" \
      --data-urlencode "CommitMessage=Script Updated" \
      --data-urlencode "Definition=$flowDefinition" \
      --data-urlencode "Status=published" \
      -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
  fi

  if [ -z "$(echo "$flowResponse" | jq '.sid // empty')" ]; then
    echo "::error::Failed to update Studio Flow $flowSid. Response:" >&2
    echo "::error::$flowResponse" >&2
    exit 1
  fi
}

### DEPENDENCY scripts/src/update-studio-flows.sh --> scripts/src/lib/twilio/update-widget.sh ###
### SOURCE scripts/src/lib/twilio/update-widget.sh ###
FUNCTION_URL_REGEX='"https://(\S*)-[[:digit:]][[:digit:]][[:digit:]][[:digit:]](-[[:alnum:]]+)?.twil.io(/\S*)"'

function updateFlexWidgets {
  local json workflowMap channelMap

  json=$(cat)
  workflowMap=$1
  channelMap=$2

  local workflowMapKeys flexWidgets

  workflowMapKeys=$(echo "$workflowMap" | jq 'keys[]')
  flexWidgets=$(echo "$json" | jq -c '.states[] | select(.type=="send-to-flex")')

  IFS=$'\n'
  for widget in $flexWidgets; do
    local widgetName attributes workflowName channelName workflowSid channelSid

    widgetName=$(echo "$widget" | jq -r .name)
    attributes=$(echo "$widget" | jq '.properties.attributes | fromjson')
    workflowName=$(echo "$attributes" | jq -r .workflowName)
    channelName=$(echo "$attributes" | jq -r .channelName)

    if [ "$workflowName" == "null" ]; then
      echo "($widgetName) send-to-flex widget is missing 'workflowName' attribute." >&2
      exit 1
    fi
    if [ "$channelName" == "null" ]; then
      echo "($widgetName) send-to-flex widget is missing 'channelName' attribute." >&2
      exit 1
    fi

    workflowSid=$(echo "$workflowMap" | jq -r --arg WF_NAME "$workflowName" '.[$WF_NAME]')
    if [ "$workflowSid" == "null" ]; then
      echo -e "($widgetName) workflowName $workflowName does not match any of the workflow identifiers:\n$workflowMapKeys" >&2
      exit 1
    fi

    channelSid=$(echo "$channelMap" | jq -r --arg CH_NAME "$channelName" '.[$CH_NAME]')
    if [ "$channelSid" == "null" ]; then
      echo -e "($widgetName) channelName $channelName does not match any existing channel unique names" >&2
      exit 1
    fi

    json=$(
      echo "$json" | jq \
        --arg WIDGET "$widgetName" \
        --arg WF_SID "$workflowSid" \
        --arg CH_SID "$channelSid" \
        '(.states[] | select(.name==$WIDGET) | .properties).workflow=$WF_SID |
         (.states[] | select(.name==$WIDGET) | .properties).channel=$CH_SID'
    )
  done

  echo "$json"
}

function updateFunctionWidgets {
  local json serviceMap

  json=$(cat)
  serviceMap=$1

  local serviceKeys functionWidgets

  serviceKeys=$(echo "$serviceMap" | jq 'keys[]')

  functionWidgets=$(echo "$json" | jq -c '.states[] | select(.type=="run-function")')

  for widget in $functionWidgets; do
    local widgetName url serviceInfo serviceSid environmentSid functionSid domainName newUrl

    widgetName=$(echo "$widget" | jq -r .name)
    url=$(echo "$widget" | jq '.properties.url')

    if [[ $url =~ $FUNCTION_URL_REGEX ]]; then
      serviceName="${BASH_REMATCH[1]}"
      # envSuffix="$(echo ${BASH_REMATCH[2]} | cut -c2-)"
      functionPath="${BASH_REMATCH[3]}"
    else
      echo "($widgetName) Functions URL does not match regular expression" >&2
      exit 1
    fi

    serviceInfo=$(echo "$serviceMap" | jq --arg SERVICE "$serviceName" '.[$SERVICE]')

    if [ "$serviceInfo" == "null" ]; then
      echo -e "($widgetName) Service name $serviceName does not match any of the provided services:\n$serviceKeys" >&2
      exit 1
    fi

    serviceSid=$(echo "$serviceInfo" | jq -r .service_sid)
    environmentSid=$(echo "$serviceInfo" | jq -r .environment_sid)
    functionSid=$(echo "$serviceInfo" | jq -r --arg FUNC "$functionPath" '.[$FUNC]')

    if [ "$functionSid" == "null" ]; then
      echo "($widgetName) No deployed Function found at the path $functionPath for Service $serviceName" >&2
      exit 1
    fi

    domainName=$(echo "$serviceInfo" | jq -r .domain_name)
    newUrl="https://$domainName$functionPath"

    json=$(
      echo "$json" | jq \
        --arg WIDGET "$widgetName" \
        --arg SER_SID "$serviceSid" \
        --arg ENV_SID "$environmentSid" \
        --arg URL "$newUrl" \
        --arg FUNC_SID "$functionSid" \
        '(.states[] | select(.name==$WIDGET) | .properties).service_sid=$SER_SID | 
         (.states[] | select(.name==$WIDGET) | .properties).environment_sid=$ENV_SID |
         (.states[] | select(.name==$WIDGET) | .properties).url=$URL |
         (.states[] | select(.name==$WIDGET) | .properties).function_sid=$FUNC_SID'
    )
  done

  echo "$json"
}

function updateVariableWidgets {
  local json variableMap
  
  json=$(cat)
  variableMap=$1

  local variableWidgets

  variableWidgets=$(echo "$json" | jq -c '.states[] | select(.type=="set-variables")')

  IFS=$'\n'
  for widget in $variableWidgets; do
    local widgetName

    widgetName=$(echo "$widget" | jq -r .name)

    for variable in $(echo "$widget" | jq -c '.properties.variables[]'); do
      local variableKey replaceValue

      variableKey=$(echo "$variable" | jq -r .key)
      replaceValue=$(echo "$variableMap" | jq -r --arg KEY "$variableKey" '.[$KEY]')
  
      if [ "$replaceValue" != "null" ]; then
        json=$(
          echo "$json" | jq \
            --arg WIDGET "$widgetName" \
            --arg KEY "$variableKey" \
            --arg VAL "$replaceValue" \
            '(.states[] | select(.name==$WIDGET) |
            .properties.variables[] | select(.key==$KEY)).value=$VAL'
        )
      fi
    done
  done

  echo "$json"
}

function updateSubflowWidgets {
  local json subflowMap

  json=$(cat)
  subflowMap=$1

  local subflowMapKeys subflowWidgets

  subflowMapKeys=$(echo "$subflowMap" | jq 'keys[]')

  subflowWidgets=$(echo "$json" | jq -c '.states[] | select(.type=="run-subflow")')

  IFS=$'\n'
  for widget in $subflowWidgets; do
    local widgetName subflowName subflowSid

    widgetName=$(echo "$widget" | jq -r .name)
    subflowName=$(echo "$widget" | jq -r '.properties.parameters[] | select(.key=="subflowName") | .value')

    if [ "$subflowName" == "null" ]; then
      echo "($widgetName) run-subflow widget is missing 'subflowName' parameter." >&2
      exit 1
    fi

    subflowSid=$(echo "$subflowMap" | jq -r --arg SF_NAME "$subflowName" '.[$SF_NAME]')
    if [ "$subflowSid" == "null" ]; then
      echo -e "($widgetName) subflowName $subflowName does not match any of the subflow identifiers:\n$subflowMapKeys" >&2
      exit 1
    fi

    json=$(
      echo "$json" | jq \
        --arg WIDGET "$widgetName" \
        --arg SF_SID "$subflowSid" \
        '(.states[] | select(.name==$WIDGET) | .properties).flow_sid=$SF_SID'
    )
  done

  echo "$json"
}

function setWidgetProperty {
  local json widgetName propertyName propertyValue useRawType

  json=$(cat)
  widgetName=$1
  propertyName=$2
  propertyValue=$3
  useRawType=$4

  if [ "$useRawType" == "true" ]; then
    # Use argjson to allow numbers/booleans
    json=$(
      echo "$json" | jq \
        --arg WIDGET "$widgetName" \
        --arg PROP "$propertyName" \
        --argjson VAL "$propertyValue" \
        '(.states[] | select(.name==$WIDGET) | .properties | .[$PROP]) = $VAL'
    )
  else
    json=$(
      echo "$json" | jq \
        --arg WIDGET "$widgetName" \
        --arg PROP "$propertyName" \
        --arg VAL "$propertyValue" \
        '(.states[] | select(.name==$WIDGET) | .properties | .[$PROP]) = $VAL'
    )
  fi

  echo "$json"
}

### SOURCE scripts/src/update-studio-flows.sh ###
# Version 1.0.0
set -e
set -o pipefail

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1


IFS=$'\n'

if [ -z "$1" ]; then
  echo "::error::Usage: $0 <studio-config-file>" >&2
  exit 1
fi

if [ ! -f "$1" ]; then
  echo "::error::Could not find config file '$1'" >&2
  exit 1
fi

config=$(cat "$1")

if [ "$(echo "$config" | jq -r '.enableShellVariables')" == "true" ]; then
  config=$(echo "$config" | envsubst)
fi

function usesWidgetType {
  echo "$config" | jq --arg el "$1" '.replaceWidgetTypes[] | select(. == $el) | length'
}

serviceMap="{}"
if [ -n "$(echo "$config" | jq '.functionServices // empty')" ]; then
  for functionService in $(echo "$config" | jq -cr '.functionServices[]')
  do
    serviceName=$(echo "$functionService" | jq -r .name)
    envSuffix=$(echo "$functionService" | jq -r '.environmentSuffix // empty')

    functionMap=$(getDeployedFunctionMap "$serviceName" "$envSuffix")
    serviceMap=$(echo "$serviceMap" | jq \
      --argjson OBJ "{\"$serviceName\": $functionMap}" '. += $OBJ'
    )
  done
fi

workspaceSid=$(getWorkspaceSid)

workflows=$(echo "$config" | jq '.workflowMap // empty')
if [ -z "$workflows" ]; then
  # Get workflow map based on friendly name
  workflows=$(getWorkflowsMap "$workspaceSid")
fi
channels=$(getTaskChannelMap "$workspaceSid")

variables=$(echo "$config" | jq '.variableReplacements')

# Friendly name to sid map
studioFlowMap=$(getStudioFlowMap)

subflowMap=$(echo "$config" | jq '.subflowMap // empty')
if [ -z "$subflowMap" ]; then
  subflowMap="$studioFlowMap"
fi

flows=$(echo "$config" | jq -c '.flows | sort_by(.subflow) | reverse[]')
for flowConfig in $flows
do
  flowName=$(echo "$flowConfig" | jq -r .name)
  flowSid=$(echo "$flowConfig" | jq -r '.sid // empty')
  if [ -z "$flowSid" ]; then
    # Search by friendly name if .sid property is empty
    flowSid=$(echo "$studioFlowMap" | jq -r --arg FN "$flowName" '.[$FN] // empty')
  fi
  
  flowAllowCreate=$(echo "$flowConfig" | jq -r .allowCreate)

  flowPath=$(echo "$flowConfig" | jq -r .path)
  flowJson=$(cat "$flowPath")

  if [ "$(usesWidgetType "send-to-flex")" ]; then
    flowJson=$(echo "$flowJson" | updateFlexWidgets "$workflows" "$channels")
  fi
  if [ "$(usesWidgetType "run-function")" ]; then
    flowJson=$(echo "$flowJson" | updateFunctionWidgets "$serviceMap")
  fi
  if [ "$(usesWidgetType "set-variables")" ]; then
    flowJson=$(echo "$flowJson" | updateVariableWidgets "$variables")
  fi
  if [ "$(usesWidgetType "run-subflow")" ]; then
    flowJson=$(echo "$flowJson" | updateSubflowWidgets "$subflowMap")
  fi

  updateStudioFlow "$flowSid" "$flowJson" "$flowAllowCreate" "$flowName"
done