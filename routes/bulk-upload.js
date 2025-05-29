// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const { pool } = require("../db"); // Make sure this points to your PostgreSQL pool
// const { spawn } = require("child_process");
// const csv = require("csv-parser");
// const fs = require("fs");
// const path = require("path");
// const upload = require("../middleware/upload");

// const pythonScriptPath = path.join(__dirname, "../rba/script.py");

// const {
//   generateAndSaveRecommendation,
// } = require("../services/generateAndSaveRecommendation");
// const authenticateToken = require("../middleware/auth");

// // Define runPythonProcess properly
// async function runPythonProcess(scriptPath, labTestMasterId, inputForPython) {
//   return new Promise((resolve, reject) => {
//     // Convert the input data to JSON
//     const jsonInput = JSON.stringify(inputForPython);

//     // Run Python with the correct arguments
//     const pythonProcess = spawn("python", [
//       scriptPath,
//       labTestMasterId.toString(), // Convert number to string
//       jsonInput,
//     ]);

//     let resultData = "";
//     let errorData = "";

//     pythonProcess.stdout.on("data", (data) => {
//       resultData += data.toString();
//     });

//     pythonProcess.stderr.on("data", (data) => {
//       console.error(`Python stderr: ${data}`);
//       errorData += data.toString();
//     });

//     pythonProcess.on("close", (code) => {
//       if (code !== 0) {
//         console.error(`Python process exited with code ${code}`);
//         reject(new Error(`Python error: ${errorData}`));
//         return;
//       }

//       try {
//         const result = JSON.parse(resultData);
//         resolve(result);
//       } catch (error) {
//         console.error(`Invalid JSON from Python: ${resultData}`);
//         reject(new Error(`Invalid JSON from Python: ${resultData}`));
//       }
//     });
//   });
// }

// // Route to upload lab results
// router.post(
//   "/upload-lab-results",
//   upload.single("file"),
//   authenticateToken,
//   async (req, res) => {
//     if (!req.file) {
//       return res.status(400).json({ message: "CSV file is required." });
//     }

//     const results = [];
//     const insertedLabTests = new Set();
//     const processedGenderForTests = new Set(); // Track which tests already have gender processed
//     let client;

//     try {
//       client = await pool.connect();
//       await client.query("BEGIN");

//       // Parse CSV
//       await new Promise((resolve, reject) => {
//         fs.createReadStream(req.file.path)
//           .pipe(csv())
//           .on("data", (data) => results.push(data))
//           .on("end", resolve)
//           .on("error", reject);
//       });

//       for (const row of results) {
//         const hnNumber = row.hn_number; // Patient's HN number
//         const labItemName = row.lab_item_name; // Lab item name
//         let labItemValue = row.lab_item_value; // Lab item value as string initially
//         console.log(`🔍 Processing lab item: "${labItemName}"`);

//         // Special handling for Gender values
//         if (labItemName === "Gender") {
//           // Convert gender to numeric value (M=0, F=1)
//           if (labItemValue === "M" || labItemValue === "m") {
//             labItemValue = 0;
//           } else if (labItemValue === "F" || labItemValue === "f") {
//             labItemValue = 1;
//           } else {
//             console.warn(
//               `❌ Invalid gender value: ${labItemValue}. Skipping...`
//             );
//             continue; // Skip invalid gender values
//           }

//           // Insert gender for all associated lab tests
//           const testItemRows = await client.query(
//             "SELECT lab_test_master_id FROM lab_test_items WHERE lab_item_id = (SELECT id FROM lab_items WHERE lab_item_name = 'Gender')"
//           );

//           for (const testItem of testItemRows.rows) {
//             const labTestMasterId = testItem.lab_test_master_id;

//             // Find the latest pending lab test for the patient with the associated lab_test_master_id
//             const testRows = await client.query(
//               `SELECT id FROM lab_tests
//              WHERE hn_number = $1 AND lab_test_master_id = $2 AND status = 'pending'
//              ORDER BY lab_test_date DESC LIMIT 1`,
//               [hnNumber, labTestMasterId]
//             );

//             if (testRows.rows.length > 0) {
//               const labTestId = testRows.rows[0].id; // Get the lab test ID

