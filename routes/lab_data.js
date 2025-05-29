const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const authenticateToken = require("../middleware/auth");
const { spawn } = require("child_process");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const upload = require("../middleware/upload");

// Create a lab_data
const pythonScriptPath = path.join(__dirname, "../rba/script.py");

const {
  createRecommendationPrompt,
} = require("../services/recommendationPrompt.js");
const { generateRecommendation } = require("../services/geminiService.js");

// Define runPythonProcess properly
async function runPythonProcess(scriptPath, labTestMasterId, inputForPython) {
  return new Promise((resolve, reject) => {
    // Convert the input data to JSON
    const jsonInput = JSON.stringify(inputForPython);

    // Run Python with the correct arguments
    const pythonProcess = spawn("python", [
      scriptPath,
      labTestMasterId.toString(), // Convert number to string
      jsonInput,
    ]);

    let resultData = "";
    let errorData = "";

    pythonProcess.stdout.on("data", (data) => {
      resultData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python stderr: ${data}`);
      errorData += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        reject(new Error(`Python error: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData);
        resolve(result);
      } catch (error) {
        console.error(`Invalid JSON from Python: ${resultData}`);
        reject(new Error(`Invalid JSON from Python: ${resultData}`));
      }
    });
  });
}
const uploadLabData = async (req, res) => {
  const client = await pool.connect();
  try {
    const { hn_number, doctor_id, lab_tests } = req.body;
    const user = req.user.id; // get admin from token
    console.log("userId", user);
    console.log("doctor_id", doctor_id);

    // 1. Validate patient exists
    const patientRes = await client.query(
      "SELECT id FROM patients WHERE hn_number = $1",
      [hn_number]
    );
    if (patientRes.rowCount === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }
    const patient_id = patientRes.rows[0].id;
    console.log("patient_id", patient_id);

    await client.query("BEGIN");

    // 2. Assign patient-doctor relationship
    try {
      await client.query(
        `INSERT INTO patient_doctor (patient_id, doctor_id, assigned_by, assigned_at)
     VALUES ($1, $2, $3, NOW())`,
        [patient_id, doctor_id, user]
      );
    } catch (error) {
      if (error.code === "23505") {
        // Unique violation error code
        console.log("Patient-doctor relationship already exists");
      } else {
        throw error; // Re-throw other errors
      }
    }

    const labTestIds = [];
    const testsToProcess = []; // Store tests that need Python processing

    // Helper function to convert gender values
    const convertGenderValue = (value) => {
      if (typeof value === "string") {
        const lowerValue = value.toLowerCase();
        if (lowerValue === "male") return 0;
        if (lowerValue === "female") return 1;
      }
      return value; // Return as-is if already numeric or other value
    };

    // 3. Insert each lab test
    for (const test of lab_tests) {
      const labTestRes = await client.query(
        `INSERT INTO lab_tests (patient_id, lab_test_master_id, lab_test_date, uploaded_by, doctor_id, hn_number)
         VALUES ($1, $2, NOW(), $3, $4, $5)
         RETURNING id`,
        [patient_id, test.lab_test_id, user, doctor_id, hn_number]
      );

      const lab_test_id = labTestRes.rows[0].id;
      labTestIds.push(lab_test_id);

      // Store test info for later processing
      testsToProcess.push({
        lab_test_id,
        lab_test_master_id: test.lab_test_id,
        lab_items: test.lab_items,
      });

      // 4. Insert lab results for this test
      for (const item of test.lab_items) {
        // Convert gender values to numeric before inserting
        const processedValue = convertGenderValue(item.lab_item_value);

        await client.query(
          `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value, lab_item_status)
           VALUES ($1, $2, $3, NULL)`,
          [lab_test_id, item.lab_item_id, processedValue]
        );
      }
    }

    await client.query("COMMIT");

    // Process each test with Python (outside transaction)
    for (const test of testsToProcess) {
      try {
        // Get all items for this test to prepare Python input
        const itemsRes = await client.query(
          `SELECT li.lab_item_name, lr.lab_item_value
           FROM lab_results lr
           JOIN lab_items li ON lr.lab_item_id = li.id
           WHERE lr.lab_test_id = $1`,
          [test.lab_test_id]
        );

        // Prepare input for Python
        const inputForPython = {};
        for (const item of itemsRes.rows) {
          if (item.lab_item_name === "Gender") {
            // Convert gender to M/F format if needed
            inputForPython[item.lab_item_name] =
              item.lab_item_value == 0 ? "M" : "F";
          } else {
            inputForPython[item.lab_item_name] = parseFloat(
              item.lab_item_value
            );
          }
        }

        // Run Python process
        const statuses = await runPythonProcess(
          pythonScriptPath,
          test.lab_test_master_id,
          inputForPython
        );

        console.log("Python returned statuses:", statuses);

        // Update statuses in database
        await client.query("BEGIN");

        for (const item of itemsRes.rows) {
          // Skip gender for status updates
          if (item.lab_item_name === "Gender") continue;

          // Handle different key formats
          const possibleKeys = [
            item.lab_item_name.toLowerCase().replace(/\s+/g, "_"),
            item.lab_item_name.toLowerCase(),
            item.lab_item_name,
            item.lab_item_name.replace(/\s+/g, ""),
          ];

          let status = "unknown";
          for (const key of possibleKeys) {
            if (statuses[key] && statuses[key].classification) {
              status = statuses[key].classification;
              break;
            }
          }

          await client.query(
            `UPDATE lab_results SET lab_item_status = $1 
             WHERE lab_test_id = $2 AND lab_item_id = (
               SELECT id FROM lab_items WHERE lab_item_name = $3
             )`,
            [status, test.lab_test_id, item.lab_item_name]
          );
        }

        await client.query("COMMIT");
      } catch (processingError) {
        console.error(
          `⚠️ Error processing lab test ${test.lab_test_id}:`,
          processingError.message
        );
        await client.query("ROLLBACK");
      }
    }

    // Update patient lab_data_status
    await client.query(
      `UPDATE patients SET lab_data_status = true 
       WHERE hn_number = $1`,
      [hn_number]
    );

    // Generate ONE recommendation for all tests uploaded today for this patient
    try {
      const result = await generateAndSaveRecommendationByDate(
        hn_number,
        doctor_id
      );
      console.log(
        `💡 Recommendation generated for patient ${hn_number} for today's tests:`,
        result
      );
    } catch (recommendationError) {
      console.error(
        `⚠️ Failed to generate recommendation for patient ${hn_number}:`,
        recommendationError.message
      );
    }

    res.status(201).json({
      message: "Lab data uploaded and processed successfully",
      labTestIds,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Upload error:", error);
    res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};
// New function to generate recommendation grouped by date
const generateAndSaveRecommendationByDate = async function (
  hn_number,
  doctor_id
) {
  try {
    // Get all lab results for tests done today for this patient
    const { rows: labData } = await pool.query(
      `
      SELECT 
        p.name AS patient_name,
        li.lab_item_name,
        lr.lab_item_value,
        lr.lab_item_status,
        li.unit,
        lt.lab_test_date,
        ltm.test_name
      FROM lab_results lr
      JOIN lab_items li ON lr.lab_item_id = li.id
      JOIN lab_tests lt ON lr.lab_test_id = lt.id
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN patients p ON lt.hn_number = p.hn_number
      WHERE lt.hn_number = $1 
        AND DATE(lt.lab_test_date) = CURRENT_DATE
      ORDER BY ltm.test_name, li.lab_item_name
      `,
      [hn_number]
    );

    if (labData.length === 0)
      throw new Error("No lab results found for today.");

    const patientName = labData[0].patient_name;
    const testDate = labData[0].lab_test_date;

    // Check if recommendation already exists for this patient and date
    const existingRec = await pool.query(
      `SELECT id FROM recommendations 
       WHERE hn_number = $1 AND DATE(lab_test_date) = $2`,
      [hn_number, testDate]
    );

    if (existingRec.rowCount > 0) {
      return { message: "Recommendation already exists for this date" };
    }

    // Transform gender values
    const transformedLabData = labData.map((item) => {
      if (
        item.lab_item_name.toLowerCase() === "gender" &&
        item.lab_item_value !== null
      ) {
        return {
          ...item,
          lab_item_value:
            String(item.lab_item_value) === "0" ? "Male" : "Female",
          lab_item_status: null,
        };
      }
      return item;
    });

    // Create prompt with grouped data
    const prompt = await createRecommendationPrompt(
      patientName,
      transformedLabData
    );

    // Generate recommendation
    const aiRecommendation = await generateRecommendation(prompt);

    // Save recommendation with date grouping
    await pool.query(
      `
      INSERT INTO recommendations 
        (generated_recommendation, status, hn_number, doctor_id, lab_test_date)
      VALUES ($1, 'pending', $2, $3, $4)
      `,
      [aiRecommendation, hn_number, doctor_id, testDate]
    );

    return {
      message:
        "Recommendation generated and saved successfully for date group.",
      doctor_id: doctor_id,
      test_date: testDate,
    };
  } catch (error) {
    console.error("Error generating grouped recommendation:", error.message);
    throw error;
  }
};
router.post("/", authenticateToken, uploadLabData);

// Get all lab_data
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM lab_data");
    res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
