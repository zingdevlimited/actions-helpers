# Update Content Templates

Create the defined Content Templates in your Twilio account.

You need to first setup a JSON configuration file with the schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/update-content-templates.json"
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
    uses: zingdevlimited/actions-helpers/update-content-templates@v4
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
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/update-content-templates.json",
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

### Allow Replace

Once a Content Template has been created, it cannot be updated.

You can set `ALLOW_REPLACE: true` if you want to delete and recreate the
Content Template if a difference between the config file and the remote setup has been detected.

⚠️ Note that this replacement will render the original Content Template sid invalid. 
Ensure all references to this sid are updated at the same time.

```yaml
steps:
  - name: Checkout File
    uses: actions/checkout@v4
    with:
      sparse-checkout: content-templates-config.json
      sparse-checkout-cone-mode: false
    
  - name: Update Content Templates
    uses: zingdevlimited/actions-helpers/update-content-templates@v4
    with:
      CONFIG_PATH: content-templates-config.json
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```