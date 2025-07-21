# Update Flex Config

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
      CONFIG_DATA_JSON: |
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