//               // Check if we've already processed gender for this test
//               const testKey = `${labTestId}|${labTestMasterId}`;
//               if (processedGenderForTests.has(testKey)) {
//                 console.log(
//                   `⏭️ Gender already processed for lab test ID ${labTestId}. Skipping duplicate.`
//                 );
//                 continue;
//               }

//               // First check if gender already exists for this test
//               const existingGender = await client.query(
//                 `SELECT id FROM lab_results
//                WHERE lab_test_id = $1 AND lab_item_id = $2`,
//                 [labTestId, 9] // Assuming 9 is the ID for Gender
//               );

//               if (existingGender.rows.length > 0) {
//                 // Update existing gender record instead of inserting a new one
//                 await client.query(
//                   `UPDATE lab_results SET lab_item_value = $1
//                  WHERE lab_test_id = $2 AND lab_item_id = $3`,
//                   [labItemValue, labTestId, 9]
//                 );
//                 console.log(
//                   `♻️ Updated existing gender value for lab test ID ${labTestId}`
//                 );
//               } else {
//                 // Insert the gender value into lab_results
//                 await client.query(
//                   `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value)
//                  VALUES ($1, $2, $3)`,
//                   [labTestId, 9, labItemValue] // Assuming 9 is the ID for Gender
//                 );
//                 console.log(
//                   `✅ Inserted gender value for lab test ID ${labTestId}`
//                 );
//               }

//               // Mark this test as having gender processed
//               processedGenderForTests.add(testKey);
//               insertedLabTests.add(testKey); // Track processed tests
//             }
//           }
//           continue; // Skip further processing for gender
//         }

//         // For non-gender fields, parse as float
//         labItemValue = parseFloat(labItemValue);

//         // Validate the input data
//         if (!hnNumber || !labItemName || isNaN(labItemValue)) {
//           console.warn(
//             `❌ Invalid row data: ${JSON.stringify(row)}. Skipping...`
//           );
//           continue; // Skip invalid rows
//         }

//         // Look up lab_item_id based on lab_item_name
//         const itemRows = await client.query(
//           "SELECT id FROM lab_items WHERE lab_item_name = $1",
//           [labItemName]
//         );
//         console.log(`📦 Query result for "${labItemName}":`, itemRows.rows);

//         // Check if the lab item exists
//         if (itemRows.rows.length === 0) {
//           console.warn(`❌ Unknown lab item: ${labItemName}. Skipping...`);
//           continue; // Skip unknown lab items
//         }

//         const labItemId = itemRows.rows[0].id; // Get the corresponding lab_item_id

//         // Look up the lab_test_master_id using the lab_item_id
//         const testItemRows = await client.query(
//           "SELECT lab_test_master_id FROM lab_test_items WHERE lab_item_id = $1",
//           [labItemId]
//         );

//         // Check if the lab_test_master_id exists
//         if (testItemRows.rows.length === 0) {
//           console.warn(
//             `❌ No associated lab test found for lab item ID: ${labItemId}. Skipping...`
//           );
//           continue; // Skip if no associated lab test
//         }

//         const labTestMasterId = testItemRows.rows[0].lab_test_master_id; // Get the lab_test_master_id
//         console.log("labMasterId" + labTestMasterId);

//         // Find the latest pending lab test for the patient with the associated lab_test_master_id
//         const testRows = await client.query(
//           `SELECT id FROM lab_tests
//          WHERE hn_number = $1 AND lab_test_master_id = $2 AND status = 'pending'
//          ORDER BY lab_test_date DESC LIMIT 1`,
//           [hnNumber, labTestMasterId]
//         );

//         // Check if there is an active lab test
//         if (testRows.rows.length === 0) {
//           console.warn(
//             `⚠️ No active lab test for ${hnNumber} with master ID ${labTestMasterId}. Skipping...`
//           );
//           continue; // Skip if no active test found
//         }

//         const labTestId = testRows.rows[0].id; // Get the lab test ID
//         const testKey = `${labTestId}|${labTestMasterId}`;
//         insertedLabTests.add(testKey); // Track inserted lab test
//         console.log("labItemId" + labItemId);

//         // Check if the lab_item_id is associated with the lab_test_id
//         const labTestItemRows = await client.query(
//           "SELECT lab_item_id FROM lab_test_items WHERE lab_test_master_id = $1 AND lab_item_id = $2",
//           [labTestMasterId, labItemId]
//         );

