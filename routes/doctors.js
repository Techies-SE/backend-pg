const express = require("express");
const router = express.Router();
const { pool } = require("../db"); // Now using pg pool
const bcrypt = require("bcrypt");
const authenticateToken = require("../middleware/auth");
require("dotenv").config();
const upload = require("../middleware/upload_image");

// router.get("/recent-lab-tests", authenticateToken, async (req, res) => {
//   try {
//     console.log("1. Route hit");
//     console.log("2. User:", req.user);

//     const doctorId = req.user?.id;
//     if (!doctorId) {
//       return res.status(400).json({ error: "No doctor ID found" });
//     }

//     console.log("3. Doctor ID:", doctorId);

//     const { rows } = await pool.query(
//       `SELECT
//         p.name AS patient_name,
//         p.id AS patient_id,
//         p.hn_number,
//         ltm.test_name,
//         lt.lab_test_date,
//         lt.id AS lab_test_id
//       FROM
//         lab_tests lt
//       JOIN
//         lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
//       JOIN
//         patients p ON lt.patient_id = p.id
//       JOIN
//         patient_doctor pd ON pd.patient_id = p.id
//       WHERE
//         pd.doctor_id = $1
//       ORDER BY
//         lt.lab_test_date DESC
//       LIMIT 3`, // Simple test query first
//       [doctorId]
//     );

//     console.log("4. Query successful:", rows);

