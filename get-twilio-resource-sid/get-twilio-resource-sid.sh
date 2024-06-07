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
  local twilioArea apiType searchBy searchValue version allowNoResults

  twilioArea=$1
  apiType=$2
  searchBy=$3
  searchValue=$4
  [[ -z $5 ]] && version="v1" || version=$5
  [[ "$6" == "true" ]] && allowNoResults="true"

  local resourceListResponse keyName resources resourceSearch resultCount

  resourceListResponse=$(curl -sX GET "https://$twilioArea.twilio.com/$version/$apiType" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

  keyName=$(echo "$resourceListResponse" | jq -r '.meta.key // empty')

  if [ -z "$keyName" ]; then
    echo "::error::Failed to list $twilioArea $apiType. Response:" >&2
    echo "::error::$resourceListResponse" >&2
    exit 1
  fi

  resources=$(echo "$resourceListResponse" | jq -r --arg TYPE "$keyName" '.[$TYPE] // empty')

  resourceSearch=$(
    echo "$resources" | jq \
      --arg PROP "$searchBy" \
      --arg VAL "$searchValue" \
      '[.[] | select(.[$PROP]==$VAL)]'
  )
  resultCount=$(echo "$resourceSearch" | jq 'length')

  if ((resultCount == 0)); then
    if [ -n "$allowNoResults" ]; then
      echo "$twilioArea $apiType with $searchBy '$searchValue' does not exist. Returning empty sid" >&2
      echo ""
      exit 0
    fi
    echo "::error::$twilioArea $apiType with $searchBy '$searchValue' does not exist." >&2
    exit 1
  fi
  if ((resultCount > 1)); then
    echo "::error::Searching for $twilioArea $apiType with $searchBy '$searchValue' returned $resultCount results." >&2
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
  local apiType searchBy searchValue allowNoResults

  apiType=$1
  searchBy=$2
  searchValue=$3
  [[ "$4" == "true" ]] && allowNoResults="true"
  
  if [ "$apiType" == "Workspaces" ]; then
    getWorkspace || exit 1
  else
    local workspaceSid keyName resourceListResponse resources resourceSearch resultCount

    workspaceSid=$(getWorkspaceSid) || exit 1

    resourceListResponse=$(curl -sX GET "https://taskrouter.twilio.com/v1/Workspaces/$workspaceSid/$apiType" \
      -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")

    keyName=$(echo "$resourceListResponse" | jq -r '.meta.key // empty')

    if [ -z "$keyName" ]; then
      echo "::error::Failed to list Taskrouter $apiType. Response:" >&2
      echo "::error::$resourceListResponse" >&2
      exit 1
    fi

    resources=$(echo "$resourceListResponse" | jq -r --arg TYPE "$keyName" '.[$TYPE] // empty')

    resourceSearch=$(
      echo "$resources" | jq \
        --arg PROP "$searchBy" \
        --arg VAL "$searchValue" \
        '[.[] | select(.[$PROP]==$VAL)]'
    )
    resultCount=$(echo "$resourceSearch" | jq 'length')

    if ((resultCount == 0)); then
      if [ -n "$allowNoResults" ]; then
        echo "Taskrouter $apiType with $searchBy '$searchValue' does not exist. Returning empty sid" >&2
        echo ""
        exit 0
      fi
      echo "::error::Taskrouter $apiType with $searchBy '$searchValue' does not exist." >&2
      exit 1
    fi
    if ((resultCount > 1)); then
      echo "::error::Searching for $apiType with $searchBy '$searchValue' returned $resultCount results." >&2
      exit 1
    fi

    echo "$resourceSearch" | jq '.[0]'
  fi
}

### SOURCE scripts/src/get-twilio-resource-sid.sh ###
# Version 1.0.0

set -e

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1

twilioArea=$1
apiType=$2
searchBy=$3
searchValue=$4
version=$5
allowNoResults=$6


if [[ "$twilioArea" == "taskrouter" ]]; then
  response=$(listAndFindTaskrouterResource "$apiType" "$searchBy" "$searchValue" "$allowNoResults") || exit 1
else
  response=$(listAndFindResource "$twilioArea" "$apiType" "$searchBy" "$searchValue" "$version" "$allowNoResults") || exit 1
fi

echo "$response" | jq -r .sid
