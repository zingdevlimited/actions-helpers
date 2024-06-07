#!/bin/bash

response=$(curl -sX GET "https://flex-api.twilio.com/v1/Configuration"\
  -u "$TWILIO_API_KEY:$TWILIO_API_SECRET") || exit 1

if [ -z "$(echo "$response" | jq -r '.ui_attributes // empty')" ]
then
  echo "::error::Failed to retrieve Flex Configuration. Response: $response" >&2
  exit 1
fi

skillsArray=$(echo "$response" | jq '.taskrouter_skills // empty')
if [ -z "$skillsArray" ] || [ "$MODE" == "replace" ]; then
  skillsArray="[]"
fi

if [ -n "$SIMPLE_SKILLS" ]; then
  while IFS= read -r line && [[ -n $line ]]; do
    skillName=$(echo "$line" | xargs) # Trim whitespace

    if [ "$(echo "$skillsArray" | jq ". | any(.name == \"$skillName\") | not")" == "true" ]; then
      obj="{
        \"name\": \"$skillName\",
        \"multivalue\": false,
        \"minimum\": null,
        \"maximum\": null
      }"
      skillsArray=$(echo "$skillsArray" | jq --argjson VAR "$obj" '. + [$VAR]')
    fi
  done <<< "$SIMPLE_SKILLS"
fi
if [ -n "$COMPLEX_SKILLS" ]; then
  for skillEncoded in $(echo "$COMPLEX_SKILLS" | jq -r '.[] | @base64'); do
    skill=$(echo "$skillEncoded" | base64 --decode)
    skillName=$(echo "$skill" | jq -r '.name')
    if [ "$(echo "$skillsArray" | jq ". | any(.name == \"$skillName\") | not")" == "true" ]; then
      skillsArray=$(echo "$skillsArray" | jq --argjson VAR "$skill" '. + [$VAR]')
    fi
  done
fi

payload="{
  \"account_sid\": \"$TWILIO_ACCOUNT_SID\",
  \"taskrouter_skills\": $skillsArray
}"
payload=$(echo "$payload" | jq -c '')

curl -sX POST https://flex-api.twilio.com/v1/Configuration \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET" \
    -H 'Content-Type: application/json' \
    -d "$payload" || exit 1