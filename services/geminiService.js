// geminiService.js
// services/geminiService.js
// import axios from "axios";
const axios = require("axios");
const https = require("https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateRecommendation(prompt) {
  // const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // const result = await model.generateContent(prompt);
  // const response = await result.response;
  // return response.text(); // This is your human-like AI recommendation

  const apiUrl = 'https://bd97e374d72b.ngrok-free.app'; // Correct ngrok URL
  
  try {
      console.log('Testing API with data:', prompt);
      
      const response = await axios.post(`${apiUrl}/predict`, { prompt });
      
      console.log('API Response:', response.data.recommendation);
      return response.data.recommendation;
      
  } catch (error) {
      console.error('Error:', error.response?.data || error.message);
      return null; // prevent null DB inserts
  }

}

module.exports = { generateRecommendation };