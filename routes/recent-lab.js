const express = require("express");
const router = express.Router();
const { pool } = require("../db"); // Now using pg pool
const bcrypt = require("bcrypt");
const authenticateToken = require("../middleware/auth");
router.get("/", authenticateToken, async (req, res) => {
  try {
    console.log("1. Route hit");
    console.log("2. User:", req.user);

    const doctorId = req.user?.id;
    if (!doctorId) {
      return res.status(400).json({ error: "No doctor ID found" });
    }

    console.log("3. Doctor ID:", doctorId);

    const { rows } = await pool.query(
      `SELECT 
        p.name AS patient_name,
        p.id AS patient_id,
        p.hn_number,
        ltm.test_name,
        lt.lab_test_date,
        lt.id AS lab_test_id
      FROM 
        lab_tests lt
      JOIN 
        lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN 
        patients p ON lt.patient_id = p.id
      JOIN 
        patient_doctor pd ON pd.patient_id = p.id
      WHERE 
        pd.doctor_id = $1
      ORDER BY 
        lt.lab_test_date DESC
      LIMIT 3`, // Simple test query first
      [doctorId]
    );

    console.log("4. Query successful:", rows);

    res.json({ success: true, doctorId, testData: rows });
  } catch (error) {
    console.error("Detailed error:", error.message, error.stack);
    res.status(500).json({ success: false, error: error.message });
  }
});
