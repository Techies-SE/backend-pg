const express = require("express");
const router = express.Router();
const multer = require("multer");
const { pool } = require("../db");
const { spawn } = require("child_process");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const upload = require("../middleware/upload");

const pythonScriptPath = path.join(__dirname, "../rba/script.py");

const {
  createRecommendationPrompt,
} = require("../services/recommendationPrompt.js");
const { generateRecommendation } = require("../services/geminiService.js");
const authenticateToken = require("../middleware/auth");
const TEST_REQUIREMENTS = {
  1: ["Systolic", "Diastolic"], // Blood Pressure
  2: ["Cholesterol", "Triglyceride", "HDL", "LDL"], // Lipid Profile
  3: ["eGFR", "Creatinine", "Gender"], // Kidney Health
  4: ["Total Protein", "Globulin", "Albumin", "AST", "ALT", "Gender"], // Liver Function
  5: ["Uric Acid", "Gender"], // Uric Acid
  6: [
    "HCT",
    "MCV",
    "WBC",
    "Neutrophile",
    "Eosinophile",
    "Monocyte",
    "PLT Count",
    "Gender",
  ], // CBC
};

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

// Helper function to convert gender values (from patient data)
const convertGenderValue = (value) => {
  if (typeof value === "string") {
    const lowerValue = value.toLowerCase();
    if (lowerValue === "male" || lowerValue === "m") return 0;
    if (lowerValue === "female" || lowerValue === "f") return 1;
  }
  return value; // Return as-is if already numeric or other value
};

