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