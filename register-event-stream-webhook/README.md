# Register Event Stream Webhook

Register a Twilio Event Stream Webhook Sink along with an Event Subscription. The Sink resource is only created if an existing Sink with the same webhook destination URL does not exist. The Event Subscription will be updated based on the [Event Types](https://www.twilio.com/docs/events/event-types-list) provided.

The **EVENT_TYPES** parameter needs to be provided as newline-separated `<Event>=<Schema Version>` pairs:

```yaml
steps:
  (...)

  - name: Register Call Completed Webhook
    uses: zingdevlimited/actions-helpers/register-event-stream-webhook@v4
    with:
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      SINK_WEBHOOK_URL: "https://yourapibase-1234.twil.io/callback/call-completed"
      SINB_WEBHOOK_METHOD: POST
      SINK_DESCRIPTION: "Create Call Completed Record"
      SINK_BATCH_EVENTS: false
      SUBSCRIPTION_DESCRIPION: "Call Complete Subscription"
      EVENT_TYPES: |
        com.twilio.voice.status-callback.call.completed=1

  - name: Register Task Events Webhook
    uses: zingdevlimited/actions-helpers/register-event-stream-webhook@v4
    with:
      TWILIO_API_KEY: ${{ env.TWILIO_API_KEY }}
      TWILIO_API_SECRET: ${{ env.TWILIO_API_SECRET }}
      SINK_WEBHOOK_URL: "https://yourapibase-1234.twil.io/callback/task-events"
      SINB_WEBHOOK_METHOD: POST
      SINK_DESCRIPTION: "Process Task Events"
      SINK_BATCH_EVENTS: false
      SUBSCRIPTION_DESCRIPION: "Task Events Subscription"
      EVENT_TYPES: |
        com.twilio.taskrouter.task.canceled=3
        com.twilio.taskrouter.task.updated=3
        com.twilio.taskrouter.task.wrapup=3
```

**Outputs:**

- SINK_SID
- SUBSCRIPTION_SID