//     res.json({ success: true, doctorId, testData: rows });
//   } catch (error) {
//     console.error("Detailed error:", error.message, error.stack);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// Doctor Profile (Protected Route)
router.get("/profile", authenticateToken, async (req, res) => {
  if (req.user.role !== "doctor") {
    return res
      .status(403)
      .json({ error: "Access denied. Doctor role required" });
  }

  const doctorId = req.user.id;
  let client;

  try {
    client = await pool.connect();

    // Get doctor information (excluding password)
    const doctorResults = await client.query(
      `SELECT 
         id, name, phone_no, email, specialization, 
         status, department_id, registered_at, 
         updated_at, image
       FROM doctors 
       WHERE id = $1`,
      [doctorId]
    );

    if (doctorResults.rows.length === 0) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const doctor = doctorResults.rows[0];

    // Optionally get department information
    const departmentResults = await client.query(
      `SELECT name FROM departments WHERE id = $1`,
      [doctor.department_id]
    );

    // Optionally get appointment statistics
    const appointmentStats = await client.query(
      `SELECT 
         COUNT(*) as total_appointments,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_appointments
       FROM appointments 
       WHERE doctor_id = $1`,
      [doctorId]
    );

    const scheduleResults = await client.query(
      `SELECT id, day_of_week, start_time, end_time
       FROM doctor_schedules
       WHERE doctor_id = $1
       ORDER BY 
         CASE 
           WHEN day_of_week = 'Monday' THEN 1
           WHEN day_of_week = 'Tuesday' THEN 2
           WHEN day_of_week = 'Wednesday' THEN 3
           WHEN day_of_week = 'Thursday' THEN 4
           WHEN day_of_week = 'Friday' THEN 5
           WHEN day_of_week = 'Saturday' THEN 6
           WHEN day_of_week = 'Sunday' THEN 7
           ELSE 8
         END,
         start_time`,
      [doctorId]
    );

    res.json({
      message: "Doctor profile retrieved successfully",
      doctor: {
        ...doctor,
        department: departmentResults.rows[0]?.name || null,
        stats: {
          total_appointments: appointmentStats.rows[0]?.total_appointments || 0,
          completed_appointments:
            appointmentStats.rows[0]?.completed_appointments || 0,
        },
        schedules: scheduleResults.rows,
      },
    });
  } catch (err) {
    console.error("Doctor profile error:", err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (client) client.release();
  }
});

router.get("/patients-lab-tests", authenticateToken, async (req, res) => {
  const doctorId = req.user.id;
  try {
    const { rows } = await pool.query(
      `
      SELECT DISTINCT ON (p.hn_number, lt.lab_test_date::date)
      p.id AS patient_id,
      p.hn_number,
      p.name AS patient_name,
      lt.id AS lab_test_id,
      lt.doctor_id AS doctor_id,
      lt.lab_test_date AS test_date
      FROM patients p
      JOIN lab_tests lt ON lt.patient_id = p.id
      WHERE lt.doctor_id = $1
      ORDER BY p.hn_number, lt.lab_test_date::date DESC, lt.id DESC;



      `,
      [doctorId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching patients and lab tests:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get(
  "/pending-lab-results-count",
  authenticateToken,
  async (req, res) => {
    const doctorId = req.user.id;

    try {
      const { rows } = await pool.query(
        `
      SELECT 
      COUNT(DISTINCT r.id) AS pending_lab_results_count
      FROM 
      recommendations r
      JOIN 
      patients p ON r.hn_number = p.hn_number
      JOIN 
      patient_doctor pd ON pd.patient_id = p.id
      WHERE 
      r.status = 'pending' AND
      pd.doctor_id = $1

    `,
        [doctorId]
      );

      res.json({ success: true, count: rows[0].pending_lab_results_count });
    } catch (error) {
      console.error("Error fetching pending lab result count:", error);
      res.status(500).json({ success: false, error: "Internal Server Error" });
    }
  }
);

router.get("/:hn_number/lab-test", authenticateToken, async (req, res) => {
  const { hn_number } = req.params;

  try {
    const client = await pool.connect();

    const { rows } = await client.query(
      `
      SELECT
        p.hn_number,
        p.name,
        p.citizen_id,
        p.phone_no,
        p.lab_data_status,
        p.account_status,
        p.registered_at,
        p.updated_at,
  
        pd.gender,
        pd.blood_type,
        pd.age,
        pd.date_of_birth,
        pd.weight,
        pd.height,
        pd.bmi,
  
        lt.id AS lab_test_id,
        lt.lab_test_date,
        ltm.test_name,
  
        li.id AS lab_item_id,
        li.lab_item_name,
        li.unit,
        lr.lab_item_value,
        lr.lab_item_status,
        ref.normal_range,
        
        r.id,
        r.generated_recommendation,
        r.status AS recommendation_status,
        r.lab_test_date AS lab_test_date
  
      FROM patients p
      LEFT JOIN patient_data pd ON pd.hn_number = p.hn_number
      LEFT JOIN lab_tests lt ON lt.patient_id = p.id
      LEFT JOIN lab_tests_master ltm ON ltm.id = lt.lab_test_master_id
      LEFT JOIN lab_results lr ON lr.lab_test_id = lt.id
      LEFT JOIN lab_items li ON li.id = lr.lab_item_id
      LEFT JOIN lab_references ref ON ref.lab_item_id = li.id
	  LEFT JOIN recommendations r ON r.hn_number = p.hn_number
      
  
      WHERE p.hn_number = $1
      ORDER BY r.lab_test_date ASC;
      `,
      [hn_number]
    );

    client.release();

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for this patient and lab test" });
    }

    // Construct response
    const patient = {
      hn_number: rows[0].hn_number,
      name: rows[0].name,
      citizen_id: rows[0].citizen_id,
      phone_no: rows[0].phone_no,
      lab_data_status: rows[0].lab_data_status,
      account_status: rows[0].account_status,
      registered_at: rows[0].registered_at,
      updated_at: rows[0].updated_at,
      patient_data: {
        gender: rows[0].gender,
        blood_type: rows[0].blood_type,
        age: rows[0].age,
        date_of_birth: rows[0].date_of_birth,
        weight: rows[0].weight,
        height: rows[0].height,
        bmi: rows[0].bmi,
      },
      lab_test: {
        lab_test_id: rows[0].lab_test_id,
        lab_test_date: rows[0].lab_test_date,
        status: rows[0].lab_test_status,
        test_name: rows[0].test_name,
        recommendation_id: rows[0].id,
        generated_recommendation: rows[0].generated_recommendation,
        recommendation_status: rows[0].recommendation_status,
        recommendation_updated_at: rows[0].recommendation_updated_at,
        results: [],
      },
    };

    const resultMap = new Set();

    for (const row of rows) {
      if (row.lab_item_id && !resultMap.has(row.lab_item_id)) {
        patient.lab_test.results.push({
          lab_item_name: row.lab_item_name,
          lab_item_status: row.lab_item_status,
          unit: row.unit,
          value: row.lab_item_value,
          normal_range: row.normal_range,
        });
        resultMap.add(row.lab_item_id);
      }
    }

    res.json(patient);
  } catch (err) {
    console.error("Error fetching specific lab test details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/patient-count", authenticateToken, async (req, res) => {
  const doctorId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS patient_count
       FROM patient_doctor
       WHERE doctor_id = $1`,
      [doctorId]
    );

    res.json({
      doctor_id: doctorId,
      patient_count: rows[0].patient_count,
    });
  } catch (error) {
    console.error("Error fetching patient count:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/appointments-count", authenticateToken, async (req, res) => {
  const doctorId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS scheduled_appointment_count 
       FROM appointments 
       WHERE doctor_id = $1 AND status = 'scheduled'`,
      [doctorId]
    );

    res.json({
      doctor_id: doctorId,
      scheduled_appointment_count: rows[0].scheduled_appointment_count,
    });
  } catch (error) {
    console.error("Error fetching scheduled appointments count:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/pending-lab-results", authenticateToken, async (req, res) => {
  const doctorId = req.user.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
          lt.id AS lab_test_id,
          p.hn_number,
          p.name AS patient_name,
          
          lt.lab_test_date,
          ltm.test_name,
          
          MAX(li.lab_item_name) AS lab_item_name,
          MAX(li.unit) AS unit,
          
          MAX(lr.lab_item_value) AS lab_item_value,
          MAX(lr.lab_item_status) AS lab_item_status,
          
          r.id AS recommendation_id,
          r.status AS recommendation_status,
          r.updated_at AS recommendation_updated_at,
          
          d.id AS doctor_id,
          d.name AS doctor_name
          
      FROM 
          lab_tests lt
      JOIN 
          recommendations r ON r.lab_test_id = lt.id
      JOIN 
          patients p ON lt.patient_id = p.id
      LEFT JOIN 
          lab_results lr ON lr.lab_test_id = lt.id
      LEFT JOIN 
          lab_items li ON lr.lab_item_id = li.id
      JOIN 
          lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN 
          doctors d ON p.doctor_id = d.id
      WHERE 
          r.status = 'sent' AND
          d.id = $1
      GROUP BY 
          lt.id, p.hn_number, p.name, lt.lab_test_date, ltm.test_name, r.id, r.status, r.updated_at, d.id, d.name
      ORDER BY 
          r.updated_at DESC
    `,
      [doctorId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching pending lab results:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  const { name, phone_no, email, specialization, status, department_id } =
    req.body;

  try {
    const hashedPassword = await bcrypt.hash(phone_no, 10);

    const { rows } = await pool.query(
      `INSERT INTO doctors (name, phone_no, email, password, specialization, status, department_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        name,
        phone_no,
        email,
        hashedPassword,
        specialization,
        status,
        department_id,
      ]
    );

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM doctors");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  const doctorId = req.params.id;

  try {
    const { rows } = await pool.query("SELECT * FROM doctors WHERE id = $1", [
      doctorId,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Doctor not found" });
    }

    const doctor = rows[0];

    if (doctor.image) {
      // doctor.imageUrl = `http://localhost:3000/${doctor.image}`;
      const baseUrl =
        process.env.BASE_URL || "https://backend-pg-cm2b.onrender.com";
      doctor.imageUrl = `${baseUrl}/${doctor.image}`;
    }

    res.json(doctor);
  } catch (err) {
    console.error("Error fetching doctor:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM doctors WHERE id = $1", [req.params.id]);
    res.json({ message: "Doctor deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id", authenticateToken, async (req, res) => {
  const doctorId = req.params.id;
  const { name, phone_no, email } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push("name = $1");
    values.push(name);
  }

  if (phone_no !== undefined) {
    updates.push("phone_no = $2");
    values.push(phone_no);
  }

  if (email !== undefined) {
    updates.push("email = $3");
    values.push(email);
  }

  if (updates.length === 0) {
    return res
      .status(400)
      .json({ message: "No valid fields provided for update" });
  }

  updates.push("updated_at = NOW()");

  try {
    const client = await pool.connect();

    const query = `UPDATE doctors SET ${updates.join(", ")} WHERE id = $${
      values.length + 1
    }`;
    await client.query(query, [...values, doctorId]);

    client.release();
    res.json({ message: "Doctor information updated successfully" });
  } catch (err) {
    console.error("Error updating doctor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id/details", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
          doctors.id AS doctor_id,
          doctors.name AS doctor_name,
          doctors.specialization AS doctor_specialization,
          departments.name AS department,
          doctors.phone_no AS doctor_phone_no,
          doctors.email AS doctor_email,
          doctors.status AS status,
          patients.hn_number as hn_number,
          patients.name as patient_name,
          doctors.registered_at as registered_at,
          doctors.updated_at as updated_at
      FROM doctors
      INNER JOIN departments ON doctors.department_id = departments.id
      INNER JOIN patients ON doctors.id = patients.doctor_id
      WHERE doctors.id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH: Update doctor's schedule (partial update)
router.patch("/schedules/:id", authenticateToken, async (req, res) => {
  const doctorId = req.user.id;
  const scheduleId = req.params.id;
  const { day_of_week, start_time, end_time } = req.body;

  // Ensure at least one field is provided
  if (!day_of_week && !start_time && !end_time) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  let client;
  try {
    client = await pool.connect();

    // Check that schedule belongs to this doctor
    const check = await client.query(
      `SELECT id FROM doctor_schedules WHERE id = $1 AND doctor_id = $2`,
      [scheduleId, doctorId]
    );

    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Schedule not found or unauthorized" });
    }

    // Build dynamic SQL query for partial updates
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (day_of_week) {
      updates.push(`day_of_week = $${paramIndex++}`);
      values.push(day_of_week);
    }
    if (start_time) {
      updates.push(`start_time = $${paramIndex++}`);
      values.push(start_time);
    }
    if (end_time) {
      updates.push(`end_time = $${paramIndex++}`);
      values.push(end_time);
    }

    values.push(scheduleId);

    const query = `
      UPDATE doctor_schedules
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;

    const result = await client.query(query, values);

    res.status(200).json({
      message: "Schedule updated successfully",
      schedule: result.rows[0],
    });
  } catch (err) {
    console.error("Update schedule error:", err);
    res.status(500).json({ error: "Database error while updating schedule" });
  } finally {
    if (client) client.release();
  }
});

// DELETE: Remove doctor's schedule
router.delete("/schedules/:id", authenticateToken, async (req, res) => {
  const doctorId = req.user.id;
  const scheduleId = req.params.id;

  let client;
  try {
    client = await pool.connect();

    // Verify ownership
    const check = await client.query(
      `SELECT id FROM doctor_schedules WHERE id = $1 AND doctor_id = $2`,
      [scheduleId, doctorId]
    );

    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Schedule not found or unauthorized" });
    }

    // Delete the schedule
    await client.query(`DELETE FROM doctor_schedules WHERE id = $1`, [
      scheduleId,
    ]);

    res.status(200).json({ message: "Schedule deleted successfully" });
  } catch (err) {
    console.error("Delete schedule error:", err);
    res.status(500).json({ error: "Database error while deleting schedule" });
  } finally {
    if (client) client.release();
  }
});

// POST: Add a new schedule for the logged-in doctor
router.post("/schedules", authenticateToken, async (req, res) => {
  const doctorId = req.user.id;
  const { day_of_week, start_time, end_time } = req.body;

  // Validate input
  if (!day_of_week || !start_time || !end_time) {
    return res
      .status(400)
      .json({ error: "day_of_week, start_time, and end_time are required" });
  }

  let client;
  try {
    client = await pool.connect();

    // Optional: check for duplicate schedule (same day & time)
    const duplicateCheck = await client.query(
      `SELECT id 
       FROM doctor_schedules 
       WHERE doctor_id = $1 AND day_of_week = $2 AND start_time = $3 AND end_time = $4`,
      [doctorId, day_of_week, start_time, end_time]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(400).json({ error: "This schedule already exists" });
    }

    // Insert new schedule
    const insertResult = await client.query(
      `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *;`,
      [doctorId, day_of_week, start_time, end_time]
    );

    res.status(201).json({
      message: "Schedule added successfully",
      schedule: insertResult.rows[0],
    });
  } catch (err) {
    console.error("Add schedule error:", err);
    res.status(500).json({ error: "Database error while adding schedule" });
  } finally {
    if (client) client.release();
  }
});

// PATCH: doctor profile picture upload
// Doctor uploads/updates profile picture
router.patch(
  "/upload-profile",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    const doctorId = req.user.id;
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided." });
    }

    const imageUrl = req.file.path; // Cloudinary URL
    const publicId = req.file.filename; // Cloudinary public_id (if needed for future deletions)

    try {
      const { rowCount } = await pool.query(
        `
        UPDATE doctors
        SET image = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, email, image;
        `,
        [imageUrl, doctorId]
      );

      if (!rowCount) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      res.status(200).json({
        message: "Doctor profile image updated successfully",
        imageUrl,
      });
    } catch (err) {
      console.error("Error updating doctor image:", err);
      res.status(500).json({ error: "Database error while updating image" });
    }
  }
);

module.exports = router;
