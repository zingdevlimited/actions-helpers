# Zing Actions Helpers v3

This repository is a collection of GitHub [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows) and [Composite Actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action), used to abstract common tasks in deployment and testing pipelines.

This has been created as a **public** repository so that customer copies of your project repository still have access to run these workflows and actions.

## Usage

>❗**Do not blindly copy and paste pipelines from other projects.**
>
> Ensure you are setting the right inputs for your specific use case. If an input or step is not needed for your use case, then you should remove it.
>
> If you don't understand an input or a step in your pipeline, then you should not commit those pipeline changes until you know their purpose.

- [Reusable Workflows](docs/usage/reusable-workflows.md)
  - [Build Twilio Flex Plugin](docs/usage/reusable-workflows.md#build-twilio-flex-plugin)
  - [Deploy Twilio Flex Plugin](docs/usage/reusable-workflows.md#deploy-twilio-flex-plugin)
  - [Test Twilio Flex Plugin](docs/usage/reusable-workflows.md#test-twilio-flex-plugin)
  - [Build Twilio Functions](docs/usage/reusable-workflows.md#build-twilio-functions)
  - [Deploy Twilio Functions](docs/usage/reusable-workflows.md#deploy-twilio-functions)
  - [Bump Monorepo Version](docs/usage/reusable-workflows.md#bump-monorepo-version)

- Actions
  - [General](docs/usage/composite-actions-general.md)
    - [Get Twilio Functions Service](docs/usage/composite-actions-general.md#get-twilio-functions-service)
    - [Get Twilio Resource Sid](docs/usage/composite-actions-general.md#get-twilio-resource-sid)
    - [Update Twilio Functions Variables](docs/usage/composite-actions-general.md#update-twilio-functions-variables)
    - [Update Taskrouter](docs/usage/composite-actions-general.md#update-taskrouter)
    - [Update Flex Config](docs/usage/composite-actions-general.md#update-flex-config)
    - [Update Flex Skills](docs/usage/composite-actions-general.md#update-flex-skills)
    - [Setup Flex CLI](docs/usage/composite-actions-general.md#setup-flex-cli)
    - [Deploy Flex Plugin Asset](docs/usage/composite-actions-general.md#deploy-flex-plugin-asset)
    - [Create Flex Plugin Version](docs/usage/composite-actions-general.md#create-flex-plugin-version)
    - [Register Event Stream Webhook](docs/usage/composite-actions-general.md#register-event-stream-webhook)
  - [Build Now](docs/usage/composite-actions-buildnow.md)
    - [Add Read Only Permission to Sync Object](docs/usage/composite-actions-buildnow.md#add-read-only-permission-to-sync-object)
    - [Terraform Init with Twilio Backend](docs/usage/composite-actions-buildnow.md#terraform-init-with-twilio-backend)
    - [Terraform Output with Twilio Backend](docs/usage/composite-actions-buildnow.md#terraform-output-with-twilio-backend)
  - [Azure](docs/usage/composite-actions-azure.md)
    - [Format App Settings](docs/usage/composite-actions-azure.md#format-app-settings)
    - [Terraform Output](docs/usage/composite-actions-azure.md#format-app-settings)

*Deprecated*:

- [Update Studio Flows](docs/usage/deprecated/details-studio-flow.md)

## Contribution

- [Releasing A New Version](docs/contribution/releasing-new-version.md)
