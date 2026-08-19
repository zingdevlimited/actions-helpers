# Sync TaskRouter

Synchronise the TaskRouter Configuration from a Workspace in your Twilio account into a JSON configuration file.

The generated file uses the schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/update-taskrouter.json"
}
```

The action exports:

- Activities
- TaskChannels
- TaskQueues
- Workflows
- Workspace configuration

References between resources are stored using **Friendly Names** where possible to ensure the configuration remains portable across environments.

## Usage

To use the action in your pipeline:

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Sync TaskRouter
    uses: zingdevlimited/actions-helpers/sync-taskrouter@feat/VN/enhance-taskrouter-actions
    with:
      CONFIG_PATH: taskrouter-config.json
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      TOKEN: ${{ github.token }}
```

The action will:

1. Read the current TaskRouter configuration from Twilio.
2. Generate or update the configuration file.
3. Create a branch.
4. Commit any detected changes.
5. Create a Pull Request containing the updated configuration.

If no changes are detected, no Pull Request will be created.

## Non-Flex Account

If you are using a non-Flex account, provide the `WORKSPACE_NAME` parameter to specify which workspace should be synchronised.

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Sync TaskRouter
    uses: zingdevlimited/actions-helpers/sync-taskrouter@feat/VN/enhance-taskrouter-actions
    with:
      CONFIG_PATH: taskrouter-config.json
      WORKSPACE_NAME: Custom Workspace
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      TOKEN: ${{ github.token }}
```

If `WORKSPACE_NAME` is not supplied, the default Flex TaskRouter workspace will be used.

## Generated Configuration Example

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/update-taskrouter.json",
  "activities": [
    {
      "friendlyName": "Offline",
      "available": false
    },
    {
      "friendlyName": "Available",
      "available": true
    }
  ],
  "queues": [
    {
      "friendlyName": "Support",
      "maxReservedWorkers": 1,
      "targetWorkers": "routing.skills has \"Support\"",
      "taskOrder": "FIFO"
    }
  ],
  "workflows": [
    {
      "friendlyName": "Assign to Anyone",
      "taskReservationTimeout": 30,
      "configuration": {
        "task_routing": {
          "filters": [
            {
              "filter_friendly_name": "Support",
              "expression": "target==\"Support\"",
              "targets": [
                {
                  "queue": {
                    "friendlyName": "Support"
                  }
                }
              ]
            }
          ],
          "default_filter": {
            "queue": {
              "friendlyName": "Everyone"
            }
          }
        }
      }
    }
  ],
  "workspace": {
    "defaultActivity": {
      "friendlyName": "Offline"
    },
    "timeoutActivity": {
      "friendlyName": "Offline"
    },
    "prioritizeQueueOrder": "FIFO"
  }
}
```


This allows TaskRouter configuration changes to be tracked, reviewed and promoted between environments using standard Git workflows.