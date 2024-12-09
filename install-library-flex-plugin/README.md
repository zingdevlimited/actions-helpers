# Install Library Flex Plugin

Use to auto-install a plugin from the Flex Plugin Library.

In order to set up the right inputs you will need to locate a few values:

1. Navigate to [Flex Plugin Library](https://flex.twilio.com/admin/plugins/library) and select the Plugin you would like to install
2. Open the Network tab in your browser's Dev Tools
3. Click **Install** to trigger an installation
4. Inspect the outgoing Install request in the Network tab
   1. Save the value of the `plugin_version_sid` string
   2. Note the structure of the `attributes` array

Assign the required Action inputs accordingly, and add any attributes into the `env` block like the following example:

```yaml
steps:
  - name: Install Chat Transfer Plugin
    uses: zingdevlimited/actions-helpers/install-library-flex-plugin@v3
    with:
      FLEX_UI_VERSION: 2.9.1
      PLUGIN_NAME: plibo-chat-transfer
      VERSION_SID: JH5d80db0745414f75d847807c1aa92640 # 2.0.1
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
    env:
      # Add attribute 'TWILIO_FLEX_WORKSPACE_SID'
      ATTRIBUTE_TWILIO_FLEX_WORKSPACE_SID: ${{ env.FLEX_WORKSPACE_SID }}
      # Add attribute 'TWILIO_FLEX_CHAT_TRANSFER_WORKFLOW_SID'
      ATTRIBUTE_TWILIO_FLEX_CHAT_TRANSFER_WORKFLOW_SID: ${{ env.CHAT_TRANSFER_WORKFLOW_SID }}
      # Add attribute 'COLD_TRANSFER_FLAG'
      ATTRIBUTE_COLD_TRANSFER_FLAG: Enable
      # Add attribute 'MULTI_PARTICIPANT_FLAG'
      ATTRIBUTE_MULTI_PARTICIPANT_FLAG: Enable
```

Note that some Library Plugins may require JSON attributes:

```yaml
steps:
  - name: Install Activity Skill Filter Plugin
    uses: zingdevlimited/actions-helpers/install-library-flex-plugin@v3
    with:
      FLEX_UI_VERSION: 2.9.1
      PLUGIN_NAME: plibo-activity-skill-filter
      VERSION_SID: JH86c36f9d74dc992b469a9eb7c540035c # 1.1.0
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
    env:
      # Add attribute with name 'TWILIO_FLEX_CONFIG_ACTIVITY_SKILL_FILTER'
      ATTRIBUTE_TWILIO_FLEX_CONFIG_ACTIVITY_SKILL_FILTER: |
        {
          "rules": {
            "Break": {
              "sort_order": "0",
              "required_skill": "HR"
            }
          },
          "filter_teams_view": true
        }
```