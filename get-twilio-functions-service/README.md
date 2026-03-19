# Get Twilio Functions Service

Use to get the Sids and Base URL of a deployed Twilio Functions Service.

```yaml
steps:
  (...)

  - name: Get My Api Info
    id: myApi
    uses: zingdevlimited/actions-helpers/get-twilio-functions-service@v4
    with:
      SERVICE_NAME: my-api
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}

  - name: Check My Api Info
    run: |
      echo "Base URL: ${{ steps.myApi.outputs.BASE_URL }}"
      echo "Service Sid: ${{ steps.myApi.outputs.SERVICE_SID }}"
```

**Outputs**:

- BASE_URL
- SERVICE_SID
- ENVIRONMENT_SID
- BUILD_SID
- RESOLVED_SERVICE_NAME

## Pattern Matching

Twilio Library Plugin services use a versioned unique name (e.g. `plibo-queued-callback-and-voicemail-1-1-5-6672-kaqfvd`) that cannot be predicted ahead of time. Use `IS_PATTERN: true` to list all services and find the first one whose `unique_name` contains `SERVICE_NAME` as a substring.

```yaml
steps:
  (...)

  - name: Get Queued Callback Service
    id: queuedCallback
    uses: zingdevlimited/actions-helpers/get-twilio-functions-service@v4
    with:
      SERVICE_NAME: plibo-queued-callback-and-voicemail
      IS_PATTERN: true
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}

  - name: Check Queued Callback Service
    run: |
      echo "Resolved Name: ${{ steps.queuedCallback.outputs.RESOLVED_SERVICE_NAME }}"
      echo "Base URL: ${{ steps.queuedCallback.outputs.BASE_URL }}"
```

- The first service whose `unique_name` contains `SERVICE_NAME` is used.
- If no service matches, the action always fails hard (regardless of `IGNORE_NOT_FOUND`).
- `RESOLVED_SERVICE_NAME` contains the actual matched unique name.
