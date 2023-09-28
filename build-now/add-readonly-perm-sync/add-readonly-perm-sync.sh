#!/bin/bash
### DEPENDENCY scripts/src/add-readonly-perm-sync.sh --> scripts/src/lib/check-env.sh ###
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

### SOURCE scripts/src/add-readonly-perm-sync.sh ###
# Version 1.0.0

checkEnv "TWILIO_API_KEY TWILIO_API_SECRET" || exit 1

itemType=$1
syncServiceSid=$2
itemSid=$3

curl -sX POST "https://sync.twilio.com/v1/Services/$syncServiceSid/$itemType/$itemSid/Permissions/READ_ONLY" \
  --data-urlencode "Read=True" \
  --data-urlencode "Write=False" \
  --data-urlencode "Manage=False" \
  -u "$TWILIO_API_KEY":"$TWILIO_API_SECRET"
