const appendFileSync = require("fs").appendFileSync;

/**
 * @typedef response
 * @property {object} body
 * @property {number} status
 * @property {boolean} ok
 * 
 * @param {string} url 
 * @param {"GET" | "POST" | "DELETE"} method 
 * @param {URLSearchParams} bodyParams 
 * @param {number} retryNumber 
 * @returns {Promise<response>}
 */
const asyncTwilioRequest = async (url, method, bodyParams = undefined, retryNumber = 0) => {
  try {
    console.log(`::debug::Request: ${method} ${url}`);
    const headers = {
      "Authorization": "Basic " + Buffer.from(`${TWILIO_API_KEY}:${TWILIO_API_SECRET}`).toString("base64")
    };
    
    let body = undefined;
    if (bodyParams) {
      const undefinedParams = [];
      for (const [key, value] of bodyParams.entries()) {
        if (value === "undefined") {
          undefinedParams.push(key);
        }
      }
      for (const key of undefinedParams) {
        bodyParams.delete(key);
      }
      body = bodyParams.toString();
    }

    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = await fetch(url, { method, headers, body });

    if (req.status === 429) {
      if (retryNumber >= MAX_RETRY_COUNT) {
        throw new Error("Exceeded retry attempts after 429 errors");
      }
      const retryDelay = BASE_DELAY_MS * (2 ** retryNumber);
      console.log(`::debug::Rate-limit hit, retrying in ${retryDelay} ms...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return asyncTwilioRequest(url, method, bodyParams, retryNumber + 1);
    }

    console.log(`::debug::Status: ${req.status} ${req.statusText}`);

    const ok = req.status >= 200 && req.status < 300;
    if (!ok) {
      throw new Error(`Error Response: ${await req.text()}`);
    }

    let responseBody;
    if (req.headers.get("Content-Type")?.startsWith("application/json") && req.status !== 204) {
      responseBody = await req.json();
    } else {
      responseBody = {};
    }

    return {
      body: responseBody,
      status: req.status,
      ok
    };
  } catch (err) {
    throw err;
    // return { body: undefined, status: 500, ok: false };
  }
}

const checkInputs = (...inputs) => {
  let missing = false
  /** @type {Object.<string, string>} */
  const output = {}

  for (const input of inputs) {
    if (!process.env[`INPUT_${input}`]?.trim()) {
      console.error(`::error::Missing input ${input}`);
      missing = true;
    } else {
      output[input] = process.env[`INPUT_${input}`].trim();
    }
  }

  if (missing) {
    process.exit(1);
  }

  return output;
}

const {
  SINK_WEBHOOK_URL,
  SINK_DESCRIPTION,
  SINK_WEBHOOK_METHOD,
  SINK_BATCH_EVENTS,
  SUBSCRIPTION_DESCRIPTION,
  EVENT_TYPES,
  TWILIO_API_KEY,
  TWILIO_API_SECRET
} = checkInputs(
  "SINK_WEBHOOK_URL",
  "SINK_DESCRIPTION",
  "SINK_WEBHOOK_METHOD",
  "SINK_BATCH_EVENTS",
  "SUBSCRIPTION_DESCRIPTION",
  "EVENT_TYPES",
  "TWILIO_API_KEY",
  "TWILIO_API_SECRET"
);

const eventTypes = EVENT_TYPES.split("\n")
  .map((line) => line.split("="))
  .filter((lineParts) => lineParts.length === 2)
  .map(([type, version]) => ({ type: type.trim(), schema_version: Number.parseInt(version.trim()) }));

const eventsUrl = "https://events.twilio.com/v1";

const run = async () => {
  const sinkListResponse = await asyncTwilioRequest(`${eventsUrl}/Sinks`, "GET");
  /** @type {array} */
  const sinkList = sinkListResponse.body.sinks;

  let currentSink;

  const existing = sinkList.find((s) => s.sink_configuration?.destination === SINK_WEBHOOK_URL);

  if (existing) {
    currentSink = existing;
  } else {
    const sinkCreateResponse = await asyncTwilioRequest(
      `${eventsUrl}/Sinks`,
      "POST",
      new URLSearchParams({
        Description: SINK_DESCRIPTION,
        SinkType: "webhook",
        SinkConfiguration: JSON.stringify({
          destination: SINK_WEBHOOK_URL,
          method: SINK_WEBHOOK_METHOD,
          batch_events: SINK_BATCH_EVENTS === "true"
        })
      })
    );
    
    console.log(`Created Event Sink '${SINK_DESCRIPTION}': ${SINK_WEBHOOK_METHOD} ${SINK_WEBHOOK_URL}`);
    currentSink = sinkCreateResponse.body;
  }

  const subscriptionListResponse = await asyncTwilioRequest(`${eventsUrl}/Subscriptions?SinkSid=${currentSink.sid}`, "GET");
  
  /** @type {array} */
  const subscriptionList = subscriptionListResponse.body.subscriptions;

  let currentSubscription;

  if (subscriptionList.length) {
    currentSubscription = subscriptionList[0];

    const subscriptionUrl = `${eventsUrl}/Subscriptions/${currentSubscription.sid}`;

    const subscribedEventsResponse = await asyncTwilioRequest(
      `${subscriptionUrl}/SubscribedEvents`,
      "GET"
    );
    /** @type {array} */
    const subscribedEventTypes = subscribedEventsResponse.body.types;

    const eventsToAdd = eventTypes.filter((e) =>
      !subscribedEventTypes.some((s) => e.type === s.type)
    ).map(async (e) => {
      await asyncTwilioRequest(
        `${subscriptionUrl}/SubscribedEvents`,
        "POST",
        new URLSearchParams({ Type: e.type, SchemaVersion: e.schema_version })
      );
      console.log(`Added Event to Subscription '${SUBSCRIPTION_DESCRIPTION}': ${e.type}/v${e.schema_version}`);
    });

    const eventsToUpdate = eventTypes.filter((e) => {
      const existing = subscribedEventTypes.find((s) => e.type === s.type);
      return existing && existing.schema_version !== e.schema_version
    }).map(async (e) => {
      const existing = subscribedEventTypes.find((s) => e.type === s.type);
      await asyncTwilioRequest(
        `${subscriptionUrl}/SubscribedEvents/${e.type}`,
        "POST",
        new URLSearchParams({ SchemaVersion: e.schema_version })
      );
      console.log(`Updated Event in Subscription '${SUBSCRIPTION_DESCRIPTION}': ${e.type} - v${existing.schema_version} -> v${e.schema_version}`);
    });

    const eventsToDelete = subscribedEventTypes.filter((s) =>
      !eventTypes.some((e) => s.type === e.type)
    ).map(async (s) => {
      await asyncTwilioRequest(
        `${subscriptionUrl}/SubscribedEvents/${s.type}`,
        "DELETE"
      );
      console.log(`Deleted Event from Subscription '${SUBSCRIPTION_DESCRIPTION}': ${s.type}`);
    });

    await Promise.all(eventsToAdd);
    await Promise.all(eventsToUpdate);
    await Promise.all(eventsToDelete);

  } else {
    const params = new URLSearchParams({
      Description: SUBSCRIPTION_DESCRIPTION,
      SinkSid: currentSink.sid
    });
    for (const eventType of eventTypes) {
      params.append("Types", JSON.stringify(eventType));
    }

    const subscriptionCreateResponse = await asyncTwilioRequest(
      `${eventsUrl}/Subscriptions`,
      "POST",
      params
    );

    console.log(`Created Subscription '${SUBSCRIPTION_DESCRIPTION}' with events ${eventTypes.map((e) => e.type)}`);

    currentSubscription = subscriptionCreateResponse.body;
  }

  const { GITHUB_OUTPUT } = process.env;

  if (GITHUB_OUTPUT) {
    appendFileSync(GITHUB_OUTPUT, `SINK_SID=${currentSink.sid}\n`, "utf8");
    appendFileSync(GITHUB_OUTPUT, `SUBSCRIPTION_SID=${currentSubscription.sid}\n`, "utf8");
  }
}

run();