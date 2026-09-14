---
name: zing-action-helpers
description: Help users use the reusable GitHub Actions in this repository for Twilio, Flex, Functions, Sync, TaskRouter, Studio, and Azure deployments, including YAML workflow examples.
---

# Zing Action Helpers

Use this skill only when a user asks how to use an existing action from `zingdevlimited/actions-helpers`.

## Scope

This is a usage skill. Do not design new actions, review action implementations or workflows, edit action documentation, or propose repository-wide changes. For those requests, state that they are outside this skill's scope and return to explaining how to use an existing documented action.

## Repository model

This repository contains versioned custom GitHub Actions. The action implementation and input contract live in `action.yaml`; the action README contains examples, outputs, configuration schemas, and important side effects. Read both before proposing a workflow change.

The public actions are consumed with the repository version in the `uses` value:

```yaml
uses: zingdevlimited/actions-helpers/<action-path>@v4
```

Do not invent input names, outputs, defaults, or permissions. Prefer the checked-in `action.yaml` over memory or examples from another repository.

## Evidence and no-invention rules

- Treat the repository files as the only authoritative source for action names, paths, versions, inputs, outputs, defaults, runtimes, permissions, and side effects.
- Before making a concrete claim about an action, inspect its `action.yaml` and README. Inspect a schema under `.schemas/` when the action accepts structured JSON.
- Do not fill gaps from general GitHub Actions or Twilio knowledge. If the repository does not document the requested behavior, say that it is undocumented and do not present a guess as fact.
- Keep documented facts separate from recommendations. Mark assumptions and placeholders clearly, and ask for missing values when they affect correctness or safety.
- Re-check conflicting examples against the closest action metadata. Prefer the selected action's current README and `action.yaml` over the root README, old examples, or memory.
- Never claim that a workflow was tested, a deployment succeeded, or a remote resource exists unless an actual validation or tool result proves it.

## Action catalog

### Twilio

- `get-twilio-resource-sid`: find a resource SID by API area, resource type, and optional field/value match.
- `get-twilio-functions-service`: find or use a Twilio Functions service.
- `update-taskrouter`: configure TaskRouter resources from a JSON file.
- `update-sync`: create Sync documents, lists, maps, and streams from a JSON configuration.
- `update-content-templates`: update Flex content templates.
- `register-event-stream-webhook`: register a Twilio Event Streams webhook.
- `reset-twilio-account`: remove development resources from a Twilio account; treat this as destructive.

### Twilio Functions

- `update-twilio-functions-variables`: update Twilio Functions environment variables.
- `deploy-assets`: deploy Twilio Functions assets.

### Twilio Flex

- `update-flex-config`: overwrite one subsection under Flex Configuration `.ui_attributes`.
- `update-flex-skills`: update Flex worker skills.
- `set-flex-teams`: configure Flex teams.
- `setup-flex-cli`: install and configure the Flex CLI.
- `deploy-flex-plugin-asset`: deploy a Flex plugin asset.
- `create-flex-plugin-version`: create a Flex plugin version.
- `release-flex-plugin-versions`: release Flex plugin versions.
- `install-library-flex-plugin`: install a library Flex plugin.
- `copilot-flex-recommendations`: turn actionable Flex validator recommendations into GitHub issues.

### Azure and utility actions

- `azure/format-app-settings`: format environment-style values for Azure App Settings, optionally encrypting the result.
- `azure/terraform-init`: initialize Terraform for Azure workflows.
- `azure/terraform-output`: expose Terraform output for later workflow steps.

## Working procedure

1. Translate the request into a concrete deployment operation and target service.
2. Select the narrowest action from the catalog. If the request spans provisioning and deployment, separate those steps rather than hiding them in one opaque command.
3. Read the selected action's `action.yaml` and README. For JSON-backed actions, also inspect the matching schema under `.schemas/`.
4. Check required inputs, output names, runtime type, and whether the action creates, updates, or deletes remote resources.
5. Write a minimal workflow step using the repository's exact input casing and the pinned repository version.
6. Pass Twilio credentials from GitHub Actions secrets or environment values. Never hard-code, echo, or include credentials in logs, examples, issue comments, or generated files.
7. Check job permissions and prerequisites such as checkout, a configuration file, a service SID, or a CLI setup step.
8. Validate the workflow YAML and any JSON configuration. Explain the expected outputs and any non-obvious side effects.

When the user asks how to use an action, include a minimal GitHub Actions `.yml` example in the response. Use the exact action path and input names verified from the repository. Include placeholders for user-specific values and secrets rather than inventing real names or credentials. If the request is ambiguous, provide the safest documented baseline example and identify the value that must be confirmed.

## Safety and behavior rules

- Preserve existing workflow behavior unless the request explicitly requires a change.
- Follow the repository README warning: do not blindly copy a pipeline; remove inputs and steps that do not apply.
- Treat `reset-twilio-account` and any resource-creation action as high risk. Require an explicit target account and confirm destructive or create-only behavior before suggesting it.
- For `update-flex-config`, state clearly that only the selected `.ui_attributes` subsection is replaced and the remaining configuration is preserved.
- For `update-sync`, note that missing resources are created by unique name and existing resources are not updated; verify the JSON schema before use.
- Use action outputs by their declared names, such as `SID` or `SYNC_SERVICE_SID`, rather than parsing logs.
- Keep the workflow example scoped to the user's task. Do not add unrelated actions, permissions, or secrets.
- Do not silently upgrade or downgrade an action version. If repository documentation disagrees about a version, call out the conflict and use the selected action's current documentation only when it is unambiguous.

## Response template

When explaining how to use an action, structure the response as:

1. **Action and reason**: name the selected action and why it matches the operation.
2. **Prerequisites**: list required secrets, files, permissions, and preceding steps.
3. **Workflow snippet**: provide the smallest valid YAML example with exact inputs.
4. **Outputs and effects**: identify outputs and any remote changes or creation behavior.
5. **Validation**: state how to validate the YAML/configuration and what to check in the workflow run.

If no existing action matches, say so explicitly. Do not design or suggest a new action, and do not imply that an existing action supports an operation that its metadata and README do not document.