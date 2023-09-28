#!/bin/bash
### DEPENDENCY scripts/src/get-twilio-resource-sid.sh --> scripts/src/lib/check-env.sh ###
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

### DEPENDENCY scripts/src/get-twilio-resource-sid.sh --> scripts/src/lib/twilio/generic.sh ###
### SOURCE scripts/src/lib/twilio/generic.sh ###

function listAndFindResource {
  local twilioArea apiType jsonType searchBy searchValue version

  twilioArea=$1
  apiType=$2
  jsonType=$3
  searchBy=$4
  searchValue=$5
  [[ -z $6 ]] && version="v1" || version=$6

  local resourceListResponse resources resourceSearch resultCount

  resourceListResponse=$(curl -sX GET "https://$twilioArea.twilio.com/$version/$apiType" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  resources=$(echo "$resourceListResponse" | jq -r --arg TYPE "$jsonType" '.[$TYPE] // empty')

  if [ -z "$resources" ]; then
    echo "::error::Failed to list $twilioArea $jsonType. Response:" >&2
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
    echo "::error::$twilioArea $jsonType with $searchBy '$searchValue' does not exist." >&2
    exit 1
  fi
  if ((resultCount > 1)); then
    echo "::error::Searching for $twilioArea $jsonType with $searchBy '$searchValue' returned $resultCount results." >&2
    exit 1
  fi

  echo "$resourceSearch" | jq '.[0]'
}

### DEPENDENCY scripts/src/get-twilio-resource-sid.sh --> scripts/src/lib/twilio/taskrouter.sh ###
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

### SOURCE scripts/src/get-twilio-resource-sid.sh ###
# Version 1.0.0

set -e

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1

twilioArea=$1
apiType=$2
jsonType=$3
searchBy=$4
searchValue=$5
version=$6


if [[ "$twilioArea" == "taskrouter" ]]; then
  response=$(listAndFindTaskrouterResource "$apiType" "$jsonType" "$searchBy" "$searchValue") || exit 1
else
  response=$(listAndFindResource "$twilioArea" "$apiType" "$jsonType" "$searchBy" "$searchValue" "$version") || exit 1
fi

echo "$response" | jq -r .sid

