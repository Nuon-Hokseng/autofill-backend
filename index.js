require("dotenv").config();
const express = require("express");
const axios = require("axios");
const http = require("http");
const https = require("https");
const cors = require("cors");
const pee= "Helloworld";
const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Reuse keep-alive agents and set sane defaults
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

const api = axios.create({
  timeout: parseInt(process.env.UPSTREAM_TIMEOUT_MS || "15000", 10), // 15s default
  httpAgent,
  httpsAgent,
});

async function generateAutofillData() {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    GEMINI_API_KEY;

  const prompt = `
Generate a realistic dummy user in JSON. Return ONLY JSON, no explanations.

Fields:
{
  "firstname": "first name", make it universeal from different nationalities, and very unique
  "middlename": "middle name",
  "lastname": "last name",
  "fullname": "first middle last", make it universeal from different nationalities, and very unique
  "username": "8-12 chars, lowercase, numbers allowed",
  "email": "valid email" make it realistic with @gmail/yahoo/outlook and domain name matching the username,
  "password": "12-16 chars, mix letters/numbers/symbols, not 'password'", also maximize the securities by making is atleast 15 cha, with mixed character,
  "gender": "1 for female, 2 for male, 0 ",
  "dob": "DD-MM-YYYY, age 18-60",
  "age": "calculated from dob",
  "birthplace": "city, country",
  "company": "company name",
  "position": "job title",
  "address1": "street address",
  "address2": "apt/suite or empty",
  "city": "city name",
  "state": "state/province",
  "zipcode": "5-digit",
  "postalcode": "same as zipcode",
  "country": "country name",
  "homephone": "include country code, e.g. +855 for Cambodia",
  "cellphone": "same format", make it with the required length in each country for example US is 10 digits after country code and UK is 9 digits after country code,
  "website": "personal website URL",
}

Make names, addresses, and phone numbers international. Use diverse nationalities and mix all asian and europe. Generate data directly in JSON format.
`;

  try {
    const response = await api.post(url, {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
    });

    const raw = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!raw) return null;

    return JSON.parse(raw);
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    const isTimeout = err.code === "ECONNABORTED";
    console.error(
      "❌ Gemini API error:",
      isTimeout ? "Upstream timeout" : status || err.code || err.message,
      data || ""
    );
    return null;
  }
}

// Route-level timeout safeguard
const ROUTE_TIMEOUT_MS = parseInt(process.env.ROUTE_TIMEOUT_MS || "60000", 10); // 20s default

app.post("/generate", async (req, res) => {
  // Close connection if route exceeds timeout
  const routeTimer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: "Backend request timed out" });
    }
  }, ROUTE_TIMEOUT_MS);

  const result = await generateAutofillData();

  if (!result) {
    clearTimeout(routeTimer);
    return res.status(502).json({ error: "Failed to generate data" });
  }

  clearTimeout(routeTimer);
  res.json({
    output: result,
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log("🔥 Server started on port " + PORT);
});

// Server socket timeout (affects idle sockets)
server.setTimeout(
  parseInt(process.env.SERVER_SOCKET_TIMEOUT_MS || "30000", 10)
); // 30s default

// Graceful shutdown on termination signals
function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    httpAgent.destroy();
    httpsAgent.destroy();
    console.log("Server closed. Bye!");
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
