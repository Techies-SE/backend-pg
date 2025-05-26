const express = require("express");
const router = express.Router();
const pool = require("../db"); // promise-based connection pool (now for PostgreSQL)
const authenticateToken = require("../middleware/auth");

// GET all doctors with their department
router.get("/", authenticateToken, async (req, res) => {
  try {
    // PostgreSQL uses $1, $2 etc. for parameters and returns results differently
    const { rows } = await pool.query(
      `SELECT
        doctors.id AS doctor_id,
        doctors.name AS doctor_name,
        doctors.specialization AS doctor_specialization,
        departments.name AS department,
        doctors.phone_no AS doctor_phone_no,
        doctors.email AS doctor_email,
        doctors.status AS status
      FROM doctors
      INNER JOIN departments ON doctors.department_id = departments.id
      ORDER BY doctor_id ASC;`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET doctor details by ID
router.get("/:id/details", async (req, res) => {
  try {
    // Note the $1 parameter placeholder instead of ?
    const { rows } = await pool.query(
      `SELECT
        doctors.id AS doctor_id,
        doctors.name AS doctor_name,
        doctors.specialization AS doctor_specialization,
        departments.name AS department,
        doctors.phone_no AS doctor_phone_no,
        doctors.email AS doctor_email,
        doctors.status AS status,
        doctors.registered_at AS registered_at,
        doctors.updated_at AS updated_at
      FROM doctors
      INNER JOIN departments ON doctors.department_id = departments.id
      WHERE doctors.id = $1;`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;