//         if (labTestItemRows.rows.length === 0) {
//           console.warn(
//             `❌ Lab item ${labItemName} is not associated with lab_test_master_id ${labTestMasterId}. Skipping...`
//           );
//           continue;
//         }

//         // Check if result already exists for this test and item
//         const existingResult = await client.query(
//           `SELECT id FROM lab_results
//          WHERE lab_test_id = $1 AND lab_item_id = $2`,
//           [labTestId, labItemId]
//         );

//         if (existingResult.rows.length > 0) {
//           // Update existing record instead of inserting a new one
//           await client.query(
//             `UPDATE lab_results SET lab_item_value = $1
//            WHERE lab_test_id = $2 AND lab_item_id = $3`,
//             [labItemValue, labTestId, labItemId]
//           );
//           console.log(`♻️ Updated existing value for lab item ${labItemName}`);
//         } else {
//           // Insert the lab result into the database
//           await client.query(
//             `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value)
//            VALUES ($1, $2, $3)`,
//             [labTestId, labItemId, labItemValue]
//           );
//           console.log(`✅ Inserted value for lab item ${labItemName}`);
//         }
//       }

//       // Loop through lab test groups and check for completeness
//       for (const entry of insertedLabTests) {
//         const [labTestId, labTestMasterId] = entry.split("|").map(Number);

//         // Get required items
//         const requiredItems = await client.query(
//           "SELECT lab_item_id FROM lab_test_items WHERE lab_test_master_id = $1",
//           [labTestMasterId]
//         );

//         const uploadedItems = await client.query(
//           `SELECT DISTINCT lr.lab_item_id, li.lab_item_name, lr.lab_item_value
//          FROM lab_results lr
//          JOIN lab_items li ON lr.lab_item_id = li.id
//          JOIN lab_test_items lti ON lr.lab_item_id = lti.lab_item_id
//          WHERE lr.lab_test_id = $1 AND lti.lab_test_master_id = $2`,
//           [labTestId, labTestMasterId]
//         );

//         console.log(`✅ Required count: ${requiredItems.rows.length}`);
//         console.log(`✅ Uploaded count: ${uploadedItems.rows.length}`);
//         console.log(
//           "🧾 Required item IDs:",
//           requiredItems.rows.map((r) => r.lab_item_id)
//         );
//         console.log(
//           "📄 Uploaded item IDs:",
//           uploadedItems.rows.map((u) => u.lab_item_id)
//         );

//         // Check if all required items are present
//         const requiredIds = new Set(
//           requiredItems.rows.map((r) => r.lab_item_id)
//         );
//         const uploadedIds = new Set(
//           uploadedItems.rows.map((u) => u.lab_item_id)
//         );

//         // Check if all required items are uploaded
//         let allItemsUploaded = true;
//         for (const id of requiredIds) {
//           if (!uploadedIds.has(id)) {
//             allItemsUploaded = false;
//             break;
//           }
//         }

//         if (!allItemsUploaded) {
//           console.log(`⏳ Lab test ${labTestId} incomplete. Still pending.`);
//           continue;
//         }

//         const inputForPython = {};
//         for (const item of uploadedItems.rows) {
//           if (item.lab_item_name === "Gender") {
//             // Convert back to M/F for Python if needed
//             inputForPython[item.lab_item_name] =
//               item.lab_item_value == 0 ? "M" : "F";
//           } else {
//             // For other items, use the value as is (it's already numeric)
//             inputForPython[item.lab_item_name] = parseFloat(
//               item.lab_item_value
//             );
//           }
//         }

//         const statuses = await runPythonProcess(
//           pythonScriptPath,
//           labTestMasterId,
//           inputForPython
//         );

//         console.log("Python returned statuses:", statuses);

//         for (const item of uploadedItems.rows) {
//           // Skip gender for status updates
//           if (item.lab_item_name === "Gender") continue;

//           // Debug logging
//           console.log(`Matching item: ${item.lab_item_name}`);
//           console.log(
//             `Looking for key in: ${Object.keys(statuses).join(", ")}`
//           );

//           // Handle different key formats
//           const possibleKeys = [
//             item.lab_item_name.toLowerCase().replace(/\s+/g, "_"), // "uric_acid"
//             item.lab_item_name.toLowerCase(), // lowercase
//             item.lab_item_name, // Original name if it matches exactly
//             item.lab_item_name.replace(/\s+/g, ""), // Without spaces
//           ];

