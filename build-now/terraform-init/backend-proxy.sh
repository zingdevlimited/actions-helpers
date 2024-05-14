#!/bin/bash

RESPONSE_QUEUE="tfBackendProxyRespQueue"

rm -f $RESPONSE_QUEUE
mkfifo $RESPONSE_QUEUE

PORT=$1

MAP_NAME="build-now-state-manager-files"

function getStateFile() {
  plugin=$1

  resp=$(
    curl -sX GET "https://sync.twilio.com/v1/Services/default/Maps/$MAP_NAME/Items/$plugin" \
      -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"
  )

  if [[ -n $(echo "$resp" | jq -r ".key // empty") ]]; then
    echo "$resp" | jq -r ".data"
  else
    echo ""
  fi
}

function updateStateFile() {
  plugin=$1
  data=$(echo "$2" | jq -c)

  mapFetch=$(
    curl -sX GET "https://sync.twilio.com/v1/Services/default/Maps/$MAP_NAME" \
      -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"
  )

  if [[ -z $(echo "$mapFetch" | jq -r ".sid // empty") ]]; then
    if [[ "$(echo "$mapFetch" | jq -r ".status" )" == "404" ]]; then
      mapCreate=$(
        curl -sX POST "https://sync.twilio.com/v1/Services/default/Maps" \
          --data-urlencode "UniqueName=$MAP_NAME" \
          -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"
      )
    fi
  else
    mapExists=1
  fi

  if [[ "$mapExists" == "1" ]]; then
    mapItemUpdate=$(
      curl -sX POST "https://sync.twilio.com/v1/Services/default/Maps/$MAP_NAME/Items/$plugin" \
        --data-urlencode "Data=$data" \
        -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"
    )

    if [[ -z $(echo "$mapItemUpdate" | jq -r ".key // empty") ]]; then
      if [[ "$(echo "$mapItemUpdate" | jq -r ".status" )" == "404" ]]; then
        updateFailed=1
      else
        echo "FAIL"
        exit 0
      fi
    fi
  fi

  if [[ "$mapExists" != "1" ]] || [[ "$updateFailed" == "1" ]]; then
    mapItemCreate=$(
      curl -sX POST "https://sync.twilio.com/v1/Services/default/Maps/$MAP_NAME/Items" \
        --data-urlencode "Key=$plugin" \
        --data-urlencode "Data=$data" \
        -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"
    )

    if [[ -z $(echo "$mapItemCreate" | jq -r ".key // empty") ]]; then
      echo "FAIL"
      exit 0
    fi
  fi

  echo "OK"
}

function deleteStateFile() {
  plugin=$1
  resp=$(
    curl -sX DELETE "https://sync.twilio.com/v1/Services/default/Maps/$MAP_NAME/Items/$plugin" \
      -u "$TWILIO_API_KEY:$TWILIO_API_SECRET"
  )
}

function handleRequest() {
  ## Read Request Head
  while read -r line; do
    echo "$line"
    trline=$(echo "$line" | tr -d '[\r\n]')

    [ -z "$trline" ] && break

    HEADLINE_REGEX='(.*?)\s(.*?)\sHTTP.*?'
    if [[ "$trline" =~ $HEADLINE_REGEX ]]; then
      method="${BASH_REMATCH[1]}"
      route="${BASH_REMATCH[2]}"
    fi

    CONTENT_LENGTH_REGEX='Content-Length:\s(.*?)'
    [[ "$trline" =~ $CONTENT_LENGTH_REGEX ]] &&
      CONTENT_LENGTH=$(echo "$trline" | sed -E "s/$CONTENT_LENGTH_REGEX/\1/")
  done

  ## Read Request Body
  requestBody=""
  if [ -n "$CONTENT_LENGTH" ]; then
    while read -rn "$CONTENT_LENGTH" -t1 line; do
      trline=$(echo "$line" | tr -d '[\r\n]')
      [ -z "$trline" ] && break

      requestBody="$(echo -e "$requestBody$line\r\n")"
    done
  fi

  ## Route Methods
  statusCode="200"
  contentType="application/json"
  body=""
  if [[ "$method" == "GET" && "$route" == "/ping" ]]; then
    # GET /ping
    contentType="text/plain"
    body="pong"

  elif [[ "$method" == "GET" ]]; then
    # GET /{plugin}
    plugin=${route:1}
    if [ -n "$plugin" ]; then
      body=$(getStateFile "$plugin")
      if [ -z "$body" ]; then
        statusCode="404"
      fi
    else
      statusCode="400"
      contentType="text/plain"
      body="Missing 'plugin' URL parameter"
    fi

  elif [[ "$method" == "POST" && "$route" == "/exit" ]]; then
    # POST /exit
    quit=1
    body="Exiting server"
    contentType="text/plain"
  
  elif [[ "$method" == "POST" ]]; then
    # POST /{plugin}
    plugin=${route:1}

    if [ -n "$plugin" ]; then
      if [ -n "$requestBody" ]; then
        body="$requestBody"
        updateResult=$(updateStateFile "$plugin" "$requestBody")
        if [[ "$updateResult" == "FAIL" ]]; then
          body="Failed to update"
          statusCode="500"
          contentType="text/plain"
        fi
      else
        body="Missing state data"
        contentType="text/plain"
        statusCode="400"
      fi
    else
      statusCode="400"
      contentType="text/plain"
      body="Missing 'plugin' URL parameter"
    fi

  elif [[ "$method" == "DELETE" ]]; then
    # DELETE /{plugin}
      plugin=${route:1}

    if [ -n "$plugin" ]; then
      body="$requestBody"
      deleteStateFile "$plugin"
    else
      statusCode="400"
      contentType="text/plain"
      body="Missing 'plugin' URL parameter"
    fi
  else
    statusCode="404"
    contentType="text/plain"
    body="Invalid method/route combination"

  fi

  # Send Response
  echo -e "HTTP/1.1 $statusCode\r\nContent-Type: $contentType\r\n\r\n$body" > "$RESPONSE_QUEUE"

  if [[ "$quit" == "1" ]]; then
    echo "Closing server (Port $PORT)"
    exit 1
  fi
}

echo "Listening on $PORT..."

while true; do
  cat "$RESPONSE_QUEUE" | nc -lN "$PORT" | handleRequest || exit 0
done
