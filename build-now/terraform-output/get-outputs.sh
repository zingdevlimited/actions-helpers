#!/bin/bash

## Create the responseQueue FIFO
rm -f responseQueue
mkfifo responseQueue

plugin=$1
syncServiceSid=$2
syncMapName=$3
noErrorOnMissing=$4

resp=$(
  curl -sX GET "https://sync.twilio.com/v1/Services/$syncServiceSid/Maps/$syncMapName/Items/$plugin" \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"
)

if [[ -n $(echo "$resp" | jq -r ".key // empty") ]]; then
  result="$(echo "$resp" | jq ".data.outputs")"
else
  if [[ "$noErrorOnMissing" == "true" ]] && [[ "$(echo "$resp" | jq -r ".status")" == "404" ]]; then
    echo "::warning::State file could not be found. Returning '{}'" >&2
    result="{}"
  else
    echo "::error::Failed to fetch Sync Map Item: $resp" >&2
    exit 1
  fi
fi

if [ -n "$GITHUB_OUTPUT" ]; then
  for key in $(echo "$result" | jq -r 'keys[]')
  do
    sensitive=$(echo "$result" | jq -r ".$key.sensitive")
    if [[ "$sensitive" == "true" ]]; then
      value=$(echo "$result" | jq -r ".$key.value")
      echo "::add-mask::$value"
    fi
  done
  EOF=$(dd if=/dev/urandom bs=15 count=1 status=none | base64)
  echo "RESULT<<$EOF" >> "$GITHUB_OUTPUT"
  echo "$result" >> "$GITHUB_OUTPUT"
  echo "$EOF" >> "$GITHUB_OUTPUT"
fi