//           let status = "unknown";
//           for (const key of possibleKeys) {
//             if (statuses[key] && statuses[key].classification) {
//               status = statuses[key].classification;
//               break;
//             }
//           }

//           console.log(`Found status: ${status}`);

//           await client.query(
//             `UPDATE lab_results SET lab_item_status = $1
//            WHERE lab_test_id = $2 AND lab_item_id = $3`,
//             [status, labTestId, item.lab_item_id]
//           );
//         }

//         // Mark test as completed
//         await client.query(
//           "UPDATE lab_tests SET status = 'completed' WHERE id = $1",
//           [labTestId]
//         );

//         // Update patient lab_data_status = true
//         await client.query(
//           `UPDATE patients SET lab_data_status = true
//          WHERE hn_number = (
//             SELECT hn_number FROM lab_tests WHERE id = $1
//          )`,
//           [labTestId]
//         );
//       }
//       await client.query("COMMIT");

//       // 🔥 After the commit is successful
//       for (const entry of insertedLabTests) {
//         const [labTestIdStr] = entry.split("|");
//         const labTestId = parseInt(labTestIdStr);

//         try {
//           const result = await generateAndSaveRecommendation(labTestId);
//           console.log(
//             `💡 Recommendation generated for lab test ${labTestId}:`,
//             result
//           );
//         } catch (recommendationError) {
//           console.error(
//             `⚠️ Failed to generate recommendation for lab test ${labTestId}:`,
//             recommendationError.message
//           );
//         }
//       }

//       res
//         .status(200)
//         .json({ message: "Lab results uploaded and processed successfully." });
//     } catch (error) {
//       if (client) await client.query("ROLLBACK");
//       console.error("❌ Error processing lab results:", error);
//       res.status(500).json({ message: "Error processing lab results." });
//     } finally {
//       if (client) client.release();
//       fs.unlink(req.file.path, (err) => {
//         if (err) console.error("Error deleting temp file:", err);
//       });
//     }
//   }
// );

// module.exports = router;
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
      'Systolic': 1,
      'Diastolic': 2,
      'Cholesterol': 3,
      'Triglyceride': 4,
      'HDL': 5,
      'LDL': 6,
      'eGFR': 7,
      'Creatinine': 8,
      'Total Protein': 10,
      'Globulin': 11,
      'Albumin': 12,
      'AST': 13,
      'ALT': 14,
      'ALP': 15,
      'Total Bilirubin': 16,
      'Direct Bilirubin': 17,
      'Uric Acid': 18,
      'HCT': 19,
      'MCV': 20,
      'WBC': 21,
      'Neutrophile': 22,
      'Eosinophile': 23,
      'Monocyte': 24,
      'PLT Count': 25
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
          if (!['hn_number', 'lab_test_master_id', 'lab_test_date', 'doctor_id'].includes(columnName)) {
            const labItemId = LAB_ITEM_MAP[columnName];
            const labItemValue = row[columnName];

            if (labItemId && (labItemValue !== "" && labItemValue !== null && labItemValue !== undefined)) {
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
          if (error.code !== "23505") { // Ignore duplicate key errors
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
            [patient_id, lab_test_master_id, lab_test_date, user, doctor_id, hn_number]
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
            const genderValue = patientGender === 'male' ? 0 : 1;

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
              if (item.lab_item_name === 'Gender') {
                inputForPython[item.lab_item_name] = item.lab_item_value == 0 ? 'M' : 'F';
              } else {
                inputForPython[item.lab_item_name] = parseFloat(item.lab_item_value);
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
              if (item.lab_item_name === 'Gender') continue;

              // Handle different key formats
              const possibleKeys = [
                item.lab_item_name.toLowerCase().replace(/\s+/g, '_'),
                item.lab_item_name.toLowerCase(),
                item.lab_item_name,
                item.lab_item_name.replace(/\s+/g, ''),
              ];

              let status = 'unknown';
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
            console.error(`Error processing lab test ${test.lab_test_id}:`, processingError.message);
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
          await generateAndSaveRecommendationByDate(hn_number, doctor_id, lab_test_date);
          processedRecommendations.add(recommendationKey);
        } catch (error) {
          console.error(`Failed to generate recommendation for ${hn_number}:`, error.message);
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
