# Update Studio Flows Action

Add the Studio Flows you want to deploy to the `flows` list:

```json
{
  "flows": [
    {
      "name": "main-call-flow",
      "path": "studio-flows/main-call-flow.json",
      "allowCreate": true
    },
    {
      "name": "call-subflow",
      "path": "studio-flows/call-subflow.json",
      "subflow": true,
      "allowCreate": true
    }
  ]
}
```

The `name` field should match the **Friendly Name** of the Studio Flow. This will be used to check if the Studio Flow already exists (unless you specify `sid`, in which case the `name` field will be ignored).

The `path` field should be a path from your repository root to the studio flow JSON file.

**Note:** You should simply copy the Studio Flow JSON from the Studio Flow editor and commit it to your repository. You do not need to make any manual edits to the JSON.

## Replaceable Widget Types

In order to update a widget type, you need to enable it by adding it to the `replaceWidgetTypes` array.

### Set Variables

TODO

### Run Function

TODO

### Run Subflow

TODO

### Send to Flex

Update Send to Flex widgets with the correct Workflow and Channel sids.

Using the Studio Flow Editor, you need to add `workflowName` and `channelName` to the task attributes for this replacement to work.

#### Option 1: Using Friendly Names

```json
{
  "flows": [ (...) ],
  "replaceWidgetTypes": [
    "send-to-flex"
  ]
}
```

Set the `workflowName` attribute to match the Workflow friendly name, and the `channelName` attribute to match the TaskChannel unique name.

#### Option 2: Using Known Sids

```json
{
  "enableShellVariables": true,
  "flows": [ (...) ],
  "replaceWidgetTypes": [
    "send-to-flex"
  ],
  "workflowMap": {
    "voiceWorkflow": "$VOICE_WORKFLOW_SID"
  }
}
```

Set the `workflowName` attribute to match a key in the `workflowMap` object. In this example you would set it to `voiceWorkflow`. Set the `channelName` attribute to match the TaskChannel unique name.

## Using Shell Variables

If you set `enableShellVariables` to true, you can use **\$VARIABLE_NAME** references in your configuration file. You can then use an env block in your action call to replace the values of these variables:

```yaml
steps:
  (...)

  - name: Update Studio Flows
    uses: zingdevlimited/actions-helpers/update-studio-flows@v3
    with:
      CONFIG_PATH: studioconfig.json
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
    env:
      VOICE_WORKFLOW_SID: ${{ env.VOICE_WORKFLOW_SID }} # Could come from e.g. terraform
      ASSETS_BASE_URL: ${{ steps.assetsApi.outputs.BASE_URL }}
```

This example will replace any instances of **\$VOICE_WORKFLOW_SID** and **\$ASSETS_BASE_URL** in your configuration file before processing it.
