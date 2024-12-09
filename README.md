# Zing Actions Helpers v3

This repository is a collection of GitHub [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows) and [Custom Actions](https://docs.github.com/en/actions/sharing-automations/creating-actions/about-custom-actions), used to abstract common tasks in deployment and testing pipelines.

This has been created as a **public** repository so that customer copies of your project repository still have access to run these workflows and actions.

## Usage

>❗**Do not blindly copy and paste pipelines from other projects.**
>
> Ensure you are setting the right inputs for your specific use case. If an input or step is not needed for your use case, then you should remove it.
>
> If you don't understand an input or a step in your pipeline, then you should not commit those pipeline changes until you know their purpose.

### [Reusable Workflows](.github/workflows/)

- [Build Twilio Flex Plugin](.github/workflows/README.md#build-twilio-flex-plugin)
- [Deploy Twilio Flex Plugin](.github/workflows/README.md#deploy-twilio-flex-plugin)
- [Test Twilio Flex Plugin](.github/workflows/README.md#test-twilio-flex-plugin)
- [Build Twilio Functions](.github/workflows/README.md#build-twilio-functions)
- [Deploy Twilio Functions](.github/workflows/README.md#deploy-twilio-functions)
- [Bump Monorepo Version](.github/workflows/README.md#bump-monorepo-version)

### Actions

- Twilio
  - [Get Twilio Resource Sid](./get-twilio-resource-sid/)
  - [Update Taskrouter](./update-taskrouter/)
  - [Update Sync](./update-sync/)
  - [Update Content Templates](./update-content-templates/)
  - [Register Event Stream Webhook](./register-event-stream-webhook/)
  - [Studio Flow Actions](https://github.com/zingdevlimited/studio-flow-actions) (Separate Repository)


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

- Utility
  - [Reset Twilio Account](./reset-twilio-account/) (For Development only)


## Contribution

- [Releasing A New Version](docs/contribution/releasing-new-version.md)
