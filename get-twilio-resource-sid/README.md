# Get Twilio Resource Sid

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
    uses: zingdevlimited/actions-helpers/get-twilio-resource-sid@v4
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

## Example 2: [Taskrouter Workspace](https://www.twilio.com/docs/taskrouter/api/workspace?code-sample=code-read-workspace&code-language=curl&code-sdk-version=json)

```yaml
steps:
  (...)

  - name: Get Taskrouter Workspace Sid
    id: trWorkspace
    uses: zingdevlimited/actions-helpers/get-twilio-resource-sid@v4
    with:
      TWILIO_AREA: taskrouter
      API_TYPE: Workspaces
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}

  - name: Check Workspace Sid
    run: echo "${{ steps.trWorkspace.outputs.SID }}"
```

Taskrouter workspace is an exception where you only need to provide `TWILIO_AREA` and `API_TYPE`, as it is assumed every Flex project only has 1 Workspace.

## Example 3: [Taskrouter TaskChannel](https://www.twilio.com/docs/taskrouter/api/task-channel?code-sample=code-read-task-channel&code-language=curl&code-sdk-version=json)

```yaml
steps:
  (...)

  - name: Get Voice Channel Sid
    id: trVoiceChannel
    uses: zingdevlimited/actions-helpers/get-twilio-resource-sid@v4
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

## Example 4: Flex [Conversation Service](https://www.twilio.com/docs/conversations/api/service-resource?code-sample=code-read-service&code-language=curl&code-sdk-version=json)

```yaml
steps:
  (...)

  - name: Get Flex Conversation Service Sid
    id: conversationService
    uses: zingdevlimited/actions-helpers/get-twilio-resource-sid@v4
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
