# Reset Twilio Account

> ⚠️ Never run this utility in a Production account.
> It is only meant for cleaning up a Development account or attempt to recover it from a broken state.
> The deletions performed by this utility **cannot** be reversed.

Resets given areas of a Twilio account to the default state.
Note that the *default* state may change over time, and there is no guarantee this Action will be up-to-date with changes Twilio makes.

```yaml
jobs:
  reset_account:
    # Should never be run on a customer remote
    if: github.repository_owner == 'zingdevlimited'
    runs-on: ubuntu-22.04
    steps:
      - name: Reset
        uses: zingdevlimited/actions-helpers/reset-twilio-account@v4
        with:
          TWILIO_API_KEY: ${{ vars.DEVELOP_TWILIO_API_KEY }}
          TWILIO_API_SECRET: ${{ secrets.DEVELOP_TWILIO_API_SECRET }}
          # Select the areas to reset
          TASKROUTER: true
          SYNC: true
          STUDIO: true
          SERVERLESS: true
          FLEX_CUSTOM_PLUGINS: true
          FLEX_UI_ATTRIBUTES: true
```

## Twilio Areas

The action will only reset Twilio Areas you specify in inputs.
Default resources that have been deleted will be recreated.

### Taskrouter

The action assumes that you are working with a Flex-enabled Account

- Delete all Tasks
- Delete all Workers
- Delete all Workflows except `Assign to Anyone`
- Delete all Queues except `Everyone`
- Delete all Channels except:
  - Default
  - Voice
  - Chat
  - SMS
  - Video
  - Email
- Delete all Activities except:
  - Offline
  - Available
  - Unavaliable
  - Break
- Reset the Workspace settings to default

### Sync

- Delete all Sync Services except the one with Unique Name `default`
- Reset the settings of the Default Sync Service
- Delete all resources under the Default Sync Service

### Studio

- Delete all Studio Flows

### Serverless

- Delete all Function Services except the one with Unique Name `default`

### Flex Custom Plugins

Create a Flex Release that disables all Custom Plugins.
Note that the action does **not** Archive the plugins as this is an inreversible operation.

### Flex UI Attributes

Reset the UI Attributes section of Flex Configuration to default (at the time this action was last updated).

It is recommended to uninstall any Library Plugins before running the action with this option.
