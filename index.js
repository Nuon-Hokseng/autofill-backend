require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function generateAutofillData() {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    GEMINI_API_KEY;

  const prompt = `
Generate a realistic dummy user in JSON. Return ONLY JSON, no explanations.

Fields:
{
  "title": "Mr/Mrs/Ms/Dr",
  "firstname": "first name",
  "middlename": "middle name",
  "middleinitial": "middle initial",
  "lastname": "last name",
  "fullname": "first middle last",
  "username": "8-12 chars, lowercase, numbers allowed",
  "email": "valid email",
  "password": "12-16 chars, mix letters/numbers/symbols, not 'password'",
  "gender": "1 for female, 2 for male",
  "dob": "DD-MM-YYYY, age 18-60",
  "age": "calculated from dob",
  "birthplace": "city, country",
  "ssn": "XXX-XX-XXXX",
  "driverslicense": "realistic format",
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
  "workphone": "same format",
  "fax": "same format",
  "cellphone": "same format",
  "website": "personal website URL",
  "userid": "unique ID, can match username",
  "creditcardtype": "Visa/Master/Amex",
  "creditcardnumber": "16 digits",
  "cardverificationcode": "3 digits",
  "cardexpiration": "MM/YY",
  "cardusername": "name on card",
  "cardissuingbank": "bank name",
  "cardcustomerservicephone": "valid format",
  "income": "annual amount",
  "custommessage": "short message",
  "comments": "optional note"
}

Make names, addresses, and phone numbers international. Use diverse nationalities and mix all asian and europe. Generate data directly in JSON format.
`;

  try {
    const response = await axios.post(url, {
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
    console.error("❌ Gemini API error:", err.response?.data || err);
    return null;
  }
}

app.post("/generate", async (req, res) => {
  const result = await generateAutofillData();

  if (!result) {
    return res.status(500).json({ error: "Failed to generate data" });
  }

  res.json({
    output: result,
  });
});

app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🔥 Server started on port " + PORT);
});
