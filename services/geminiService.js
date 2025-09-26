// geminiService.js
// services/geminiService.js
// import axios from "axios";
const axios = require("axios");
const https = require("https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");


const artifacts = {
  blood_pressure: JSON.parse(
    fs.readFileSync("../models/blood_pressure_artifact.json", "utf8")
  ),
};

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// async function generateRecommendation(prompt) {
//   const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

//   const result = await model.generateContent(prompt);
//   const response = await result.response;
//   return response.text(); // This is your human-like AI recommendation

// }

function predictLabs(input) {
  const results = {};
  const recommendations = [];
  for (const [testName, artifact] of Object.entries(artifacts)) {
    const hasAll = artifact.features.every((f) => f in input);
    if (hasAll) {
      const prediction = predict(artifact, input);
      results[testName] = prediction;
      recommendations.push(prediction);
    }
  }
  if (Object.keys(results).length === 0) {
    throw new Error("No matching lab test found for the given input.");
  }
  // return {
  //   details: results,
  //   combined: recommendations.join(""),
  // };
  return recommendations.join("");
}

function predict(artifact, inputFeatures) {
  const features = artifact.features;
  let x = features.map((fname, i) => {
    const val =
      inputFeatures[fname] === undefined || inputFeatures[fname] === null
        ? artifact.imputer_median[i]
        : inputFeatures[fname];
    return Number(val);
  });

  x = x.map((v, i) => (v - artifact.scaler_mean[i]) / artifact.scaler_std[i]);

  const scores = artifact.coef.map((coefRow, clsIdx) => {
    return coefRow.reduce(
      (acc, c, j) => acc + c * x[j],
      artifact.intercept[clsIdx] || 0
    );
  });

  const probs = softmanx(scores);

  const bestIdx = probs.indexOf(Math.max(...probs));
  return artifact.classes[bestIdx];
}

// module.exports = { generateRecommendation };
module.exports = { predictLabs };
