# Set teams in Flex

Configures teams in your Twilio Flex account using a JSON config file.

You need to add a configuration file with the following schema:

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/set-flex-teams.json"
}
```

- Note: Teams follow a hierarchy — level 3 is parent to level 2, and level 2 is parent to level 1

To use the action in your pipeline:

```yaml
steps:
  - name: Checkout
    uses: actions/checkout@v4
    with:
      sparse-checkout: teams.json

  - name: Use Set Teams helper
    uses: zingdevlimited/actions-helpers/set-flex-teams@v4
    with:
      OVERWRITE: false # Optional Flag: set to "true" to delete all exisiting teams before recreating
      CONFIG_PATH: ${{ github.workspace }}/teams.json
      TWILIO_API_KEY: ${{ vars.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ secrets.TWILIO_API_SECRET }}

```

## Example Setup

```json
{
  "$schema": "https://raw.githubusercontent.com/zingdevlimited/actions-helpers/v4/.schemas/set-flex-teams.json",
  "teams": [
    {
      "friendlyName": "Operations",
      "description": "Top-level team",
      "level": 3
    },
    {
      "friendlyName": "Support",
      "description": "Support team",
      "level": 2,
      "parentTeam": "Operations"
    },
    {
      "friendlyName": "Sales",
      "description": "Sales team",
      "level": 1,
      "parentTeam": "Support"
    }
  ]
}

```
