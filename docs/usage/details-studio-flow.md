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

Update Set Variables widgets to replace every occurrence of a flow variable.

```json
{
  (...),
  "enableShellVariables": true,
  "replaceWidgetTypes": [
    "set-variables"
  ],
  "variableReplacements": {
    "assetsBaseUrl": "$ASSETS_BASE_URL"
  }
}
```

The example above will search every Studio Flow JSON for Set Variables widgets, and check if they are assigning a value to the `assetsBaseUrl` key. Every widget that assigns this key will have its value replaced.

### Run Function

Update Run Function widgets with the correct Base URL, Service Sid, Environment Sid, and Function Sid.

The base URL in your Flow JSON is used to match the widget to the correct Function Service, so it is important that you do not manually overwrite this URL in the Flow JSON.

```json
{
  (...),
  "replaceWidgetTypes": [
    "run-function"
  ],
  "functionServices": [
    {
      "name": "my-custom-api",
      "environmentSuffix": null
    }
  ]
}
```

If the Twilio account you are deploying to has the Functions Service `my-custom-api-1111`, and your Flow JSON points to `https://my-custom-api-2222-dev.twil.io/func`, then the example above will update the URL to `https://my-custom-api-1111.twil.io/func`.

### Run Subflow

Update Run Subflow widgets with the correct Flow sid.

Using the Studio Flow Editor, you need to add `subflowName` to the flow parameters for this replacement to work.

#### Option 1: Using Friendly Names

```json
{
  (...),
  "replaceWidgetTypes": [
    "run-subflow"
  ]
}
```

Set the `subflowName` parameter to match the Studio Subflow **Friendly Name**.

#### Option 2: Using Known Sids

```json
{
  (...),
  "enableShellVariables": true,
  "replaceWidgetTypes": [
    "run-subflow"
  ],
  "subflowMap": {
    "callSubflow": "$CALL_SUBFLOW_SID"
  }
}
```

Set the `subflowName` attribute to match a key in the `subflowMap` object. I this example you would set it to `callSubflow`.

### Send to Flex

Update Send to Flex widgets with the correct Workflow and Channel sids.

Using the Studio Flow Editor, you need to add `workflowName` and `channelName` to the task attributes for this replacement to work.

#### Option 1: Using Friendly Names

```json
{
  (...),
  "replaceWidgetTypes": [
    "send-to-flex"
  ]
}
```

Set the `workflowName` attribute to match the Workflow **Friendly Name**, and the `channelName` attribute to match the TaskChannel **Unique Name**.

#### Option 2: Using Known Sids

```json
{
  (...),
  "enableShellVariables": true,
  "replaceWidgetTypes": [
    "send-to-flex"
  ],
  "workflowMap": {
    "voiceWorkflow": "$VOICE_WORKFLOW_SID"
  }
}
```

Set the `workflowName` attribute to match a key in the `workflowMap` object. In this example you would set it to `voiceWorkflow`. Set the `channelName` attribute to match the TaskChannel **Unique Name**.

## Shell Variables in Configuration

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
