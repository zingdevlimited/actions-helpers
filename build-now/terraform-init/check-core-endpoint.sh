#!/bin/bash
baseUrl=$1
pluginName=$2

endpointUrl="$baseUrl/terraform-crud?plugin=$pluginName"
response=$(curl --silent --head -X GET "$endpointUrl" \
  -u "$TERRAFORM_BASIC_USERNAME:$TERRAFORM_BASIC_PASSWORD")

status=$(echo "$response" | awk '/^HTTP/{print $2}')

if [ "$status" != "200" ]; then
  echo "::error::terraform-crud endpoint did not return status 200" >&2
  echo "::error::$endpointUrl returned status $status" >&2
  exit 1
fi

echo "✅ terraform-crud endpoint returned status 200" >&2
