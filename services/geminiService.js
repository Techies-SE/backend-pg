// geminiService.js
// services/geminiService.js
// import axios from "axios";
const axios = require("axios");
const https = require("https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

//softmax
// function softmax(arr) {
//   const max = Math.max(...arr);
//   const exps = arr.map((x) => Math.exp(x - max));
//   const sum = exps.reduce((a, b) => a + b, 0);
//   return exps.map((e) => e / sum);
// }

function softmax(arr, temperature = 1.5) {
  const max = Math.max(...arr);
  const exps = arr.map((x) => Math.exp((x - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// Absolute path to the models directory
const modelsDir = path.join(__dirname, "..", "models");

// Read every *.json file and parse it
const artifacts = {};
for (const file of fs.readdirSync(modelsDir)) {
  if (file.endsWith(".json")) {
    const name = path.basename(file, ".json"); // e.g. "blood_pressure_artifact"
    const filePath = path.join(modelsDir, file);
    artifacts[name] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }
}

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
      // recommendations.push(prediction);
      const formatted = `${
        prediction.prediction
      } (Probability: ${prediction.probability.toFixed(6)})`;
      recommendations.push(formatted);
    }
  }
  if (Object.keys(results).length === 0) {
    throw new Error("No matching lab test found for the given input.");
  }
  // return {
  //   details: results,
  //   combined: recommendations.join(""),
  // };

  //paragraph view
  // return recommendations.join("");

  //list view
  const bulletList = recommendations.map((r) => `• ${r}`).join("\n");
  return bulletList;
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

  x = x.map((v, i) => (v - artifact.scaler_mean[i]) / artifact.scaler_scale[i]);

  const scores = artifact.coef.map((coefRow, clsIdx) => {
    return coefRow.reduce(
      (acc, c, j) => acc + c * x[j],
      artifact.intercept[clsIdx] || 0
    );
  });

  const probs = softmax(scores);

  const bestIdx = probs.indexOf(Math.max(...probs));
  //old
  // return artifact.classes[bestIdx];

  console.log("Scores:", scores);
  console.log("Probabilities:", probs);
  console.log("Best class:", artifact.classes[bestIdx]);

  return {
    prediction: artifact.classes[bestIdx],
    probability: probs[bestIdx],
    probabilities: probs.map((p, i) => ({
      class: artifact.classes[i],
      probability: p,
    })),
  };
}

// module.exports = { generateRecommendation };
module.exports = { predictLabs };
