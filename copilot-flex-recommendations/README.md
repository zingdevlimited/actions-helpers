# Copilot Flex Recommendations

This composite GitHub Action turns actionable Twilio Flex plugin validator recommendations into GitHub issues.

## How it works

`action.yaml` installs the Copilot SDK and runs `index.mjs`. The script asks Copilot to understand each actionable validator warning, explain the problem and its impact, and provide a practical implementation suggestion in a GitHub issue. Before creating an issue, it verifies that the recommendation came from the validator output and checks open issues so it does not create a duplicate. Results are also added to the GitHub Actions job summary.

## Inputs and environment

The action receives:

- `validation-recommendations`: passed to `index.mjs` as `VALIDATION_RECOMMENDATIONS`.
- `github-token`: passed as `GITHUB_TOKEN`, used by Copilot and the GitHub API.

The script also uses GitHub Actions-provided environment variables: `GITHUB_REPOSITORY`, `GITHUB_SERVER_URL`, `GITHUB_RUN_ID`, and `GITHUB_STEP_SUMMARY`. They identify the repository and workflow run and allow the script to write to the job summary.

## Where it is called

The Flex plugin build workflow calls this action from [`.github/workflows/build-twilio-flex-plugin.yaml`](../.github/workflows/build-twilio-flex-plugin.yaml) after validation finds recommendations. It passes the validator step output and `${{ secrets.GITHUB_TOKEN }}`.
