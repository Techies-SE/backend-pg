const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const authenticateToken = require("../middleware/auth");

router.get("/active-appointments", authenticateToken, async (req, res) => {
  try {
    const { rows: result } = await pool.query(
      `SELECT COUNT(id) AS active_appointment
        FROM appointments
        WHERE status = 'scheduled'
        AND appointment_date >= date_trunc('week', CURRENT_DATE)
        AND appointment_date < date_trunc('week', CURRENT_DATE) + interval '1 week';`
    );
    res.json({ total_appointments: result[0].total });
  } catch (error) {
    console.error("Error fetching active apointments:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/active-patients", authenticateToken, async (req, res) => {
  try {
    const { rows: result } = await pool.query(
      `SELECT COUNT(id) AS active_patient
        FROM patients`
    );
    res.json({ active_patients: result[0].total });
  } catch (error) {
    console.error("Error fetching active patients:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/active-doctors", authenticateToken, async (req, res) => {
  try {
    const { rows: result } = await pool.query(
      `SELECT COUNT(id) AS total_doctor
        FROM doctors 
        WHERE status = 'active'`
    );
    res.json({ total_doctors: result[0].total });
  } catch (error) {
    console.error("Error fetching active doctors:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/active-departments", authenticateToken, async (req, res) => {
  try {
    const { rows: result } = await pool.query(
      `SELECT count(id) AS total_departments
        FROM departments`
    );
    res.json({ total_departments: result[0].total });
  } catch (error) {
    console.error("Error fetching active departments:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/activity", async (req, res) => {
  const query = `
    SELECT 'Appointment' AS type,
           'New appointment booked' AS description,
           p.name AS user_name,
           a.created_at
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    WHERE a.status = 'pending'

    UNION ALL

    SELECT 'Patient' AS type,
           'New patient registered' AS description,
           p.name AS user_name,
           p.registered_at AS created_at
    FROM patients p

    UNION ALL 

    SELECT 'Doctor' AS type,
           'New doctor registered' AS description,
           d.name AS user_name,
           d.registered_at AS created_at
    FROM doctors d

    UNION ALL

    SELECT 'Department' AS type,
           'New department registered' AS description,
           dp.name AS user_name,
           dp.created_at AS created_at
    FROM departments dp

    ORDER BY created_at DESC
    LIMIT 10;
  `;

  try {
    const result = await pool(query);
    res.json(result); // return as JSON to frontend
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
