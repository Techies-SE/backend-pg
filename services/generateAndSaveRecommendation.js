const { pool } = require("../db.js");
const { generateRecommendation } = require("./geminiService.js");
const { createRecommendationPrompt } = require("./recommendationPrompt.js");

module.exports.generateAndSaveRecommendation = async function (lab_test_id) {
  try {
    // Step 1: Get lab test data + patient info
    const { rows: labData } = await pool.query(
      `
      SELECT 
        p.name AS patient_name,
        li.lab_item_name,
        lr.lab_item_value,
        lr.lab_item_status,
        li.unit
      FROM lab_results lr
      JOIN lab_items li ON lr.lab_item_id = li.id
      JOIN lab_tests lt ON lr.lab_test_id = lt.id
      JOIN patients p ON lt.hn_number = p.hn_number
      WHERE lr.lab_test_id = $1
      `,
      [lab_test_id]
    );

    if (labData.length === 0) throw new Error("No lab results found.");

    const patientName = labData[0].patient_name;
    const doctorId = labData[0].doctor_id;

    // ✅ transform gender (id 9 or named 'gender') from 0/1 to Male/Female
    const transformedLabData = labData.map((item) => {
      if (
        item.lab_item_name.toLowerCase() === "gender" &&
        item.lab_item_value !== null
      ) {
        return {
          ...item,
          lab_item_value:
            String(item.lab_item_value) === "0" ? "Male" : "Female",
          lab_item_status: null, // explicitly null since gender has no high/low
        };
      }
      return item;
    });

    const prompt = await createRecommendationPrompt(
      patientName,
      transformedLabData
    );

    // Step 2: Generate recommendation
    const aiRecommendation = await generateRecommendation(prompt);

    // Step 3: Save to recommendations table with doctor_id
    await pool.query(
      `
      INSERT INTO recommendations 
        (generated_recommendation, status, lab_test_id, doctor_id, updated_at)
      VALUES ($1, 'pending', $2, $3, NOW())
      `,
      [aiRecommendation, lab_test_id, doctorId]
    );

    return {
      message: "Recommendation generated and saved successfully.",
      doctorId: doctorId,
    };
  } catch (error) {
    console.error("Error generating recommendation:", error.message);
    throw error;
  }
};
