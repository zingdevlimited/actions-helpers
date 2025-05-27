# Update Twilio Functions Variables

Update the Environment Variables of a deployed Twilio Functions Service

```yaml
steps:
  (...)

  - name: Update Variables
    uses: zingdevlimited/actions-helpers/update-twilio-functions-variables@v3
    with:
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      SERVICE_NAME: my-api
      VARIABLES_ENV: |
        TWILIO_API_KEY=${{ env.TWILIO_API_KEY }}
        TWILIO_API_SECRET=${{ env.TWILIO_API_SECRET }}
        TWILIO_WORKSPACE_SID=${{ steps.trWorkspace.outputs.SID }}
```

- Every variable you want to add should be listed in `VARIABLES_ENV` in the format of an env file. Ensure you do not add any additional quotes around the values.

- Any variable set with an empty value will cause the step to error unless the variable is listed in `OPTIONAL_VARIABLES` (comma-separated list of keys).

- Any existing variable saved to the Functions Service that is not in this list will be deleted.