// New function to generate recommendation grouped by date and patient
const generateAndSaveRecommendationByDate = async function (
  hn_number,
  doctor_id,
  lab_test_date
) {
  try {
    // Get all lab results for tests done on the specific date for this patient
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
        AND DATE(lt.lab_test_date) = DATE($2)
      ORDER BY ltm.test_name, li.lab_item_name
      `,
      [hn_number, lab_test_date]
    );

    if (labData.length === 0)
      throw new Error("No lab results found for this date.");

    const patientName = labData[0].patient_name;
    const testDate = labData[0].lab_test_date;

    // Check if recommendation already exists for this patient and date
    const existingRec = await pool.query(
      `SELECT id FROM recommendations 
       WHERE hn_number = $1 AND DATE(lab_test_date) = DATE($2)`,
      [hn_number, testDate]
    );

    if (existingRec.rowCount > 0) {
      return { message: "Recommendation already exists for this date" };
    }

    // Transform gender values from 0/1 to Male/Female for the prompt
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

// Route to upload lab results
router.post(
  "/upload-lab-results",
  upload.single("file"),
  authenticateToken,
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "CSV file is required." });
    }

    // Mapping of CSV column names to lab item IDs
    const LAB_ITEM_MAP = {
      Systolic: 1,
      Diastolic: 2,
      Cholesterol: 3,
      Triglyceride: 4,
      HDL: 5,
      LDL: 6,
      eGFR: 7,
      Creatinine: 8,
      "Total Protein": 10,
      Globulin: 11,
      Albumin: 12,
      AST: 13,
      ALT: 14,
      ALP: 15,
      "Total Bilirubin": 16,
      "Direct Bilirubin": 17,
      "Uric Acid": 18,
      HCT: 19,
      MCV: 20,
      WBC: 21,
      Neutrophile: 22,
      Eosinophile: 23,
      Monocyte: 24,
      "PLT Count": 25,
    };

    const results = [];
    const insertedLabTests = new Set();
    const processedRecommendations = new Set();
    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      // Parse CSV
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on("data", (data) => results.push(data))
          .on("end", resolve)
          .on("error", reject);
      });

      // Group CSV data by patient, date, and doctor for processing
      const groupedData = {};

      for (const row of results) {
        const key = `${row.hn_number}|${row.lab_test_date}|${row.doctor_id}`;
        if (!groupedData[key]) {
          groupedData[key] = {
            hn_number: row.hn_number,
            lab_test_date: row.lab_test_date,
            doctor_id: row.doctor_id,
            lab_tests: new Map(),
          };
        }

        const testId = row.lab_test_master_id;
        if (!groupedData[key].lab_tests.has(testId)) {
          groupedData[key].lab_tests.set(testId, []);
        }

        const labItems = groupedData[key].lab_tests.get(testId);

        // Process all columns except the fixed ones
        Object.keys(row).forEach((columnName) => {
          if (
            ![
              "hn_number",
              "lab_test_master_id",
              "lab_test_date",
              "doctor_id",
            ].includes(columnName)
          ) {
            const labItemId = LAB_ITEM_MAP[columnName];
            const labItemValue = row[columnName];

            if (
              labItemId &&
              labItemValue !== "" &&
              labItemValue !== null &&
              labItemValue !== undefined
            ) {
              labItems.push({
                lab_item_id: labItemId,
                lab_item_value: labItemValue,
              });
            }
          }
        });
      }

      // Process each patient group
      for (const [groupKey, groupData] of Object.entries(groupedData)) {
        const { hn_number, lab_test_date, doctor_id, lab_tests } = groupData;
        const user = req.user.id;

        // 1. Validate patient exists
        const patientRes = await client.query(
          "SELECT id FROM patients WHERE hn_number = $1",
          [hn_number]
        );
        if (patientRes.rowCount === 0) {
          console.warn(`Patient not found: ${hn_number}. Skipping...`);
          continue;
        }

        const patientData = await client.query(
          "SELECT gender from patient_data where hn_number = $1",
          [hn_number]
        );
        const patient_id = patientRes.rows[0].id;
        const patientGender = patientData.rows[0].gender;

        // 2. Assign patient-doctor relationship
        try {
          await client.query(
            `INSERT INTO patient_doctor (patient_id, doctor_id, assigned_by, assigned_at)
             VALUES ($1, $2, $3, NOW())`,
            [patient_id, doctor_id, user]
          );
        } catch (error) {
          if (error.code !== "23505") {
            // Ignore duplicate key errors
            throw error;
          }
        }

        const testsToProcess = [];

        // 3. Process each lab test for this patient
        for (const [lab_test_master_id, lab_items] of lab_tests) {
          // Insert lab test
          const labTestRes = await client.query(
            `INSERT INTO lab_tests (patient_id, lab_test_master_id, lab_test_date, uploaded_by, doctor_id, hn_number)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              patient_id,
              lab_test_master_id,
              lab_test_date,
              user,
              doctor_id,
              hn_number,
            ]
          );

          const lab_test_id = labTestRes.rows[0].id;
          insertedLabTests.add(`${lab_test_id}|${lab_test_master_id}`);

          // Store test info for processing
          testsToProcess.push({
            lab_test_id,
            lab_test_master_id: parseInt(lab_test_master_id),
            lab_items,
          });

          // Add gender to lab items if required
          const genderItemRes = await client.query(
            `SELECT li.id as lab_item_id 
             FROM lab_items li 
             JOIN lab_test_items lti ON li.id = lti.lab_item_id 
             WHERE li.lab_item_name = 'Gender' AND lti.lab_test_master_id = $1`,
            [lab_test_master_id]
          );

          if (genderItemRes.rowCount > 0) {
            const genderLabItemId = genderItemRes.rows[0].lab_item_id;
            const genderValue = patientGender === "male" ? 0 : 1;

            lab_items.push({
              lab_item_id: genderLabItemId,
              lab_item_value: genderValue,
            });
          }

          // Insert lab results
          for (const item of lab_items) {
            await client.query(
              `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value, lab_item_status)
               VALUES ($1, $2, $3, NULL)`,
              [lab_test_id, item.lab_item_id, item.lab_item_value]
            );
          }
        }

        // Process each test with Python
        for (const test of testsToProcess) {
          try {
            // Get all items for this test
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

            // Update statuses in database
            for (const item of itemsRes.rows) {
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
          } catch (processingError) {
            console.error(
              `Error processing lab test ${test.lab_test_id}:`,
              processingError.message
            );
          }
        }

        // Update patient lab_data_status
        await client.query(
          `UPDATE patients SET lab_data_status = true 
           WHERE hn_number = $1`,
          [hn_number]
        );
      }

      await client.query("COMMIT");

      // Generate recommendations
      for (const [groupKey, groupData] of Object.entries(groupedData)) {
        const { hn_number, lab_test_date, doctor_id } = groupData;
        const recommendationKey = `${hn_number}|${lab_test_date}`;

        if (processedRecommendations.has(recommendationKey)) continue;

        try {
          await generateAndSaveRecommendationByDate(
            hn_number,
            doctor_id,
            lab_test_date
          );
          processedRecommendations.add(recommendationKey);
        } catch (error) {
          console.error(
            `Failed to generate recommendation for ${hn_number}:`,
            error.message
          );
        }
      }

      res.status(200).json({ message: "Lab results uploaded successfully." });
    } catch (error) {
      if (client) await client.query("ROLLBACK");
      console.error("Error processing lab results:", error);
      res.status(500).json({ message: "Error processing lab results." });
    } finally {
      if (client) client.release();
      fs.unlink(req.file.path, (err) => {
        if (err) console.error("Error deleting temp file:", err);
      });
    }
  }
);

module.exports = router;
