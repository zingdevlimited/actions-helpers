# Check TaskRouter

Validate a TaskRouter configuration file before deployment.

The action validates that the configuration:

- Matches the TaskRouter schema
- Contains valid resource references
- Does not contain duplicate resource names
- Is internally consistent before running `update-taskrouter`

The configuration file should use the schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v5/.schemas/update-taskrouter.json"
}
```

## Usage

To use the action in your pipeline:

```yaml
steps:
  - name: Checkout Repository
    uses: actions/checkout@v4

  - name: Check TaskRouter
    uses: zingdevlimited/actions-helpers/check-taskrouter@v5
    with:
      CONFIG_PATH: taskrouter-config.json
```

## Validations Performed

### Schema Validation

Validates that the configuration matches the TaskRouter schema.

Examples:

- Required properties exist
- Property types are correct
- Enum values are valid
- Workflow configuration structure is valid

### Activity Reference Validation

Validates that all activity references point to activities defined within the configuration.

The following references are checked:

- `workspace.defaultActivity`
- `workspace.timeoutActivity`
- `queue.assignmentActivity`
- `queue.reservationActivity`

Example:

```json
{
  "workspace": {
    "defaultActivity": {
      "friendlyName": "Offline"
    }
  }
}
```

Must reference:

```json
{
  "activities": [
    {
      "friendlyName": "Offline",
      "available": false
    }
  ]
}
```

### Queue Reference Validation

Validates that workflow queue references point to queues defined within the configuration.

The following references are checked:

- `workflow.configuration.task_routing.default_filter.queue`
- `workflow.configuration.task_routing.filters[].targets[].queue`

Example:

```json
{
  "queue": {
    "friendlyName": "Support"
  }
}
```

Must reference a queue defined in:

```json
{
  "queues": [
    {
      "friendlyName": "Support"
    }
  ]
}
```

### Duplicate Resource Validation

Checks for duplicate resource identifiers.

The following must be unique:

- Activity `friendlyName`
- Queue `friendlyName`
- Workflow `friendlyName`
- Channel `uniqueName`

## Example Configuration

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v5/.schemas/update-taskrouter.json",
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
      "assignmentActivity": {
        "friendlyName": "Offline"
      }
    }
  ],
  "workflows": [
    {
      "friendlyName": "Support Workflow",
      "configuration": {
        "task_routing": {
          "filters": [
            {
              "filter_friendly_name": "Support",
              "expression": "target == 'support'",
              "targets": [
                {
                  "queue": {
                    "friendlyName": "Support"
                  }
                }
              ]
            }
          ]
        }
      }
    }
  ]
}
```

Running Check before Update helps identify configuration issues early and prevents deployment failures caused by invalid references, duplicate resource names, or schema validation errors.
