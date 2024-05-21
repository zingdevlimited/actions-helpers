# Composite Actions (Build Now)

- [Composite Actions (Build Now)](#composite-actions-build-now)
  - [Add Read Only Permission to Sync Object](#add-read-only-permission-to-sync-object)
  - [Terraform Init with Twilio Backend](#terraform-init-with-twilio-backend)
  - [Terraform Output with Twilio Backend](#terraform-output-with-twilio-backend)

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

Initialize Terraform with Twilio Sync as a backend. The Terraform State file is stored in a Sync Map, where every Build Now plugin has its own key.

>❗Due to the limitations of this backend only use it for storing Twilio configuration. The state file must not exceed **16 KiB**

Ensure your backend block is configured as an empty http block:

```terraform
terraform {
  required_providers {}
  backend "http" {}
}
```

```yaml
steps:
  (...)

  - name: Terraform Init
    uses: zingdevlimited/actions-helpers/build-now/terraform-init@v3
    with:
      PLUGIN_NAME: build-now-my-plugin
      TERRAFORM_DIRECTORY: terraform
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
```

This will start a server on `http://localhost:9464` that terraform will interact with for CRUD operations with Sync. The Default Sync Service is used with a Sync Map named `build-now-state-manager-files`. You can override these defaults with the inputs `SYNC_SERVICE_SID`, `SYNC_MAP_NAME`, and `BACKEND_PROXY_PORT`.

## [Terraform Output with Twilio Backend](../../build-now/terraform-output/action.yaml)

Get the Outputs from the Terraform State file stored in Twilio Sync. The Default Sync Service is used with a Sync Map named `build-now-state-manager-files`. You can override these defaults with the inputs `SYNC_SERVICE_SID`, and `SYNC_MAP_NAME`.

```yaml
steps:
  (...)

  - name: Terraform Output
    id: tfOutput
    uses: zingdevlimited/actions-helpers/build-now/terraform-output@v3
    with:
      PLUGIN_NAME: build-now-my-plugin
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      EXPORT_OUTPUTS: VOICE_WORKFLOW_SID # Export to env

  - name: Check Voice Workflow Sid (Directly)
    run: echo "${{ fromJson(steps.tfOutput.outputs.TERRAFORM_OUTPUTS).VOICE_WORKFLOW_SID.value }}"

  - name: Check Voice Workflow Sid (Via env)
    run: echo "${{ env.VOICE_WORKFLOW_SID }}"
```

**Outputs**:

- TERRAFORM_OUTPUTS
