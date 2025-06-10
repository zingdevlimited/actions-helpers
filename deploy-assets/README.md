# Deploy Assets

Deploy Assets to a Twilio Serverless Service. All required resources (Service, Environment, Asset) will be created if they do not exist. Any deployments to the provided environment will be overwritten so only the assets explicitly specified will be active.

If an `ENVIRONMENT_NAME` and `ENVIRONMENT_SUFFIX` is not specified then the assets will be deployed to the production Environment of the Service.

```yaml
steps:
  (...)

  - name: Deploy Assets
    uses: zingdevlimited/actions-helpers/deploy-assets@v3
    with:
      ASSETS_DIRECTORY: assets/english
      SERVICE_NAME: example-studio-assets
      ENVIRONMENT_NAME: english
      ENVIRONMENT_SUFFIX: en
      UI_EDITABLE: false
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```