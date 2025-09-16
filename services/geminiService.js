// geminiService.js
// services/geminiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateRecommendation(prompt) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text(); // This is your human-like AI recommendation
}

module.exports = { generateRecommendation };