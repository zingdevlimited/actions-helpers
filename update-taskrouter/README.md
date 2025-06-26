# Update Taskrouter

Update the Taskrouter Configuration of a Workspace in your Twilio account.

You need to first setup a JSON configuration file with the schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/update-taskrouter.json"
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
    uses: zingdevlimited/actions-helpers/update-taskrouter@v4
    with:
      CONFIG_PATH: taskrouter-config.json
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

**Outputs**:

- RESOURCES
- WORKSPACE_SID

## Non-Flex Account

If you are using a non-Flex account, you need to also provide the `WORKSPACE_NAME` parameter:

```yaml
(...)
  - name: Update Taskrouter
    uses: zingdevlimited/actions-helpers/update-taskrouter@v4
    with:
      CONFIG_PATH: taskrouter-config.json
      WORKSPACE_NAME: Custom Workspace
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

## Example Setup

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/update-taskrouter.json",
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
