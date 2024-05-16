const {
  INPUT_PLUGIN_NAME,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_SYNC_SERVICE_SID,
  INPUT_SYNC_MAP_NAME,
  INPUT_BACKEND_PROXY_PORT
} = process.env;

const { createServer } = require("http");
const { request } = require("https");

const asyncTwilioRequest = async (requestOptions, data = undefined) =>
  new Promise((resolve, reject) => {

    requestOptions.headers = {
      ...requestOptions.headers,
      "Authorization": "Basic " + Buffer.from(`${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`).toString("base64")
    };

    const req = request(requestOptions, (res) => {
      res.setEncoding("utf8");
      let responseBody = "";

      res.on("data", (chunk) => {
        responseBody += chunk;
      });

      res.on("end", () => {
        const statusCode = res.statusCode ?? 500;
        resolve({
          body: JSON.parse(responseBody),
          status: statusCode,
          ok: statusCode >= 200 && statusCode < 300,
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });

const mapBasePath = `/v1/Services/${INPUT_SYNC_SERVICE_SID}/Maps/${encodeURIComponent(INPUT_SYNC_MAP_NAME)}`;

const getStateFile = async () => {
  const getResponse = await asyncTwilioRequest(
    {
      method: "GET",
      hostname: "sync.twilio.com",
      path: `${mapBasePath}/Items/${encodeURIComponent(INPUT_PLUGIN_NAME)}`
    }
  );

  return getResponse;
}

const updateStateFile = async (data) => {
  let mapExists = true;
  const mapFetch = await asyncTwilioRequest(
    {
      method: "GET",
      hostname: "sync.twilio.com",
      path: mapBasePath
    }
  );

  if (mapFetch.status === 404) {
    mapExists = false;
    const mapCreateBody = `UniqueName=${encodeURIComponent(INPUT_SYNC_MAP_NAME)}`;
    await asyncTwilioRequest(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(mapCreateBody)
        },
        hostname: "sync.twilio.com",
        path: `/v1/Services/${INPUT_SYNC_SERVICE_SID}/Maps`
      },
      mapCreateBody
    );
  } else if (!mapFetch.ok) {
    return false;
  }

  let mapItemNotFound = false;
  if (mapExists) {
    const mapItemUpdateBody = `Data=${encodeURIComponent(data)}`;
    const mapItemUpdate = await asyncTwilioRequest(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(mapItemUpdateBody)
        },
        hostname: "sync.twilio.com",
        path: `${mapBasePath}/Items/${INPUT_PLUGIN_NAME}`
      },
      mapItemUpdateBody
    );

    if (mapItemUpdate.status === 404) {
      mapItemNotFound = true;
    } else if (!mapItemUpdate.ok) {
      return false;
    }
  }

  if (!mapExists || mapItemNotFound) {
    const mapItemCreateBody = `Key=${encodeURIComponent(INPUT_PLUGIN_NAME)}&Data=${encodeURIComponent(data)}`;
    const mapItemCreate = await asyncTwilioRequest(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(mapItemCreateBody)
        },
        hostname: "sync.twilio.com",
        path: `${mapBasePath}/Items`
      },
      mapItemCreateBody
    );
    if (!mapItemCreate.ok) {
      return false;
    }
  }

  return true;
}

const server = createServer(async (req, res) => {

  console.log(`${req.method} ${req.url}`);
  console.log(req.headers);
  switch (req.method) {
    case "GET":
      if (req.url === "/ping") {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(200);
        res.write("pong", "utf8");
        res.end();
      } else if (req.url === "/exit") {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(200);
        res.write("Closing server...");
        res.end(undefined, () => server.close());
      } else {
        const stateFileResponse = await getStateFile();

        if (stateFileResponse.ok) {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.write(JSON.stringify(stateFileResponse.body.data));
          res.end();
        } else {
          res.writeHead(stateFileResponse.status);
          res.end();
        }
      }
      break;
    case "POST":
      let data = "";
      req.on("data", chunk => {
        data += chunk;
      });

      req.on("end", async () => {
        data = data.trim();
        const updateResult = await updateStateFile(data);

        if (!updateResult) {
          res.writeHead(500);
          res.end();
        } else {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.write(data);
          res.end();
        }
      });
      break;
  }
});

console.log(`Listening on ${INPUT_BACKEND_PROXY_PORT}...`);
server.listen(INPUT_BACKEND_PROXY_PORT);
