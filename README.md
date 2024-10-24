# Zing Actions Helpers v3

This repository is a collection of GitHub [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows) and [Composite Actions](https://docs.github.com/en/actions/creating-actions/creating-a-composite-action), used to abstract common tasks in deployment and testing pipelines.

This has been created as a **public** repository so that customer copies of your project repository still have access to run these workflows and actions.

## Usage

>❗**Do not blindly copy and paste pipelines from other projects.**
>
> Ensure you are setting the right inputs for your specific use case. If an input or step is not needed for your use case, then you should remove it.
>
> If you don't understand an input or a step in your pipeline, then you should not commit those pipeline changes until you know their purpose.

### [Reusable Workflows](docs/usage/reusable-workflows.md)

- [Build Twilio Flex Plugin](docs/usage/reusable-workflows.md#build-twilio-flex-plugin)
- [Deploy Twilio Flex Plugin](docs/usage/reusable-workflows.md#deploy-twilio-flex-plugin)
- [Test Twilio Flex Plugin](docs/usage/reusable-workflows.md#test-twilio-flex-plugin)
- [Build Twilio Functions](docs/usage/reusable-workflows.md#build-twilio-functions)
- [Deploy Twilio Functions](docs/usage/reusable-workflows.md#deploy-twilio-functions)
- [Bump Monorepo Version](docs/usage/reusable-workflows.md#bump-monorepo-version)

### Actions

- Twilio
  - [Get Twilio Resource Sid](./get-twilio-resource-sid/)
  - [Update Taskrouter](./update-taskrouter/)
  - [Update Sync](./update-sync/)
  - [Register Event Stream Webhook](./register-event-stream-webhook/)

- Twilio Functions
  - [Get Twilio Functions Service](./get-twilio-functions-service/)
  - [Update Twilio Functions Variables](./update-twilio-functions-variables/)

- Twilio Flex
  - [Update Flex Config](./update-flex-config/)
  - [Update Flex Skills](./update-flex-skills/)
  - [Setup Flex CLI](./setup-flex-cli/)
  - [Deploy Flex Plugin Asset](./deploy-flex-plugin-asset/)
  - [Create Flex Plugin Version](./create-flex-plugin-version/)
  
- Azure
  - [Format App Settings](./azure/format-app-settings/)
  - [Terraform Output](./azure/terraform-output/)

*Deprecated*:

- [Update Studio Flows](docs/usage/deprecated/details-studio-flow.md)

## Contribution

- [Releasing A New Version](docs/contribution/releasing-new-version.md)
