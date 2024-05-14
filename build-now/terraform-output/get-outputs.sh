#!/bin/bash

## Create the responseQueue FIFO
rm -f responseQueue
mkfifo responseQueue

plugin=$1
MAP_NAME="build-now-state-manager-files"

resp=$(
  curl -sX GET "https://sync.twilio.com/v1/Services/default/Maps/$MAP_NAME/Items/$plugin" \
    -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"
)

if [[ -n $(echo "$resp" | jq -r ".key // empty") ]]; then
  result="$(echo "$resp" | jq ".data.outputs")"
else
  result="{}"
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
