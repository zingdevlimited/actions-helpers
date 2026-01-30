# Reusable Workflows

The list of currently available reusable workflows.
See the `on.workflow_call.inputs` block of the workflow file for inputs.
All directory paths should be from the root of your repository.

- [Reusable Workflows](#reusable-workflows)
  - [Build Twilio Flex Plugin](#build-twilio-flex-plugin)
  - [Deploy Twilio Flex Plugin](#deploy-twilio-flex-plugin)
  - [Test Twilio Flex Plugin](#test-twilio-flex-plugin)
  - [Build Twilio Functions](#build-twilio-functions)
  - [Deploy Twilio Functions](#deploy-twilio-functions)
  - [Bump Monorepo Version](#bump-monorepo-version)
    - [Bump on merged PR](#bump-on-merged-pr)
    - [Bump on workflow dispatch](#bump-on-workflow-dispatch)

## [Build Twilio Flex Plugin](./build-twilio-flex-plugin.yaml)

Build a yarn-based Twilio Flex Plugin and save it to Github Artifacts.

```yaml
jobs:
  build_plugin:
    uses: zingdevlimited/actions-helpers/.github/workflows/build-twilio-flex-plugin.yaml@v4
    with:
      PLUGIN_DIRECTORY: my-plugin
      BUILD_COMMAND: "yarn build:types && yarn build:my-plugin"
```

In the example above:

1. Node will be set up with the version `.engines.node` in `my-plugin/package.json` (or 20 if not found)

2. Yarn install will be ran from the root directory (unless you specify `INSTALL_DIRECTORY`)

3. The build command will be ran from the install directory, root in this example (unless you specify `BUILD_COMMAND_DIRECTORY`).

4. The directory `my-plugin/build` will be checked for the build output

5. The build output will be uploaded as an artifact named `<name>@<version>`, where `name` and `version` are extracted from `my-plugin/package.json`

**Remarks**:

Ensure your build command does **not** require the Flex CLI. (I.e. use `flex-plugin build` instead of `twilio plugins:flex:build`).

## [Deploy Twilio Flex Plugin](./deploy-twilio-flex-plugin.yaml)

Deploy a Twilio Flex Plugin from a build artifact, using the default Twilio plugin service.

```yaml
jobs:
  deploy_plugin:
    uses: zingdevlimited/actions-helpers/.github/workflows/deploy-twilio-flex-plugin.yaml@v4
    with:
      PLUGIN_DIRECTORY: my-plugin
      BUILD_WORKFLOW_NAME: build-my-plugin.yaml
      TWILIO_ACCOUNT_SID: ${{ vars.TWILIO_ACCOUNT_SID }}
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
    secrets:
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

In the example above:

1. From the latest successful `build-my-plugin.yaml` workflow execution, the artifact named `<name>@<version>` will be downloaded. `name` and `version` are extracted from `my-plugin/package.json`. This should contain the plugin bundle file.

2. The Twilio Functions Service named `default` will be checked for the asset `/plugins/<name>/<version>/bundle.js` (under the corresponding Environment for the plugin).
   - **If it already exists and `ALLOW_VERSION_OVERWITE` is false**: Throws an error that the version already exists.
   - **Otherwise**: Uploads the bundle file to this asset path

3. The Flex Plugin `<name>` will be checked for the Plugin Version `<version>`
   - **If it already exists**: Logs a warning and skips this step
   - **Otherwise** Creates a new Plugin Version pointing at the bundle URL deployed to the Twilio Functions Service `default`

**Remarks**:

If you use the `ALLOW_VERSION_OVERWITE` input, it means that the deployed version of a plugin can be overwritten. If this version is in use in the active Plugin Release, then it means that agents will automatically receive any changes if they refresh their page.

## [Test Twilio Flex Plugin](./test-twilio-flex-plugin.yaml)

Run unit tests for a yarn-based Twilio Flex Plugin, using the Flex CLI.

```yaml
jobs:
  test_my_plugin:
    uses: zingdevlimited/actions-helpers/.github/workflows/test-twilio-flex-plugin.yaml@v4
    with:
      PLUGIN_DIRECTORY: my-plugin
      TEST_COMMAND: "yarn build:types && yarn lint:my-plugin && yarn test:my-plugin"
      COVERAGE_LCOV_FILE: ./my-plugin/coverage/lcov.info
```

In the example above:

1. Node will be set up with the version `.engines.node` in `my-plugin/package.json` (or 20 if not found)

2. Yarn install will be ran from the root directory (unless you specify `INSTALL_DIRECTORY`)

3. The test command will be ran from the install directory, root in this example (unless you specify `TEST_COMMAND_DIRECTORY`). As shown above you can also chain dependency builds and lint commands here.

4. If the workflow was triggered by a pull request and `COVERAGE_LCOV_FILE` is specified, then the test coverage output will be added as a pull request comment.

**Remarks**:

Your test command should contain a jest test command. It will not work with the Flex CLI test command.

## [Build Twilio Functions](./build-twilio-functions.yaml)

Build a yarn-based Twilio Functions Service, and save it to Github Artifacts.

```yaml
jobs:
  build_my_api:
    uses: zingdevlimited/actions-helpers/.github/workflows/build-twilio-functions.yaml@v4
    with:
      SERVICE_DIRECTORY: my-api
      BUILD_COMMAND: "yarn build:types && yarn build:my-api"
      INCLUDE_VERSION_ASSET: true
```

In the example above:

1. Node will be set up with the version `.engines.node` in `my-api/package.json` (or 22 if not found)

2. Yarn install will be ran from the root directory (unless you specify `INSTALL_DIRECTORY`)

3. The build command will be ran from the install directory, root in this example (unless you specify `BUILD_COMMAND_DIRECTORY`)

4. The directory `my-api/dist` will be checked for the build output
   - If `INCLUDE_VERSION_ASSET` is **true**, then the `.version` in `my-api/package.json` will be written to `my-api/dist/assets/version.txt`

5. The build output will be **zipped** to `dist.zip` and uploaded as an artifact named `<name>@<version>`, where `name` and `version` are extracted from `my-api/package.json`

**Remarks**:

Ensure your build command does **not** just run `tsc`, but uses `webpack` to correctly bundle the output into Twilio Functions files. Test the command locally to ensure it creates a `dist` folder with only asset and function files.

The artifact will be double zipped (this is to reduce upload API calls and artifact size). Hence, if you download it in a github workflow, you will need to explicitly unzip the contents before you can access the output files.

## [Deploy Twilio Functions](./deploy-twilio-functions.yaml)

Deploy a Twilio Functions Service from a build artifact

```yaml
jobs:
  deploy_my_api:
    uses: zingdevlimited/actions-helpers/.github/workflows/deploy-twilio-functions.yaml@v4
    with:
      SERVICE_DIRECTORY: my-api
      BUILD_WORKFLOW_NAME: build-my-api.yaml
      TWILIO_ACCOUNT_SID: ${{ vars.TWILIO_ACCOUNT_SID }}
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
    secrets:
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}
```

In the example above:

1. Node will be set up with the version `.engines.node` in `my-api/package.json` (or 22 if not found)

2. From the latest successful `build-my-api.yaml` workflow execution, the artifact named `<name>@<version>` will be downloaded. `name` and `version` are extracted from `my-api/package.json`. This should contain a file `dist.zip` containing the assets and functions files.

3. The zip file contents are extracted to `my-api/dist`

4. The package `twilio-run@3.5.3` is called with `npx` and uses your `.twilioserverlessrc` file configuration to deploy the Twilio Functions Service

**Remarks**:

Ensure your `.twilioserverlessrc` file points to the correct output paths. e.g:

```json
{
  "commands": {
    "deploy": {
      "assets": true,
      "assetsFolder": "dist/assets",
      "functions": true,
      "functionsFolder": "dist/functions",
      "overrideExistingProject": true
    },
    (...)
  },
  "runtime": "node22"
}
```

`twilio-run` sets runtime dependencies based on the `.dependencies` in your service `package.json` file so ensure these are correct.

## [Bump Monorepo Version](./bump-monorepo-version.yaml)

Bump package.json file versions in a monorepo, keeping them in sync with the root package.json file. Select the semver bump type (patch/minor/major) based on pull request labels or workflow input.
Will also tag the commit with the new version number.

e.g. if the root package.json file contains:

```json
{
  "name": "my-project",
  "version": "1.0.5",
  (...)
}
```

and the pull request contains a `version-bump:minor` label, then the `.version` field will be set to `1.1.0` in:

- The root package.json file
- All package.json files listed in the `PACKAGE_DIRECTORIES` input

The changes to the package versions will automatically be committed with the tag `v1.1.0`.

### Bypassing Branch Protection with GitHub App

To bypass branch protection rules, you can use a GitHub App for authentication:

1. Create a GitHub App with `contents: write` permissions
2. Install the app on your repository
3. Grant the app exception from branch protection rules in your repository settings
4. Add the app credentials as organisation secrets: `ZING_VERSION_BUMP_APP_ID` and `ZING_VERSION_BUMP_APP_SECRET`

- Either set inherit on the workflow, so the action helper can pull from the organisation / repository secrets.
- Alternatively, pass them directly as secrets to the reusable workflow using the example below:

```yaml
jobs:
  bump_version:
    if: github.event.pull_request.merged == true
    uses: zingdevlimited/actions-helpers/.github/workflows/bump-monorepo-version.yaml@v4
    with:
      PACKAGE_DIRECTORIES: |
        my-plugin
        my-api
      ZING_VERSION_BUMP_APP_ID: HelloAppID
      secrets:
        ZING_VERSION_BUMP_APP_SECRET: ${{ secrets.ZING_VERSION_BUMP_APP_SECRET }}
```

If the input, or the inherit is not specified the workflow will use the default `github.token` instead.

### Bump on merged PR

```yaml
on:
  pull_request_target:
    types:
      - closed

jobs:
  bump_version:
    if: github.event.pull_request.merged == true
    uses: zingdevlimited/actions-helpers/.github/workflows/bump-monorepo-version.yaml@v4
    with:
      PACKAGE_DIRECTORIES: |
        my-plugin
        my-api
```

The example above expects the repository structure:

```txt
├── my-api
│   └── package.json
├── my-plugin
│   └── package.json
└── package.json
```

The size of the version bump will be chosen by checking whether the pull request contains any of the following labels:

- `version-bump:patch`
- `version-bump:minor`
- `version-bump:major`

### Bump on workflow dispatch

```yaml
on:
  workflow_dispatch:
    inputs:
      BUMP_TYPE:
        type: choice
        description: Version Bump Type
        required: true
        options:
          - patch
          - minor
          - major

jobs:
  bump_version_manual:
    if: github.event_name == 'workflow_dispatch'
    uses: zingdevlimited/actions-helpers/.github/workflows/bump-monorepo-version.yaml@v4
    with:
      PACKAGE_DIRECTORIES: |
        my-plugin
        my-api
      BUMP_TYPE: ${{ inputs.BUMP_TYPE }}
```

Like in the previous example, the expected repository structure is:

```txt
├── my-api
│   └── package.json
├── my-plugin
│   └── package.json
└── package.json
```
