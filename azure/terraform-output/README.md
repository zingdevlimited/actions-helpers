# Terraform Output

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
