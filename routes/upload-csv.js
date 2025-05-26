const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const {pool} = require("../db");
const bcrypt = require("bcrypt");
const authenticateToken = require("../middleware/auth");
const router = express.Router();
const upload = multer({ dest: "uploads/" });

const saltRounds = 10;

router.post("/patients", upload.single("csvFile"), authenticateToken, async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const filePath = req.file.path;
  const records = [];
  const processedPatients = new Set();
  const warnedHNs = new Set();

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => records.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    if (records.length === 0) {
      fs.unlinkSync(filePath);
      return res.send("No data found in CSV");
    }

    const patientMap = new Map();
    
    for (const row of records) {
      const { hn_number, name, citizen_id, phone_no, doctor_id } = row;
      
      if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id) {
        continue;
      }
      
      patientMap.set(hn_number, { hn_number, name, citizen_id, phone_no, doctor_id });
    }
    
    console.log(`Found ${patientMap.size} unique patients in CSV`);
    
    const client = await pool.connect();
    const existingPatients = new Set();
    const existingCitizenIds = new Map();
    
    try {
      const existingResults = await client.query(
        "SELECT hn_number, citizen_id FROM patients"
      );
      
      for (const patient of existingResults.rows) {
        existingPatients.add(patient.hn_number);
        existingCitizenIds.set(patient.citizen_id, patient.hn_number);
      }
      
      console.log(`Found ${existingPatients.size} existing patients in database`);
      
      let newPatientsInserted = 0;
      
      for (const [hn_number, patientData] of patientMap.entries()) {
        if (existingPatients.has(hn_number)) {
          continue;
        }
        
        if (existingCitizenIds.has(patientData.citizen_id)) {
          const conflictHN = existingCitizenIds.get(patientData.citizen_id);
          if (!warnedHNs.has(hn_number)) {
            console.warn(`Patient with HN ${hn_number} has citizen_id ${patientData.citizen_id} which conflicts with existing patient HN ${conflictHN}`);
            warnedHNs.add(hn_number);
          }
          continue;
        }
        
        const hashedPassword = await bcrypt.hash(patientData.citizen_id, saltRounds);
        
        await client.query(
          `INSERT INTO patients 
           (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            patientData.hn_number,
            patientData.name,
            patientData.citizen_id,
            patientData.phone_no,
            hashedPassword,
            false,
            false,
            patientData.doctor_id,
          ]
        );

        await client.query(
          `INSERT INTO patient_data (hn_number) VALUES ($1)`,
          [patientData.hn_number]
        );
        
        existingPatients.add(hn_number);
        existingCitizenIds.set(patientData.citizen_id, hn_number);
        newPatientsInserted++;
      }
      
      console.log(`Inserted ${newPatientsInserted} new patients`);
      
      let labTestsInserted = 0;
      let labTestsSkipped = 0;
      
      for (const row of records) {
        const { hn_number, lab_test_name, lab_test_date } = row;
        
        if (!hn_number || !lab_test_name) {
          continue;
        }
        
        if (!existingPatients.has(hn_number)) {
          if (!warnedHNs.has(hn_number)) {
            console.warn(`Skipping lab test for non-existent patient with HN ${hn_number}`);
            warnedHNs.add(hn_number);
          }
          labTestsSkipped++;
          continue;
        }
        
        const labTestResults = await client.query(
          "SELECT id FROM lab_tests_master WHERE test_name = $1",
          [lab_test_name]
        );
        
        const labTestMasterId = labTestResults.rows.length > 0 ? labTestResults.rows[0].id : null;
        
        if (!labTestMasterId) {
          console.warn(`No matching test name found for ${lab_test_name}`);
          labTestsSkipped++;
          continue;
        }
        
        const formattedLabTestDate = lab_test_date ? new Date(lab_test_date) : new Date();
        
        await client.query(
          `INSERT INTO lab_tests 
           (hn_number, lab_test_master_id, status, lab_test_date)
           VALUES ($1, $2, $3, $4)`,
          [hn_number, labTestMasterId, "pending", formattedLabTestDate]
        );
        
        labTestsInserted++;
      }
      
      console.log(`Inserted ${labTestsInserted} lab tests, skipped ${labTestsSkipped} lab tests`);
      
      fs.unlinkSync(filePath);
      res.send(`CSV file processed: ${newPatientsInserted} new patients inserted, ${labTestsInserted} lab tests inserted, ${labTestsSkipped} lab tests skipped`);
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(500).send("Error processing upload: " + error.message);
    } finally {
      client.release();
    }
  } catch (error) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    console.error("Error processing upload:", error);
    return res.status(500).send("Error inserting patients: " + error.message);
  }
});

router.post("/lab-data", upload.single("csvFile"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const filePath = req.file.path;
  const records = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => records.push(row))
    .on("end", async () => {
      if (records.length === 0) {
        fs.unlinkSync(filePath);
        return res.send("No data found in CSV");
      }
      
      const labDataFields = [
        "gender",
        "blood_type",
        "age",
        "date_of_birth",
        "weight",
        "height",
        "bmi",
        "systolic",
        "diastolic",
        "order_date",
        "hn_number"
      ];

      try {
        const client = await pool.connect();
        
        // Insert lab data records
        for (const row of records) {
          const values = labDataFields.map(field => row[field]);
          await client.query(
            `INSERT INTO lab_data (${labDataFields.join(", ")}) 
             VALUES (${labDataFields.map((_, i) => `$${i+1}`).join(", ")})`,
            values
          );
        }

        // Update patient statuses
        const hnNumbers = [...new Set(records.map(row => row.hn_number))];
        await client.query(
          `UPDATE patients SET lab_data_status = true WHERE hn_number = ANY($1::text[])`,
          [hnNumbers]
        );

        client.release();
        fs.unlinkSync(filePath);
        res.send("Lab data uploaded and patient status updated successfully");
      } catch (err) {
        fs.unlinkSync(filePath);
        res.status(500).send("Error inserting lab data: " + err.message);
      }
    });
});

module.exports = router;