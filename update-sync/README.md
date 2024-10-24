# Update Sync

Create Sync resources with default configurations in your Twilio account. The Sync Service will also be created if it does not exist.

> This action will create resources if not found (matching by Unique Name), but **not** update existing resources. This is to avoid overwiting and changed configuration

You need to first setup a JSON configuration file with the schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v3/.schemas/update-sync.json"
}
```

You can then define any **Documents**, **Lists**, **Maps**, and **Streams** you would like to create.

To use the action in your pipeline:

```yaml
steps:
  - name: Checkout File
    uses: actions/checkout@v4
    with:
      sparse-checkout: sync-config.json
      sparse-checkout-cone-mode: false

  - name: Update Sync
    uses: zingdevlimited/actions-helpers/update-sync@v3
    with:
      CONFIG_PATH: sync-config.json
      SERVICE_NAME: "custom-service"
      SERVICE_ACL_ENABLED: true
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

**Outputs**:

- SYNC_SERVICE_SID

Note that the **SERVICE_NAME** input is optional. If not set, the Default sync service will be used. **SERVICE_ACL_ENABLED** is only applicable if **SERVICE_NAME** is set.

## Example Setup

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v3/.schemas/update-sync.json",
  "documents": [
    {
      "uniqueName": "locale-config",
      "defaultData": {
        "locales": ["en-gb", "en-us"],
        "default": "en-gb"
      }
    }
  ],
  "lists": [
    {
      "uniqueName": "teams",
      "aclPermissions": ["READ_ONLY"]
    }
  ],
  "maps": [
    {
      "uniqueName": "opening-hours",
      "defaultItems": [
        {
          "key": "sales",
          "data": {
            "start": "08:00",
            "end": "17:00"
          }
        }
      ]
    }
  ]
}
```
