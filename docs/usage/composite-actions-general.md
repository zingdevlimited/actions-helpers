# Composite Actions (General)

- [Composite Actions (General)](#composite-actions-general)
  - [Get Twilio Functions Service](#get-twilio-functions-service)
  - [Get Twilio Resource Sid](#get-twilio-resource-sid)
    - [Example 1: Default Sync Service](#example-1-default-sync-service)
    - [Example 2: Taskrouter Workspace](#example-2-taskrouter-workspace)
    - [Example 3: Taskrouter TaskChannel](#example-3-taskrouter-taskchannel)
    - [Example 4: Flex Conversation Service](#example-4-flex-conversation-service)
  - [Update Twilio Functions Variables](#update-twilio-functions-variables)
  - [Update Taskrouter](#update-taskrouter)
    - [Non-Flex Account](#non-flex-account)
    - [Example Setup](#example-setup)
  - [Update Content Templates](#update-content-templates)
  - [Update Flex Config](#update-flex-config)
  - [Update Flex Skills](#update-flex-skills)
    - [Simple Skills](#simple-skills)
    - [Complex Skills](#complex-skills)
  - [Setup Flex CLI](#setup-flex-cli)
  - [Deploy Flex Plugin Asset](#deploy-flex-plugin-asset)
  - [Create Flex Plugin Version](#create-flex-plugin-version)
  - [Register Event Stream Webhook](#register-event-stream-webhook)

## [Get Twilio Functions Service](../../get-twilio-functions-service/action.yaml)

Use to get the Sids and Base URL of a deployed Twilio Functions Service.

```yaml
steps:
  (...)

  - name: Get My Api Info
    id: myApi
    uses: zingdevlimited/actions-helpers/get-twilio-functions-service@v3
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

## [Get Twilio Resource Sid](../../get-twilio-resource-sid/action.yaml)

Use to get the Sid of any Twilio resource. The way you need to set the inputs is based on the Read/List API call of the resource you want to retrieve. The API call is made to the endpoint:

https://`TWILIO_AREA`.twilio.com/`VERSION`/`API_TYPE`

(Taskrouter is an exception, as the Workspace sid is automatically included)

From the JSON response, `.meta.key` is used to read the array of resources. A search is made in this array for an object with the property `SEARCH_BY` == `SEARCH_VALUE`.

**Outputs**:

- SID

### Example 1: Default [Sync Service](https://www.twilio.com/docs/sync/api/service?code-sample=code-read-service&code-language=curl&code-sdk-version=json)

```yaml
steps:
  (...)

  - name: Get Sync Service Sid
    id: syncService
    uses: zingdevlimited/actions-helpers/get-twilio-resource-sid@v3
    with:
      TWILIO_AREA: sync
      API_TYPE: Services
      SEARCH_BY: unique_name
      SEARCH_VALUE: default
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}

  - name: Check Sync Service Sid
    run: echo "${{ steps.syncService.outputs.SID }}"
```

### Example 2: [Taskrouter Workspace](https://www.twilio.com/docs/taskrouter/api/workspace?code-sample=code-read-workspace&code-language=curl&code-sdk-version=json)

```yaml
steps:
  (...)

  - name: Get Taskrouter Workspace Sid
    id: trWorkspace
    uses: zingdevlimited/actions-helpers/get-twilio-resource-sid@v3
    with:
      TWILIO_AREA: taskrouter
      API_TYPE: Workspaces
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}

  - name: Check Workspace Sid
    run: echo "${{ steps.trWorkspace.outputs.SID }}"
```

Taskrouter workspace is an exception where you only need to provide `TWILIO_AREA` and `API_TYPE`, as it is assumed every Flex project only has 1 Workspace.

### Example 3: [Taskrouter TaskChannel](https://www.twilio.com/docs/taskrouter/api/task-channel?code-sample=code-read-task-channel&code-language=curl&code-sdk-version=json)

```yaml
steps:
  (...)

  - name: Get Voice Channel Sid
    id: trVoiceChannel
    uses: zingdevlimited/actions-helpers/get-twilio-resource-sid@v3
    with:
      TWILIO_AREA: taskrouter
      API_TYPE: TaskChannels
      SEARCH_BY: unique_name
      SEARCH_VALUE: voice
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}

  - name: Check Voice Channel Sid
    run: echo "${{ steps.trVoiceChannel.outputs.SID }}"
```

### Example 4: Flex [Conversation Service](https://www.twilio.com/docs/conversations/api/service-resource?code-sample=code-read-service&code-language=curl&code-sdk-version=json)

```yaml
steps:
  (...)

  - name: Get Flex Conversation Service Sid
    id: conversationService
    uses: zingdevlimited/actions-helpers/get-twilio-resource-sid@v3
    with:
      TWILIO_AREA: conversations
      API_TYPE: Services
      SEARCH_BY: friendly_name
      SEARCH_VALUE: "Flex Conversation Service"
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}

  - name: Check Conversation Service Sid
    run: echo "${{ steps.conversationService.outputs.SID }}"
```

## [Update Twilio Functions Variables](../../update-twilio-functions-variables/action.yaml)

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

- Every variable you want to add should be listed in `VARIABLES_ENV` in the format of an env file.

- Any variable set with an empty value will cause the step to error unless the variable is listed in `OPTIONAL_VARIABLES`.

- Any existing variable saved to the Functions Service that is not in this list will be deleted.

## [Update Taskrouter](../../update-taskrouter/action.yaml)

Update the Taskrouter Configuration of a Workspace in your Twilio account.

You need to first setup a JSON configuration file with the schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v3/.schemas/update-taskrouter.json"
}
```

You can then define any **Activities**, **TaskChannels**, **TaskQueues**, and **Workflows** you would like to create/update.
Resources are identified by the **Friendly Name**. If a resource with the chosen friendly name already exists, it will be updated.

To use the action in your pipeline:

```yaml
steps:
  - name: Checkout File
    uses: actions/checkout@v4
    with:
      sparse-checkout: taskrouter-config.json
      sparse-checkout-cone-mode: false
    
  - name: Update Taskrouter
    uses: zingdevlimited/actions-helpers/update-taskrouter@v3
    with:
      CONFIG_PATH: taskrouter-config.json
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

**Outputs**:

- RESOURCES
- WORKSPACE_SID

### Non-Flex Account

If you are using a non-Flex account, you need to also provide the `WORKSPACE_NAME` parameter:

```yaml
(...)
  - name: Update Taskrouter
    uses: zingdevlimited/actions-helpers/update-taskrouter@v3
    with:
      CONFIG_PATH: taskrouter-config.json
      WORKSPACE_NAME: Custom Workspace
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

### Example Setup

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v3/.schemas/update-taskrouter.json",
  "activities": [
    {
      "friendlyName": "On Call",
      "available": false
    }
  ],
  "queues": [
    {
      "friendlyName": "Sales",
      "targetWorkers": "routing.skills HAS 'sales'",
      "assignmentActivity": {
        "friendlyName": "On Call" // Reference to On Call activity
      }
    }
  ],
  "workflows": [
    {
      "friendlyName": "Call Workflow",
      "configuration": {
        "task_routing": {
          "filters": [
            {
              "filter_friendly_name": "Sales",
              "expression": "skillNeeded == 'sales'",
              "targets": [
                {
                  "queue": {
                    "friendlyName": "Sales" // Reference to Sales queue
                  }
                }
              ]
            }
          ],
          "default_filter": {
            "queue": {
              "friendlyName": "Everyone" // Reference to Everyone queue
            }
          }
        }
      }
    }
  ]
}
```

## [Update Content Templates](../../update-content-templates/action.yaml)

Create the defined Content Templates in your Twilio account.

You need to first setup a JSON configuration file with the schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v3/.schemas/update-content-templates.json"
}
```

You can then define any **Templates** you would like to create.
Resources are identified by the **Friendly Name** and **Language**. If a resource with the chosen friendly name and language already exists, it will be ignored.

To use the action in your pipeline:

```yaml
steps:
  - name: Checkout File
    uses: actions/checkout@v4
    with:
      sparse-checkout: content-templates-config.json
      sparse-checkout-cone-mode: false
    
  - name: Update Content Templates
    uses: zingdevlimited/actions-helpers/update-content-templates@v3
    with:
      CONFIG_PATH: content-templates-config.json
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

**Outputs**:

- RESOURCES

### Example Setup

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v3/.schemas/update-content-templates.json",
  "templates": [
    {
      "friendly_name": "owl_air_qr",
      "language": "en",
      "variables": {
        "1": "Owl Air Customer"
      },
      "types": {
        "twilio/quick-reply": {
          "body": "Hi, {{1}} 👋 \nThanks for contacting Owl Air Support. How can I help?",
          "actions": [
            {
              "title": "Check flight status",
              "id": "flightid1"
            },
            {
              "title": "Check gate number",
              "id": "gateid1"
            },
            {
              "title": "Speak with an agent",
              "id": "agentid1"
            }
          ]
        },
        "twilio/text": {
          "body": "Hi, {{1}}. \n Thanks for contacting Owl Air Support. How can I help?."
        }
      }
    }
  ]
}
```

## [Update Flex Config](../../update-flex-config/action.yaml)

Update a subsection in the Twilio [Flex Configuration](https://www.twilio.com/docs/flex/developer/config/flex-configuration-rest-api) object. The section will be used as a key under the `.ui_attributes` object. The data under this key will be overwritten on every run, but the rest of the Flex Configuration object will be unaffected.

```yaml
steps:

  - name: Update Flex Config
    uses: zingdevlimited/actions-helpers/update-flex-config@v3
    with:
      TWILIO_ACCOUNT_SID: ${{ env.TWILIO_ACCOUNT_SID }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      CONFIG_SECTION: MyPluginConfig
      CONFIG_DATA_JSON:
        {
          "CRM_URL": "${{ env.CRM_URL }}",
          "DEBUG_MODE": false,
          "MESSAGE_TIMEOUT": 10
        }
```

This will update the Flex Configuration accordingly:

```json
{
  (...)
  "ui_attributes": {
    (...)
    "MyPluginConfig": {
      "CRM_URL": "https://example.yourcrmurl.com/",
      "DEBUG_MODE": false,
      "MESSAGE_TIMEOUT": 10
    }
  }
}
```

## [Update Flex Skills](../../update-flex-skills/action.yaml)

Update Twilio Flex Agent Skills by updating the Flex Configuration object. By default it will merge with existing skills on the account, but you can set the **MODE** input variable to `replace`.

### Simple Skills

You can provide just a list of skill names (newline-separated).

```yaml
steps:

  - name: Update Flex Skills
    uses: zingdevlimited/actions-helpers/update-flex-skills@v3
    with:
      TWILIO_ACCOUNT_SID: ${{ env.TWILIO_ACCOUNT_SID }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      SIMPLE_SKILLS: |
        sales
        support
        billing
```

### Complex Skills

If you want skill levels you need to provide a JSON array.

```yaml
steps:

  - name: Update Flex Skills
    uses: zingdevlimited/actions-helpers/update-flex-skills@v3
    with:
      TWILIO_ACCOUNT_SID: ${{ env.TWILIO_ACCOUNT_SID }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      COMPLEX_SKILLS: |
        [
          {"name": "sales", "multivalue": true, "minimum": 1, "maximum": 5},
          {"name": "billing", "multivalue": false, "minimum": null, "maximum": null}
        ]
```

## [Setup Flex CLI](../../setup-flex-cli/action.yaml)

Install the Twilio CLI with the Flex CLI to the current job. The version is selected from the version of `@twilio/flex-plugin-scripts` in your plugin package.json file.

Ensure you run `setup-node` in a previous step.

```yaml
steps:
  (...)

  - name: Set up Node 18
    uses: actions/setup-node@v4
    with:
      node-version: 18.x
      cache: yarn
      cache-dependency-path: yarn.lock

  - name: Setup Flex CLI
    uses: zingdevlimited/actions-helpers/setup-flex-cli@v3
    with:
      PLUGIN_DIRECTORY: my-plugin
```

## [Deploy Flex Plugin Asset](../../deploy-flex-plugin-asset/action.yaml)

Deploy a Flex Plugin bundle.js file as an Asset to the Default Plugin Service (The one named `Flex Plugins Service (Autogenerated) - Do Not Delete`).

```yaml
steps:
  (...)

  - name: Deploy Plugin Bundle
    id: deployBundle
    uses: zingdevlimited/actions-helpers/deploy-flex-plugin-asset@v3
    with:
      FILE_PATH: my-plugin/build/my-plugin.js
      PLUGIN_NAME: my-plugin
      PLUGIN_VERSION: "1.0.0"
      ALLOW_VERSION_OVERWRITE: false
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}

  - name: Check Bundle URL
    run: echo "${{ steps.deployBundle.outputs.ASSET_URL }}
```

**Outputs:**

- ASSET_URL

This action will do the following steps:

1. Check if the [Functions Service](https://www.twilio.com/docs/serverless/api/resource/service) `default` exists. If it does not, it will create it with the friendly name `Flex Plugins Service (Autogenerated) - Do Not Delete`.

2. Check if there is an [Environment](https://www.twilio.com/docs/serverless/api/resource/environment) with the unique name matching your plugin name. If it does not exist, it will create a new Environment with the unique name set to your plugin name, and the domain suffix as 7 random characters

3. Get all the [Asset Versions](https://www.twilio.com/docs/serverless/api/resource/asset-version) that were deployed to the last [Build](https://www.twilio.com/docs/serverless/api/resource/build) of the Environment.

4. If there is a deployed Asset Version that matches the current plugin version, check the input `ALLOW_VERSION_OVERWRITE`.
      - **If it is `true`**: The action will continue
      - **Otherwise**: The action will stop execution

5. Create a new Asset Version with your bundle file

6. Create a Build containing the new Asset Version **and** all the Asset Versions of the previous Build.

7. Deploy the Build to the Environment

## [Create Flex Plugin Version](../../create-flex-plugin-version/action.yaml)

Use Flex API to create a [Plugin Version](https://www.twilio.com/docs/flex/developer/plugins/api/plugin-version) with a given bundle URL.

If the Plugin Version is included in an active release, the bundle URL will be fetched (with a `X-Twilio-Signature` header) every time an agent opens Flex. Therefore, it is important that the bundle is saved to a persistent location.

If the Plugin Version already exists, a warning will be logged.

```yaml
steps:
  (...)

  - name: Create Plugin Version
    uses: zingdevlimited/actions-helpers/create-flex-plugin-version@v3
    with:
      PLUGIN_NAME: my-plugin
      PLUGIN_VERSION: "1.0.0"
      ASSET_URL: ${{ steps.deployBundle.outputs.ASSET_URL }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

## [Register Event Stream Webhook](../../register-event-stream-webhook/action.yaml)

Register a Twilio Event Stream Webhook Sink along with an Event Subscription. The Sink resource is only created if an existing Sink with the same webhook destination URL does not exist. The Event Subscription will be updated based on the [Event Types](https://www.twilio.com/docs/events/event-types-list) provided.

The **EVENT_TYPES** parameter needs to be provided as newline-separated `<Event>=<Schema Version>` pairs:

```yaml
steps:
  (...)

  - name: Register Call Completed Webhook
    uses: zingdevlimited/actions-helpers/register-event-stream-webhook@v3
    with:
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      SINK_WEBHOOK_URL: "https://yourapibase-1234.twil.io/callback/call-completed"
      SINB_WEBHOOK_METHOD: POST
      SINK_DESCRIPTION: "Create Call Completed Record"
      SINK_BATCH_EVENTS: false
      SUBSCRIPTION_DESCRIPION: "Call Complete Subscription"
      EVENT_TYPES: |
        com.twilio.voice.status-callback.call.completed=1

  - name: Register Task Events Webhook
    uses: zingdevlimited/actions-helpers/register-event-stream-webhook@v3
    with:
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      SINK_WEBHOOK_URL: "https://yourapibase-1234.twil.io/callback/task-events"
      SINB_WEBHOOK_METHOD: POST
      SINK_DESCRIPTION: "Process Task Events"
      SINK_BATCH_EVENTS: false
      SUBSCRIPTION_DESCRIPION: "Task Events Subscription"
      EVENT_TYPES: |
        com.twilio.taskrouter.task.canceled=3
        com.twilio.taskrouter.task.updated=3
        com.twilio.taskrouter.task.wrapup=3
```

**Outputs:**

- SINK_SID
- SUBSCRIPTION_SID
