# Format App Settings

Use to format variables into an Azure App Settings string. Pass in as env file formatted key-value pairs.

```yaml
- name: Format App Settings
  id: appSettings
  uses: zingdevlimited/actions-helpers/azure/format-app-settings@v4
  with:
    APP_SETTINGS_ENV: |
      SERVICE_BUS_NAME=${{ env.SERVICE_BUS_NAME }}
      WEBSITE_RUN_FROM_PACKAGE=1
```

Also allows encrypting the output string so it can be passed between runners (jobs)

```yaml
- name: Format App Settings
  id: appSettings
  uses: zingdevlimited/actions-helpers/azure/format-app-settings@v4
  with:
    ENCRYPT_OUTPUT: true
    ENCRYPTION_PASSWORD: ${{ secrets.ENCRYPTION_PASSWORD }}
    APP_SETTINGS_ENV: |
      APPINSIGHTS_INSTRUMENTATION_KEY=${{ env.INSTRUMENTION_KEY }}
```
