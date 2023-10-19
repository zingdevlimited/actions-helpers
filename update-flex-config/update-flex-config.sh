#!/bin/bash
### DEPENDENCY scripts/src/update-flex-config.sh --> scripts/src/lib/check-env.sh ###
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

### SOURCE scripts/src/update-flex-config.sh ###
# Version 1.0.0

checkEnv "TWILIO_ACCOUNT_SID TWILIO_API_KEY TWILIO_API_SECRET" || exit 1

configSection=$1
configDataJson=$2

echo "$configDataJson" | jq || { echo "::error::Invalid JSON was passed" >&2; exit 1; }

response=$(curl -sX GET "https://flex-api.twilio.com/v1/Configuration"\
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET") || exit 1

uiAttributes=$(echo "$response" | jq -r '.ui_attributes // empty')

if [ -z "$uiAttributes" ]
then
  echo "::error::Failed to retrieve Flex Configuration. Response:" >&2
  echo "::error::$response" >&2
  exit 1
fi

mergedConfig=$(echo "$uiAttributes" | jq\
 --argjson DATA "{ \"$configSection\": $configDataJson }"\
 '. += $DATA'
)

payload="{
  \"account_sid\": \"$TWILIO_ACCOUNT_SID\",
  \"ui_attributes\": $mergedConfig
}"

updateResponse=$(curl -sX POST https://flex-api.twilio.com/v1/Configuration \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET" \
    -H 'Content-Type: application/json' \
    -d "$payload")

if [ -z "$(echo "$updateResponse" | jq -r '.ui_attributes // empty')" ]; then
  echo "::error::Failed to update Flex Configuration. Response:" >&2
  echo "::error::$updateResponse" >&2
  exit 1
fi

echo "Updated Flex Configuration .ui_attributes.$configSection:" >&2
echo "$mergedConfig" | jq '' >&2

displayConfig=$(echo "{\"$configSection\": $configDataJson}" | jq '')
echo "## Updated Flex Configuration" >> "$GITHUB_STEP_SUMMARY"
echo '```json' >> "$GITHUB_STEP_SUMMARY"
echo "$displayConfig" >> "$GITHUB_STEP_SUMMARY"
echo '```' >> "$GITHUB_STEP_SUMMARY"