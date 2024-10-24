# Update Flex Skills

Update Twilio Flex Agent Skills by updating the Flex Configuration object. By default it will merge with existing skills on the account, but you can set the **MODE** input variable to `replace`.

## Simple Skills

You can provide just a list of skill names (newline-separated).

```yaml
steps:

  - name: Update Flex Skills
    uses: zingdevlimited/actions-helpers/update-flex-skills@v3
    with:
      TWILIO_ACCOUNT_SID: ${{ env.TWILIO_ACCOUNT_SID }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      SIMPLE_SKILLS: |
        sales
        support
        billing
```

## Complex Skills

If you want skill levels you need to provide a JSON array.

```yaml
steps:

  - name: Update Flex Skills
    uses: zingdevlimited/actions-helpers/update-flex-skills@v3
    with:
      TWILIO_ACCOUNT_SID: ${{ env.TWILIO_ACCOUNT_SID }}
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      COMPLEX_SKILLS: |
        [
          {"name": "sales", "multivalue": true, "minimum": 1, "maximum": 5},
          {"name": "billing", "multivalue": false, "minimum": null, "maximum": null}
        ]
```
