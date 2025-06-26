# Create Flex Plugin Version

Use Flex API to create a [Plugin Version](https://www.twilio.com/docs/flex/developer/plugins/api/plugin-version) with a given bundle URL.

If the Plugin Version is included in an active release, the bundle URL will be fetched (with a `X-Twilio-Signature` header) every time an agent opens Flex. Therefore, it is important that the bundle is saved to a persistent location.

If the Plugin Version already exists, a warning will be logged.

```yaml
steps:
  (...)

  - name: Create Plugin Version
    uses: zingdevlimited/actions-helpers/create-flex-plugin-version@v4
    with:
      PLUGIN_NAME: my-plugin
      PLUGIN_VERSION: "1.0.0"
      ASSET_URL: ${{ steps.deployBundle.outputs.ASSET_URL }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```
