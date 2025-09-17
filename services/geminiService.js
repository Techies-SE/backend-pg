// geminiService.js
// services/geminiService.js
// import axios from "axios";
const axios = require("axios");
const https = require("https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Create an agent that ignores SSL errors
const agent = new https.Agent({
  rejectUnauthorized: false,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateRecommendation(prompt) {
  // const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // const result = await model.generateContent(prompt);
  // const response = await result.response;
  // return response.text(); // This is your human-like AI recommendation

  const apiUrl = "https://bd97e374d72b.ngrok-free.app"; // Correct ngrok URL

  try {
    console.log("Testing API with data:", prompt);

    const response = await axios.post(
      `${apiUrl}/predict`,
      { prompt },
      {
        httpsAgent: agent, // Use the custom agent
        timeout: 240000, // Increase timeout
      }
    );

    console.log("API Response:", response.data.recommendation);
    const recommendation = response.data.recommendation;

    // Validate that we actually got a recommendation
    if (!recommendation || recommendation.trim() === "") {
      console.warn("Empty recommendation received");
      return "Unable to generate recommendation at this time. Please try again.";
    }

    console.log("API Response:", recommendation);
    return recommendation;
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return "Unable to generate recommendation at this time. Please try again."; // prevent null DB inserts
  }
}

module.exports = { generateRecommendation };
