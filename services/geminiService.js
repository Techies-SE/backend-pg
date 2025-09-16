// geminiService.js
// services/geminiService.js
// import axios from "axios";
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateRecommendation(prompt) {
  // const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  // const result = await model.generateContent(prompt);
  // const response = await result.response;
  // return response.text(); // This is your human-like AI recommendation

  const apiUrl = 'http://127.0.0.1:6000';
  
  try {
      
      console.log('Testing API with data:', prompt);
      
      const response = await axios.post(`${apiUrl}/predict`, prompt);
      
      console.log('API Response:');
      console.log('Recommendation:', response.data.recommendation);
      return response.data.recommendation;
      
  } catch (error) {
      console.error('Error:', error.response?.data || error.message);
  }

}

module.exports = { generateRecommendation };