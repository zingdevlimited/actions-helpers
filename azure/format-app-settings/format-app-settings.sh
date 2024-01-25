#!/bin/bash

appSettingsEnv=$1
stickySettings=$2
encrypt=$3
encryptionPassword=$4
encryptionFlags=$5

IFS=',' read -ra settings <<< "$stickySettings"
stickySettingsList=$(jq -n '$ARGS.positional' --args "${settings[@]}")

settingsOutput=[]
while IFS='=' read -r key value || [[ -n "$key" ]]; do

  if [ -z "$(echo "$key" | xargs)" ]; then
    continue;
  fi

  stickyIndex=$(echo "$stickySettingsList" | jq --arg NAME "$key" 'index($NAME) // empty')
  [[ -z "$stickyIndex" ]] && slotSetting="false" || slotSetting="true"

  settingObj="{
    \"name\": \"$key\",
    \"value\": \"$value\",
    \"slotSetting\": $slotSetting
  }"

  settingsOutput=$(echo "$settingsOutput" | jq --argjson OBJ "$settingObj" '. += [$OBJ]')
done <<< "$appSettingsEnv"

if [ "$encrypt" == "true" ]; then
  # shellcheck disable=SC2086
  encryptedSettings=$(echo -n "$settingsOutput" |
    openssl enc $encryptionFlags -k "$encryptionPassword" |
    base64
  )
  settingsOutput="$encryptedSettings"
fi

EOF=$(dd if=/dev/urandom bs=15 count=1 status=none | base64)
echo "APP_SETTINGS<<$EOF" >> "$GITHUB_OUTPUT"
echo -e "$settingsOutput" >> "$GITHUB_OUTPUT"
echo "$EOF" >> "$GITHUB_OUTPUT"
