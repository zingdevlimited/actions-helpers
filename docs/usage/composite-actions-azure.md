# Composite Actions (Azure)

## [Format App Settings](../../azure/format-app-settings/action.yaml)

Use to format variables into an Azure App Settings string. Pass in as env file formatted key-value pairs.

```yaml
- name: Format App Settings
  id: appSettings
  uses: zingdevlimited/actions-helpers/azure/format-app-settings@v3
  with:
    APP_SETTINGS_ENV: |
      SERVICE_BUS_NAME=${{ env.SERVICE_BUS_NAME }}
      WEBSITE_RUN_FROM_PACKAGE=1
```

Also allows encrypting the output string so it can be passed between runners (jobs)

```yaml
- name: Format App Settings
  id: appSettings
  uses: zingdevlimited/actions-helpers/azure/format-app-settings@v3
  with:
    ENCRYPT_OUTPUT: true
    ENCRYPTION_PASSWORD: ${{ secrets.ENCRYPTION_PASSWORD }}
    APP_SETTINGS_ENV: |
      APPINSIGHTS_INSTRUMENTATION_KEY=${{ env.INSTRUMENTION_KEY }}
```

## [Terraform Output](../../azure/terraform-output/action.yaml)

Get Terraform Outputs from a Terraform State File stored in Azure Blob Storage.
Can be used with the regular Account Key authentication method, or with role-based authentication.

```yaml
- name: Get Terraform Outputs
  id: tf
  uses: zingdevlimited/actions-helpers/azure/terraform-output@v3
  with:
    AZ_TENANT_ID: ${{ vars.AZ_TENANT_ID }}
    AZ_CLIENT_ID: ${{ vars.AZ_CLIENT_ID }}
    AZ_SUBSCRIPTION_ID: ${{ vars.AZ_SUBSCRIPTION_ID }}
    STORAGE_ACCOUNT_RESOURCEGROUP: ${{ vars.STORAGE_ACCOUNT_RESOURCEGROUP }}
    STORAGE_ACCOUNT_NAME: ${{ vars.STORAGE_ACCOUNT_NAME }}
    STORAGE_ACCOUNT_CONTAINER: ${{ vars.STORAGE_ACCOUNT_CONTAINER }}
    STORAGE_BLOB_NAME: azure-${{ inputs.ENVIRONMENT }}.tfstate
    EXPORT_OUTPUTS: TWILIO_ACCOUNT_SID # Exports to GITHUB_ENV

- name: Check Output
  run: |
    echo "Direct Reference: $APP_NAME"
    echo "Export Reference: $ACCOUNT_SID"
  env:
    APP_NAME: ${{ fromJson(steps.tf.outputs.TERRAFORM_OUTPUTS).APP_NAME.value }}
    ACCOUNT_SID: ${{ env.TWILIO_ACCOUNT_SID }}
```

**Outputs**:

- TERRAFORM_OUTPUTS
