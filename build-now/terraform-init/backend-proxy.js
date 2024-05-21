const {
  INPUT_PLUGIN_NAME,
  INPUT_TWILIO_API_KEY,
  INPUT_TWILIO_API_SECRET,
  INPUT_SYNC_SERVICE_SID,
  INPUT_SYNC_MAP_NAME,
  INPUT_BACKEND_PROXY_PORT
} = process.env;

const { createServer } = require("http");

const asyncTwilioRequest = async (url, method, body = undefined) => {
  try {
    const headers = {
      "Authorization": "Basic " + Buffer.from(`${INPUT_TWILIO_API_KEY}:${INPUT_TWILIO_API_SECRET}`).toString("base64")
    };

    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = await fetch(url, { method, headers, body });
    const responseBody = await req.json();

    return {
      body: responseBody,
      status: req.status,
      ok: req.status >= 200 && req.status < 300
    };
  } catch (err) {
    return { body: undefined, status: 500, ok: false };
  }
}

const SYNC_MAPS_BASE_URL = `https://sync.twilio.com/v1/Services/${INPUT_SYNC_SERVICE_SID}/Maps`;
const MAP_ITEMS_URL = `${SYNC_MAPS_BASE_URL}/${encodeURIComponent(INPUT_SYNC_MAP_NAME)}/Items`;

const getStateFile = async () => {
  return await asyncTwilioRequest(`${MAP_ITEMS_URL}/${encodeURIComponent(INPUT_PLUGIN_NAME)}`, "GET");
}

const updateStateFile = async (data) => {
  let mapExists = true;
  const mapFetch = await asyncTwilioRequest(
    `${SYNC_MAPS_BASE_URL}/${encodeURIComponent(INPUT_SYNC_MAP_NAME)}`,
    "GET"
  );

  if (mapFetch.status === 404) {
    mapExists = false;
    const mapCreateBody = `UniqueName=${encodeURIComponent(INPUT_SYNC_MAP_NAME)}`;
    await asyncTwilioRequest(SYNC_MAPS_BASE_URL, "POST", mapCreateBody);
  } else if (!mapFetch.ok) {
    return false;
  }

  let mapItemNotFound = false;
  if (mapExists) {
    const mapItemUpdateBody = `Data=${encodeURIComponent(data)}`;
    const mapItemUpdate = await asyncTwilioRequest(
      `${MAP_ITEMS_URL}/${encodeURIComponent(INPUT_PLUGIN_NAME)}`,
      "POST",
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
      MAP_ITEMS_URL,
      "POST",
      mapItemCreateBody
    );
    if (!mapItemCreate.ok) {
      return false;
    }
  }

  return true;
}

const deleteStateFile = async () => {
  const deleteResult = await asyncTwilioRequest(`${MAP_ITEMS_URL}/${encodeURIComponent(INPUT_PLUGIN_NAME)}`, "DELETE");
  if (deleteResult.ok || deleteResult.status === 404) {
    return true;
  } else {
    return false;
  }
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
        
        let isValidJson;
        try {
          const parsed = JSON.parse(data);

          if (parsed && typeof parsed === "object") {
            isValidJson = true;
          } else {
            isValidJson = true;
          }
        } catch (err) {
          isValidJson = false;
        }

        if (!isValidJson) {
          res.writeHead(400);
          res.end("Invalid JSON");
        }

        const updateResult = await updateStateFile(data);

        if (!updateResult) {
          res.writeHead(500);
          res.end("Server Error");
        } else {
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.write(data);
          res.end();
        }
      });
      break;
    case "DELETE":
      const deleteResult = await deleteStateFile();
      
      if (!deleteResult) {
        res.writeHead(500);
        res.end();
      } else {
        res.writeHead(200);
        res.end();
      }
      break;
    default:
      res.writeHead(405);
      res.end();
      break;
  }
});

console.log(`Listening on ${INPUT_BACKEND_PROXY_PORT}...`);
server.listen(INPUT_BACKEND_PROXY_PORT);
