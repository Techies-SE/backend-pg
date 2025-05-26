const express = require("express");
const router = express.Router();
const {pool} = require('../db'); // Now using pg pool

// Get a table for lab_data - patients - doctors
router.get("/", async (req, res) => {
  const query = `
    SELECT
      patients.id AS patient_id,
      patients.name AS patient_name,
      patients.hn_number AS hn_number,
      lab_data.age AS patient_age,
      lab_data.gender AS patient_gender,
      lab_data.blood_type AS patient_blood_type,
      doctors.name AS doctor_name,
      patients.phone_no AS patient_phone,
      patients.email AS patient_email
    FROM patients
    INNER JOIN doctors ON patients.doctor_id = doctors.id
    INNER JOIN lab_data ON lab_data.hn_number = patients.hn_number
    ORDER BY hn_number DESC;
  `;

  try {
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;