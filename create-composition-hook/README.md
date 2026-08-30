# Create Composition Hook

Create or update a Twilio Video Composition Hook in your Twilio account.

You need to first setup a JSON configuration file with the schema:

```json
{
  "$schema": "path/to/schema.json"
}
```

You can then define the **Composition Hook** you would like to create/update.
The resource is identified by the **Friendly Name**. If a composition hook with the chosen friendly name already exists, it will be updated.

To use the action in your pipeline:

```yaml
steps:
  - name: Checkout File
    uses: actions/checkout@v4
    with:
      sparse-checkout: composition-hook-config.json
      sparse-checkout-cone-mode: false

  - name: Create Composition Hook
    uses: path/to/create-composition-hook@v4
    with:
      CONFIG_PATH: composition-hook-config.json
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

**Outputs**:

- COMPOSITION_HOOK_SID

## Example Setup

```json
{
  "$schema": "path/to/schema.json",
  "hook": {
    "friendlyName": "Provider Calls Composition",
    "format": "mp4",
    "resolution": "1280x720",
    "videoLayout": {
      "grid": {
        "video_sources": ["*"]
      }
    }
  }
}
```

## Notes

- `friendlyName` is used to find an existing hook.
- If `format` is not provided, the action defaults to `mp4`.
- If `resolution` is not provided, the action defaults to `640x480`.
- If `videoLayout` is not provided, the action defaults to:

```json
{
  "grid": {
    "video_sources": ["*"]
  }
}
```