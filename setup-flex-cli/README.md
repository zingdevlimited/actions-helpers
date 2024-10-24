# Setup Flex CLI

> ⚠️ The Twilio Flex CLI installation is unpredicatble in CI and should be avoided where possible.

Install the Twilio CLI with the Flex CLI to the current job. The version is selected from the version of `@twilio/flex-plugin-scripts` in your plugin package.json file.

Ensure you run `setup-node` in a previous step.

```yaml
steps:
  (...)

  - name: Set up Node 18
    uses: actions/setup-node@v4
    with:
      node-version: 18.x
      cache: yarn
      cache-dependency-path: yarn.lock

  - name: Setup Flex CLI
    uses: zingdevlimited/actions-helpers/setup-flex-cli@v3
    with:
      PLUGIN_DIRECTORY: my-plugin
```
