#!/bin/bash

###############################################################################
### DEPRECATED. File still needs to exist due to Azure Pipelines references ###
###############################################################################

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

### DEPENDENCY scripts/src/update-functions-variables.sh --> scripts/src/lib/twilio-serverless/services.sh ###
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

### DEPENDENCY scripts/src/update-functions-variables.sh --> scripts/src/lib/twilio-serverless/environments.sh ###
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

### DEPENDENCY scripts/src/update-functions-variables.sh --> scripts/src/lib/twilio-serverless/variables.sh ###
### SOURCE scripts/src/lib/twilio-serverless/variables.sh ###

function listVariables {
  local serviceSid environmentSid

  serviceSid=$1
  environmentSid=$2

  local variableListResponse variables

  variableListResponse=$(curl -sX GET "https://serverless.twilio.com/v1/Services/$serviceSid/Environments/$environmentSid/Variables" \
    -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
  variables=$(echo "$variableListResponse" | jq '.variables // empty')

  if [ -z "$variables" ]; then
    echo "::error::Failed to list Environment Variables. Response:" >&2
    echo "::error::$variableListResponse" >&2
    exit 1
  fi

  echo "$variables"
}

function upsertVariable {
  local serviceSid environmentSid variableList variableName variableValue

  serviceSid=$1
  environmentSid=$2
  variableList=$3
  variableName=$4
  variableValue=$5

  local variableResponse variableSid mode

  variableSid=$(echo "$variableList" | jq -r \
    --arg KEY "$variableName" '.[] | select(.key==$KEY) | .sid // empty')

  if [ -z "$variableSid" ]; then
    variableResponse=$(curl -sX POST "https://serverless.twilio.com/v1/Services/$serviceSid/Environments/$environmentSid/Variables" \
      --data-urlencode "Key=$variableName" \
      --data-urlencode "Value=$variableValue" \
      -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
    mode="created"
  else
    oldVariableValue=$(echo "$variableList" | jq -r \
      --arg KEY "$variableName" '.[] | select(.key==$KEY) | .value // empty')

    if [ "$variableValue" == "$oldVariableValue" ]; then
      variableResponse=$(echo "$variableList" | jq \
        --arg KEY "$variableName" '.[] | select(.key==$KEY)'
      )
      mode="unchanged"
      echo "Variable '$variableName' has the same value. Skipping" >&2
    else
      variableResponse=$(curl -sX POST "https://serverless.twilio.com/v1/Services/$serviceSid/Environments/$environmentSid/Variables/$variableSid" \
        --data-urlencode "Key=$variableName" \
        --data-urlencode "Value=$variableValue" \
        -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET")
      mode="updated"
    fi
  fi

  variableSid=$(echo "$variableResponse" | jq -r '.sid // empty')

  if [ -z "$variableSid" ]; then
    echo "::error::Failed to upsert Environment Variable '$variableName' to '$serviceSid/$environmentSid'. Response:" >&2
    echo "::error::$variableResponse" >&2
    echo "- $variableName: **FAILED**"  >> "$GITHUB_STEP_SUMMARY"
    exit 1
  fi

  echo "Upserted Environment Variable '$variableName' to '$serviceSid/$environmentSid'" >&2
  echo "- $variableName: \`$mode\`" >> "$GITHUB_STEP_SUMMARY"

  echo "$variableSid"
}

function deleteVariable {
  serviceSid=$1
  environmentSid=$2
  variableList=$3
  variableName=$4

  variableSid=$(echo "$variableList" | jq -r \
    --arg KEY "$variableName" '.[] | select(.key==$KEY) | .sid // empty'
  )

  if [ -z "$variableSid" ]; then
    exit 0
  fi
  curl -sX DELETE "https://serverless.twilio.com/v1/Services/$serviceSid/Environments/$environmentSid/Variables/$variableSid" \
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"

  echo "Deleted Environment Variable '$variableName' from '$serviceSid/$environmentSid'" >&2
  echo "- ~~$variableName~~: \`deleted\`" >> "$GITHUB_STEP_SUMMARY"
}

### SOURCE scripts/src/update-functions-variables.sh ###
# Version 1.0.0

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1

serviceName=$1
environmentSuffix=$2
variablesEnv=$3
optionalVariables=$4

if [ -z "$variablesEnv" ]; then
  echo "No variables to add. Skipping" >&2
  exit 0
fi

optionalVariablesJson=$(echo -n "$optionalVariables" | tr -d ' ' | jq -Rcs 'split(",")')

emptyValues=""

variablesJson="{"
while IFS='=' read -r key value || [[ -n "$key" ]]; do
  if [[ -z "$key" || "$key" == \#* ]]; then
    continue
  fi

  key=$(echo "$key" | awk '{$1=$1};1')
  value=$(echo "$value" | awk '{$1=$1};1')
  isOptional=$(echo "$optionalVariablesJson" | jq "any(. == \"$key\")")

  if [ -z "$value" ] && [ "$isOptional" != "true" ]; then
    emptyValues+="$key "
  fi

  variablesJson+="\"$key\": \"$value\","
done <<< "$variablesEnv"

variablesJson=${variablesJson%,*}
variablesJson+="}"

if [ -n "$emptyValues" ]; then
  echo "::error:: Empty value for Variables: $emptyValues" >&2
  exit 1
fi

service=$(getService "$serviceName") || exit 1
serviceSid=$(echo "$service" | jq -r '.sid')

environment=$(getEnvironment "$serviceSid" "$environmentSuffix") || exit 1
environmentSid=$(echo "$environment" | jq -r '.sid')

currentVariables=$(listVariables "$serviceSid" "$environmentSid") || exit 1

currentVariableNames=$(echo "$currentVariables" | jq 'map(.key)')
newVariables=$(echo "$variablesJson" | jq -c 'keys')

allVariables=$(echo "$currentVariableNames" | jq -r --argjson NEW "$newVariables"\
  '. + $NEW | unique | .[]'
)

echo "## Updated Variables for $serviceName $environmentSuffix" >> "$GITHUB_STEP_SUMMARY"

for variableName in $allVariables
do
  value=$(echo "$variablesJson" | jq -r ".$variableName // empty")
  isOptional=$(echo "$optionalVariablesJson" | jq "any(. == \"$variableName\")")

  if [ -z "$value" ] && [ "$isOptional" != "true" ];
  then
    # Delete old Variable that is no longer used
    deleteVariable "$serviceSid" "$environmentSid" "$currentVariables"\
      "$variableName" || exit 1
  else
    upsertVariable "$serviceSid" "$environmentSid" "$currentVariables"\
      "$variableName" "$value" || exit 1
  fi
done

