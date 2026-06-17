# Deploy Assets

Deploy Assets to a Twilio Serverless Service. All required resources (Service, Environment, Asset) will be created if they do not exist. 

By default, deployments to the provided environment are overwritten so only the assets explicitly provided in the assets directory will be active (this can be changed by setting the `PRESERVE_EXISTING` parameter flag).

Set `PRESERVE_EXISTING: true` to keep currently deployed assets not included in the `ASSETS_DIRECTORY` and preserve currently deployed Twilio Functions on the service.

If an `ENVIRONMENT_NAME` and `ENVIRONMENT_SUFFIX` are not specified, then the assets will be deployed to the production Environment of the Service.

```yaml
steps:
  (...)

  - name: Deploy Assets
    uses: zingdevlimited/actions-helpers/deploy-assets@v5
    with:
      ASSETS_DIRECTORY: assets/english
      SERVICE_NAME: example-studio-assets
      ENVIRONMENT_NAME: english
      ENVIRONMENT_SUFFIX: en
      UI_EDITABLE: false
      PRESERVE_EXISTING: true
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

## Special Markers (Loopback URL)

With the `REPLACE_MARKERS_IN_EXT` input you can provide a comma-separated list of file extensions that contain special markers. This will search and replace the markers in any asset files with the given extension. Ensure these file types are text-encoded.

If you have an asset `twiml.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>{{DOMAIN}}/testaudio.mp3</Play>
</Response>
```

With the action configured as following:

```yaml
steps:
  (...)

  - name: Deploy Assets
    uses: zingdevlimited/actions-helpers/deploy-assets@v5
    with:
      ASSETS_DIRECTORY: assets/english
      SERVICE_NAME: example-studio-assets
      ENVIRONMENT_SUFFIX: en
      REPLACE_MARKERS_IN_EXT: xml
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

Then the resulting asset content will be:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>https://example-studio-assets-1234-en.twil.io/testaudio.mp3</Play>
</Response>
```

