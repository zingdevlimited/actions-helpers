# Copilot Flex Recommendations

This composite GitHub Action turns actionable Twilio Flex plugin validator recommendations into GitHub issues.

## How it works

`action.yaml` installs the Copilot SDK and runs `index.mjs`. The script asks Copilot to understand each actionable validator warning, explain the problem and its impact, and provide a practical implementation suggestion in a GitHub issue. Before creating an issue, it verifies that the recommendation came from the validator output and checks open issues so it does not create a duplicate. Results are also added to the GitHub Actions job summary.

## Inputs and environment

The action receives:

- `validation-recommendations`: passed to `index.mjs` as `VALIDATION_RECOMMENDATIONS`.
- `github-token`: passed as `GITHUB_TOKEN`, used by Copilot and the GitHub API.

The script also uses GitHub Actions-provided environment variables: `GITHUB_REPOSITORY`, `GITHUB_SERVER_URL`, `GITHUB_RUN_ID`, and `GITHUB_STEP_SUMMARY`. They identify the repository and workflow run and allow the script to write to the job summary.

## Token permissions

The action uses the automatically provided GitHub Actions token. No personal access token or custom secret is required. The job running the action must grant these permissions:

```yaml
permissions:
	contents: read
	issues: write
	copilot-requests: write
```

Pass the token to the action with:

```yaml
with:
	github-token: ${{ github.token }}
```

`contents: read` supports checkout, `issues: write` allows the action to check for and create issues, and `copilot-requests: write` allows the Copilot SDK to make Copilot requests. The action does not use the token to modify repository contents.

For more information, see GitHub's [Using Copilot CLI in GitHub Actions with GITHUB_TOKEN](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli-in-actions) documentation.

## Where it is called

The Flex plugin build workflow calls this action from [`.github/workflows/build-twilio-flex-plugin.yaml`](../.github/workflows/build-twilio-flex-plugin.yaml) after validation finds recommendations. It passes the validator step output and `${{ github.token }}`.
