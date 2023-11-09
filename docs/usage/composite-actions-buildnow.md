# Composite Actions (Build Now)

- [Composite Actions (Build Now)](#composite-actions-build-now)
  - [Add Read Only Permission to Sync Object](#add-read-only-permission-to-sync-object)
  - [Terraform Init with Twilio Backend](#terraform-init-with-twilio-backend)
  - [Terraform Output with Twilio Backend](#terraform-output-with-twilio-backend)
    - [Skip Init](#skip-init)

## [Add Read Only Permission to Sync Object](../../build-now/add-readonly-perm-sync/action.yaml)

Use to add a permission with identity `READ_ONLY` to a Sync Document/List/Map. This identity can then be used to grant Sync clients read-only access to this object.

```yaml
steps:
  (...)

  - name: Update Sync Permission for teams List
    uses: zingdevlimited/actions-helpers/build-now/add-readonly-perm-sync@v3
    with:
      SYNC_SERVICE_SID: default
      OBJECT_TYPE: Lists
      OBJECT_SID: teams
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

Note that the `OBJECT_TYPE` must be set to **Documents**, **Lists**, or **Maps**.

## [Terraform Init with Twilio Backend](../../build-now/terraform-init/action.yaml)

Initialize Terraform with the build-now-core-api HTTP backend. This backend stores the Terraform State file in a Twilio Sync Map, where every Build Now plugin has its own key.

```yaml
steps:
  (...)

  - name: Terraform Init
    uses: zingdevlimited/actions-helpers/build-now/terraform-init@v3
    with:
      PLUGIN_NAME: build-now-my-plugin
      TERRAFORM_DIRECTORY: terraform
      TERRAFORM_BASIC_USERNAME: ${{ secrets.TERRAFORM_BASIC_USERNAME }}
      TERRAFORM_BASIC_PASSWORD: ${{ secrets.TERRAFORM_BASIC_PASSWORD }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

The `TERRAFORM_BASIC_USERNAME` and `TERRAFORM_BASIC_PASSWORD` are used to access the endpoint **/terraform-crud** in build-now-core-api. Therefore, these need to match the values you set to you deploy build-now-core-api.

## [Terraform Output with Twilio Backend](../../build-now/terraform-output/action.yaml)

Get the Outputs from the Terraform State file stored in Twilio Sync.

```yaml
steps:
  (...)

  - name: Terraform Output
    id: tfOutput
    uses: zingdevlimited/actions-helpers/build-now/terraform-output@v3
    with:
      PLUGIN_NAME: build-now-my-plugin
      TERRAFORM_DIRECTORY: terraform
      TERRAFORM_BASIC_USERNAME: ${{ secrets.TERRAFORM_BASIC_USERNAME }}
      TERRAFORM_BASIC_PASSWORD: ${{ secrets.TERRAFORM_BASIC_PASSWORD }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      EXPORT_OUTPUTS: VOICE_WORKFLOW_SID # Export to env

  - name: Check Voice Workflow Sid (Directly)
    run: echo "${{ fromJson(steps.tfOutput.outputs.TERRAFORM_OUTPUTS).VOICE_WORKFLOW_SID.value }}"

  - name: Check Voice Workflow Sid (Via env)
    run: echo "${{ env.VOICE_WORKFLOW_SID }}"
```

### Skip Init

If you have already run terraform init in the current job, then you can skip initialization. In this case you are only required to pass in `TERRAFORM_DIRECTORY`:

```yaml
steps:
  (...)

  - name: Terraform Output
    id: tfOutput
    uses: zingdevlimited/actions-helpers/build-now/terraform-output@v3
    with:
      TERRAFORM_DIRECTORY: terraform
      SKIP_INIT: true
      EXPORT_OUTPUTS: VOICE_WORKFLOW_SID # Export to env
```

**Outputs**:

- TERRAFORM_OUTPUTS
