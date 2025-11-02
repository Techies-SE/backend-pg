const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const authenticateToken = require("../middleware/auth");

// Patient Profile (Protected Route)
router.get("/profile", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  let client;
  try {
    client = await pool.connect();

    const { rows: patientResults } = await client.query(
      `SELECT id, hn_number, name, citizen_id, phone_no, lab_data_status, account_status 
       FROM patients 
       WHERE id = $1`,
      [userId]
    );

    if (patientResults.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const patient = patientResults[0];

    const { rows: labResults } = await client.query(
      `SELECT gender, blood_type, age, date_of_birth, weight, height, bmi 
       FROM patient_data 
       WHERE hn_number = $1`,
      [patient.hn_number]
    );

    // Parse float values for height, weight, bmi
    const parsedLabResults = labResults.map((item) => ({
      ...item,
      weight: item.weight !== null ? Number(item.weight) * 1.0 : null,
      height: item.height !== null ? Number(item.height) * 1.0 : null,
      bmi: item.bmi !== null ? Number(item.bmi) * 1.0 : null,
    }));

    res.json({
      message: "Welcome to your profile",
      user: {
        id: patient.id,
        hn_number: patient.hn_number,
        name: patient.name,
        citizen_id: patient.citizen_id,
        phone_no: patient.phone_no,
        lab_data_status: patient.lab_data_status,
        account_status: patient.account_status,
        lab_data: parsedLabResults.length > 0 ? labResults : [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
  }
});

// Patient makes an appointment (Protected Route)
router.post(
  "/appointments/confirmation",
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { doctor_id, appointment_date, appointment_time, notes } = req.body;

    try {
      if (!doctor_id || !appointment_date || !appointment_time) {
        return res.status(400).json({ message: "All fields are required." });
      }

      // Find patient by hn_number
      const { rows: patientRows } = await pool.query(
        "SELECT id FROM patients WHERE id = $1",
        [userId]
      );

      if (patientRows.length === 0) {
        return res.status(404).json({ message: "Patient not found." });
      }

      const patient_id = patientRows[0].id;

      // Insert new appointment
      const { rows: insertResult } = await pool.query(
        "INSERT INTO appointments (doctor_id, appointment_date, appointment_time, status, notes, patient_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [
          doctor_id,
          appointment_date,
          appointment_time,
          "pending",
          notes,
          patient_id,
        ]
      );

      res.status(201).json({
        message: "Appointment confirmed successfully!",
        appointment_id: insertResult[0].id,
      });
    } catch (error) {
      console.error("Error confirming appointment:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

// Patient's Appointments (Protected Route)
router.get("/appointments", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await pool.query(
      `SELECT a.patient_id,
        COUNT(a.id) AS total_appointments,
        json_agg(
            json_build_object(
                'id', a.id,
                'appointment_date', a.appointment_date,
                'appointment_time', a.appointment_time,
                'specialization', d.specialization,
                'status', a.status,
                'doctor', d.name,
                'doctor_id', d.id
            )
        ) AS appointments
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.patient_id = $1
      GROUP BY a.patient_id`,
      [userId]
    );

    if (rows.length === 0) {
      return res.json({
        patient_id: userId,
        total_appointments: 0,
        appointments: [],
      });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Patient Confirm for Rescheduled-By-Admin Appointments (Protected Route)
router.put(
  "/appointments/:appointmentId/confirm",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      // First, verify this appointment belongs to this patient and is in Rescheduled status
      const { rows: appointment } = await pool.query(
        `SELECT * FROM appointments WHERE id = $1 AND patient_id = $2 AND status = 'rescheduled'`,
        [req.params.appointmentId, userId]
      );

      if (appointment.length === 0) {
        return res.status(404).json({
          message: "Appointment not found or not eligible for confirmation",
        });
      }

      // Update the appointment status to Scheduled
      await pool.query(
        `UPDATE appointments SET status = 'scheduled' WHERE id = $1`,
        [req.params.appointmentId]
      );

      res.json({
        message: "Appointment confirmed successfully",
        appointment_id: req.params.appointmentId,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// Patient Cancel for Rescheduled-By-Admin appointments (Protected Route)
router.put(
  "/appointments/:appointmentId/cancel",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;

      // First, verify this appointment belongs to this patient
      const { rows: appointment } = await pool.query(
        `SELECT * FROM appointments WHERE id = $1 AND patient_id = $2`,
        [req.params.appointmentId, userId]
      );

      if (appointment.length === 0) {
        return res.status(404).json({
          message: "Appointment not found or not eligible for cancellation",
        });
      }

      // Update the appointment status to Scheduled
      await pool.query(
        `UPDATE appointments SET status = 'canceled' WHERE id = $1`,
        [req.params.appointmentId]
      );

      res.json({
        message: "Appointment confirmed successfully",
        appointment_id: req.params.appointmentId,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// A Patient's Lab Tests Collections (Protected Route)
router.get("/lab-tests", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        lt.id AS lab_test_id,
        lt.lab_test_date,
        ltm.test_name
      FROM lab_tests lt
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      WHERE lt.patient_id = $1
      ORDER BY lt.lab_test_date DESC
    `,
      [userId]
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching lab tests for patient:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// new route for lab test list
router.get("/labtests", authenticateToken, async (req, res) => {
  const userId = req.user.id; // patient_id

  try {
    const query = `
      SELECT 
        lt.lab_test_date,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', lt.id,
            'test_name', ltm.test_name,
            'doctor_id', lt.doctor_id,
            'doctor_name', d.name
          )
        ) AS lab_tests
      FROM lab_tests lt
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN doctors d ON lt.doctor_id = d.id
      WHERE lt.patient_id = $1
      GROUP BY lt.lab_test_date
      ORDER BY lt.lab_test_date DESC;
    `;

    const { rows } = await pool.query(query, [userId]);

    res.status(200).json({
      success: true,
      data: rows, // [{ lab_test_date, lab_tests: [ {...}, {...} ] }]
    });
  } catch (error) {
    console.error("Error fetching grouped lab tests for patient:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// new route for lab test details + recommendations
router.get(
  "/lab-test/:hn_number/:lab_test_date",
  authenticateToken,
  async (req, res) => {
    const { hn_number, lab_test_date } = req.params;

    try {
      const query = `
      SELECT 
        lt.lab_test_date,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'lab_test_date', lt.lab_test_date::date,
            'id', lt.id,
            'test_name', ltm.test_name,
            'doctor_id', lt.doctor_id,
            'doctor_name', d.name,
            'doctor_recommendation', r.doctor_recommendation,
            'generated_recommendation', r.generated_recommendation,
            'lab_items', (
              SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                  'lab_item_name', li.lab_item_name,
                  'lab_item_value', lr.lab_item_value,
                  'lab_item_status', lr.lab_item_status,
                  'unit', li.unit,
                  'normal_range', lref.normal_range
                )
              )
              FROM lab_results lr
              JOIN lab_items li ON lr.lab_item_id = li.id
              LEFT JOIN lab_references lref ON li.id = lref.lab_item_id
              WHERE lr.lab_test_id = lt.id
            )
          )
        ) AS lab_tests
      FROM lab_tests lt
      JOIN doctors d ON lt.doctor_id = d.id
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      LEFT JOIN recommendations r 
        ON r.hn_number = lt.hn_number 
        AND r.lab_test_date::date = lt.lab_test_date::date
      WHERE lt.hn_number = $1
        AND lt.lab_test_date::date = $2
      GROUP BY lt.lab_test_date
      ORDER BY lt.lab_test_date DESC;
    `;

      const { rows } = await pool.query(query, [hn_number, lab_test_date]);

      res.status(200).json({
        success: true,
        data: rows[0] || {}, // return the single date object or empty
      });
    } catch (error) {
      console.error("Error fetching detailed lab tests:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// Lab Items contained in each Patient's Lab Test (Protected Route)
router.get(
  "/lab-tests/:lab_test_id/lab-test-items",
  authenticateToken,
  async (req, res) => {
    const { lab_test_id } = req.params;

    try {
      const { rows } = await pool.query(
        `
      SELECT 
        li.id AS lab_item_id,
        li.lab_item_name,
        li.unit,
        ref.normal_range,
        lr.lab_item_value,
        lr.lab_item_status,
        lt.lab_test_date
      FROM lab_results lr
      JOIN lab_items li ON lr.lab_item_id = li.id
      JOIN lab_references ref ON ref.lab_item_id = li.id
      JOIN lab_tests lt ON lr.lab_test_id = lt.id
      WHERE lr.lab_test_id = $1
    `,
        [lab_test_id]
      );

      res.status(200).json({ success: true, data: rows });
    } catch (error) {
      console.error("Error fetching lab items:", error);
      res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }
);

// Recommendation (Protected Route)
router.get("/recommendations", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        r.id AS recommendation_id,
        r.lab_test_date,
        r.generated_recommendation,
        d.name AS doctor_name
      FROM recommendations r
      JOIN doctors d ON r.doctor_id = d.id
      WHERE r.status = 'approved'
    `
    );

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get all patients
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM patients");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a patient
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM patients WHERE id = $1", [req.params.id]);
    res.json({ message: "Patient deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a patient
router.post("/", authenticateToken, async (req, res) => {
  const { hn_number, name, citizen_id, phone_no, date_of_birth, gender } =
    req.body;

  // Validate required fields
  if (
    !hn_number ||
    !name ||
    !citizen_id ||
    !phone_no ||
    !date_of_birth ||
    !gender
  ) {
    return res.status(400).json({ error: "All fields are required." });
  }
  // Validate gender
  if (!["male", "female"].includes(gender.toLowerCase())) {
    return res
      .status(400)
      .json({ error: "Gender must be 'male' or 'female'." });
  }
  // Validate date format (basic check)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date_of_birth)) {
    return res
      .status(400)
      .json({ error: "Date of birth must be in YYYY-MM-DD format." });
  }

  try {
    // Get a connection from the pool
    const client = await pool.connect();

    try {
      // Start transaction
      await client.query("BEGIN");

      let patientId;
      let isNewPatient = false;

      // Check if patient already exists
      const { rows: existingPatients } = await client.query(
        "SELECT * FROM patients WHERE hn_number = $1 OR citizen_id = $2",
        [hn_number, citizen_id]
      );

      // Check for patient existence and potential conflicts
      if (existingPatients.length > 0) {
        const existingPatient = existingPatients[0];

        // Check for citizen_id conflict with different HN number
        if (
          existingPatient.hn_number !== hn_number &&
          existingPatient.citizen_id === citizen_id
        ) {
          return res.status(409).json({
            error: `Citizen ID ${citizen_id} already exists with different HN number ${existingPatient.hn_number}`,
          });
        }

        // Check for HN number conflict with different citizen_id
        if (
          existingPatient.hn_number === hn_number &&
          existingPatient.citizen_id !== citizen_id
        ) {
          return res.status(409).json({
            error: `HN number ${hn_number} already exists with different Citizen ID`,
          });
        }
        // Patient exists with matching HN and citizen_id - update their info
        patientId = existingPatient.id;
        // Update patient basic info
        await client.query(
          `UPDATE patients SET name = $1, phone_no = $2 WHERE id = $3`,
          [name, phone_no, patientId]
        );
        // Update or insert patient_data
        const { rows: existingData } = await client.query(
          "SELECT * FROM patient_data WHERE hn_number = $1",
          [hn_number]
        );

        if (existingData.length > 0) {
          await client.query(
            `UPDATE patient_data SET date_of_birth = $1, gender = $2 WHERE hn_number = $3`,
            [date_of_birth, gender.toLowerCase(), hn_number]
          );
        } else {
          await client.query(
            `INSERT INTO patient_data (hn_number, date_of_birth, gender) VALUES ($1, $2, $3)`,
            [hn_number, date_of_birth, gender.toLowerCase()]
          );
        }

        console.log(`Updated existing patient with HN ${hn_number}`);
      } else {
        isNewPatient = true;
        // Patient doesn't exist, create new patient
        const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);
        const registered_at = new Date();
        // Insert into patients table
        const { rows: patientInsertResult } = await client.query(
          `INSERT INTO patients 
           (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, registered_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [
            hn_number,
            name,
            citizen_id,
            phone_no,
            hashedPassword,
            false,
            false,
            registered_at,
          ]
        );

        patientId = patientInsertResult[0].id;

        // INSERT into patient_data table
        await client.query(
          `INSERT INTO patient_data (hn_number, date_of_birth, gender) VALUES ($1, $2, $3)`,
          [hn_number, date_of_birth, gender]
        );

        console.log(`Created new patient with HN ${hn_number}`);
      }

      // Commit transaction
      await client.query("COMMIT");

      res.status(isNewPatient ? 201 : 200).json({
        message: isNewPatient
          ? "Patient created successfully."
          : "Patient updated successfully.",
        patientId: patientId,
      });
    } catch (error) {
      // Rollback in case of error
      await client.query("ROLLBACK");
      throw error;
    } finally {
      // Always release the connection
      client.release();
    }
  } catch (error) {
    console.error("Error processing patient request:", error);
    res.status(500).json({ error: error.message });
  }
});

// View details of a patient
router.get("/:hn_number", authenticateToken, async (req, res) => {
  const hn_number = req.params.hn_number;

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
  
          a.id AS appointment_id,
          a.appointment_date,
          a.appointment_time,
          a.notes,
          a.status,
          d.name AS doctor_name,
          dept.name AS department_name
  
        FROM patients p
        LEFT JOIN patient_data pd ON pd.hn_number = p.hn_number
        LEFT JOIN lab_tests lt ON lt.patient_id = p.id
        LEFT JOIN lab_tests_master ltm ON ltm.id = lt.lab_test_master_id
        LEFT JOIN lab_results lr ON lr.lab_test_id = lt.id
        LEFT JOIN lab_items li ON li.id = lr.lab_item_id
        LEFT JOIN lab_references ref ON ref.lab_item_id = li.id
  
        LEFT JOIN appointments a ON a.patient_id = p.id
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN departments dept ON dept.id = d.department_id
  
        WHERE p.hn_number = $1
        ORDER BY lt.lab_test_date DESC, a.appointment_date DESC
        `,
      [hn_number]
    );

    client.release();

    if (rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Build a structured JSON response
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
      lab_tests: [],
      appointments: [],
    };

    const labTestMap = new Map();
    const appointmentSet = new Set();

    for (const row of rows) {
      // Group Lab Tests
      if (row.lab_test_id && !labTestMap.has(row.lab_test_id)) {
        labTestMap.set(row.lab_test_id, {
          lab_test_date: row.lab_test_date,
          status: row.lab_test_status,
          test_name: row.test_name,
          results: [],
          resultMap: new Set(), // Track added lab_item_id to avoid duplicates
        });
      }

      if (row.lab_test_id && row.lab_item_id) {
        const labTest = labTestMap.get(row.lab_test_id);
        if (!labTest.resultMap.has(row.lab_item_id)) {
          labTest.results.push({
            lab_item_name: row.lab_item_name,
            lab_item_status: row.lab_item_status,
            unit: row.unit,
            value: row.lab_item_value,
            normal_range: row.normal_range,
          });
          labTest.resultMap.add(row.lab_item_id);
        }
      }

      // Group Appointments
      if (row.appointment_id && !appointmentSet.has(row.appointment_id)) {
        appointmentSet.add(row.appointment_id);
        patient.appointments.push({
          appointment_date: row.appointment_date,
          appointment_time: row.appointment_time,
          status: row.status,
          note: row.note,
          doctor: {
            name: row.doctor_name,
            department: row.department_name,
          },
        });
      }
    }

    patient.lab_tests = Array.from(labTestMap.values()).map(
      ({ resultMap, ...rest }) => rest
    );
    res.json(patient);
  } catch (err) {
    console.error("Error fetching patient details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

//View detials of a patient by hn_number and group by lab_test_id and date
router.get("/:hn_number/:lab_test_id", authenticateToken, async (req, res) => {
  const { hn_number, lab_test_id } = req.params;

  try {
    const client = await pool.connect();

    // First, get the main lab test details
    const mainTestQuery = await client.query(
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
          ref.normal_range

        FROM patients p
        LEFT JOIN patient_data pd ON pd.hn_number = p.hn_number
        LEFT JOIN lab_tests lt ON lt.patient_id = p.id
        LEFT JOIN lab_tests_master ltm ON ltm.id = lt.lab_test_master_id
        LEFT JOIN lab_results lr ON lr.lab_test_id = lt.id
        LEFT JOIN lab_items li ON li.id = lr.lab_item_id
        LEFT JOIN lab_references ref ON ref.lab_item_id = li.id

        WHERE p.hn_number = $1 AND lt.id = $2
        ORDER BY lt.lab_test_date DESC
      `,
      [hn_number, lab_test_id]
    );

    if (mainTestQuery.rows.length === 0) {
      client.release();
      return res.status(404).json({
        message: "No lab test data found for given HN and Lab Test ID",
      });
    }

    // Get the test date from the main lab test
    const testDate = mainTestQuery.rows[0].lab_test_date;

    // Get all other lab tests from the same date for this patient
    const sameDayTestsQuery = await client.query(
      `
        SELECT
          lt.id AS lab_test_id,
          lt.lab_test_date,
          ltm.test_name,

          li.id AS lab_item_id,
          li.lab_item_name,
          li.unit,
          lr.lab_item_value,
          lr.lab_item_status,
          ref.normal_range

        FROM patients p
        LEFT JOIN lab_tests lt ON lt.patient_id = p.id
        LEFT JOIN lab_tests_master ltm ON ltm.id = lt.lab_test_master_id
        LEFT JOIN lab_results lr ON lr.lab_test_id = lt.id
        LEFT JOIN lab_items li ON li.id = lr.lab_item_id
        LEFT JOIN lab_references ref ON ref.lab_item_id = li.id

        WHERE p.hn_number = $1 
        AND DATE(lt.lab_test_date) = DATE($2)
        AND lt.id != $3
        ORDER BY lt.id, li.lab_item_name
      `,
      [hn_number, testDate, lab_test_id]
    );

    // Get recommendations for this patient on this specific date
    const recommendationsQuery = await client.query(
      `
        SELECT
          r.id AS recommendation_id,
          r.generated_recommendation,
          r.status,
          r.doctor_recommendation
        FROM patients p
        LEFT JOIN recommendations r ON r.hn_number = p.hn_number
        WHERE p.hn_number = $1 
        AND DATE(r.lab_test_date) = DATE($2)
        ORDER BY r.lab_test_date DESC
      `,
      [hn_number, testDate]
    );

    client.release();

    // Build the main lab test response
    const patient = {
      hn_number: mainTestQuery.rows[0].hn_number,
      name: mainTestQuery.rows[0].name,
      citizen_id: mainTestQuery.rows[0].citizen_id,
      phone_no: mainTestQuery.rows[0].phone_no,
      lab_data_status: mainTestQuery.rows[0].lab_data_status,
      account_status: mainTestQuery.rows[0].account_status,
      registered_at: mainTestQuery.rows[0].registered_at,
      updated_at: mainTestQuery.rows[0].updated_at,
      patient_data: {
        gender: mainTestQuery.rows[0].gender,
        blood_type: mainTestQuery.rows[0].blood_type,
        age: mainTestQuery.rows[0].age,
        date_of_birth: mainTestQuery.rows[0].date_of_birth,
        weight: mainTestQuery.rows[0].weight,
        height: mainTestQuery.rows[0].height,
        bmi: mainTestQuery.rows[0].bmi,
      },
      lab_test: {
        id: mainTestQuery.rows[0].lab_test_id,
        test_name: mainTestQuery.rows[0].test_name,
        lab_test_date: mainTestQuery.rows[0].lab_test_date,
        results: [],
      },
      other_tests_same_day: [], // New field for other tests on the same day
      recommendations: [], // New field for recommendations on the same date
    };

    // Process main test results
    const mainResultSet = new Set();
    for (const row of mainTestQuery.rows) {
      if (row.lab_item_id && !mainResultSet.has(row.lab_item_id)) {
        patient.lab_test.results.push({
          lab_item_name: row.lab_item_name,
          unit: row.unit,
          value: row.lab_item_value,
          lab_item_status: row.lab_item_status,
          normal_range: row.normal_range,
        });
        mainResultSet.add(row.lab_item_id);
      }
    }

    // Process other tests from the same day
    if (sameDayTestsQuery.rows.length > 0) {
      const testGroups = {};

      // Group results by test ID
      sameDayTestsQuery.rows.forEach((row) => {
        if (!testGroups[row.lab_test_id]) {
          testGroups[row.lab_test_id] = {
            id: row.lab_test_id,
            test_name: row.test_name,
            lab_test_date: row.lab_test_date,
            results: [],
          };
        }

        if (row.lab_item_id) {
          testGroups[row.lab_test_id].results.push({
            lab_item_name: row.lab_item_name,
            unit: row.unit,
            value: row.lab_item_value,
            lab_item_status: row.lab_item_status,
            normal_range: row.normal_range,
          });
        }
      });

      // Convert grouped tests to array
      patient.other_tests_same_day = Object.values(testGroups);
    }

    // Process recommendations from the same date
    if (recommendationsQuery.rows.length > 0) {
      patient.recommendations = recommendationsQuery.rows.map((row) => ({
        id: row.recommendation_id,
        generated_recommendation: row.generated_recommendation,
        status: row.status,
        doctor_recommendation: row.doctor_recommendation,
      }));
    }

    res.json(patient);
  } catch (err) {
    console.error("Error fetching lab test details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get(
  "/:hn_number/:lab_test_date",
  authenticateToken,
  async (req, res) => {
    const { hn_number, lab_test_date } = req.params;

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
    ref.normal_range

  FROM patients p
  LEFT JOIN patient_data pd ON pd.hn_number = p.hn_number
  LEFT JOIN lab_tests lt ON lt.patient_id = p.id
  LEFT JOIN lab_tests_master ltm ON ltm.id = lt.lab_test_master_id
  LEFT JOIN lab_results lr ON lr.lab_test_id = lt.id
  LEFT JOIN lab_items li ON li.id = lr.lab_item_id
  LEFT JOIN lab_references ref ON ref.lab_item_id = li.id

  WHERE p.hn_number = $1
    AND lt.lab_test_date >= $2::date
    AND lt.lab_test_date < ($2::date + INTERVAL '1 day')
  ORDER BY lt.lab_test_date DESC
  `,
        [hn_number, lab_test_date]
      );

      client.release();

      if (rows.length === 0) {
        return res.status(404).json({
          message: "No lab test data found for given HN and date",
        });
      }

      // Build structured JSON response
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
        lab_tests: [],
      };

      // Group by lab_test_id
      const labTestsMap = new Map();

      for (const row of rows) {
        if (!labTestsMap.has(row.lab_test_id)) {
          labTestsMap.set(row.lab_test_id, {
            id: row.lab_test_id,
            test_name: row.test_name,
            lab_test_date: row.lab_test_date,
            results: [],
          });
        }

        if (row.lab_item_id) {
          labTestsMap.get(row.lab_test_id).results.push({
            lab_item_name: row.lab_item_name,
            unit: row.unit,
            value: row.lab_item_value,
            lab_item_status: row.lab_item_status,
            normal_range: row.normal_range,
          });
        }
      }

      patient.lab_tests = Array.from(labTestsMap.values());

      res.json(patient);
    } catch (err) {
      console.error("Error fetching lab test details:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Edit details of a patient
router.put("/:hn_number", authenticateToken, async (req, res) => {
  const hn_number = req.params.hn_number;
  console.log("Updating patient:", hn_number);
  const {
    name,
    citizen_id,
    phone_no,
    gender,
    blood_type,
    age,
    date_of_birth,
    weight,
    height,
    bmi,
  } = req.body;
  console.log("Update payload:", req.body);

  try {
    const client = await pool.connect();

    // Update patients table
    await client.query(
      `
        UPDATE patients
        SET name = $1, citizen_id = $2, phone_no = $3, updated_at = NOW()
        WHERE hn_number = $4
        `,
      [name, citizen_id, phone_no, hn_number]
    );

    // Check if patient_data exists
    const { rows: existingData } = await client.query(
      "SELECT id FROM patient_data WHERE hn_number = $1",
      [hn_number]
    );

    if (existingData.length > 0) {
      // Update patient_data table
      await client.query(
        `
          UPDATE patient_data
          SET gender = $1, blood_type = $2, age = $3, date_of_birth = $4, weight = $5, height = $6, bmi = $7
          WHERE hn_number = $8
          `,
        [gender, blood_type, age, date_of_birth, weight, height, bmi, hn_number]
      );
    } else {
      // Insert into patient_data if it doesn't exist
      await client.query(
        `
          INSERT INTO patient_data (hn_number, gender, blood_type, age, date_of_birth, weight, height, bmi)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
        [hn_number, gender, blood_type, age, date_of_birth, weight, height, bmi]
      );
    }

    client.release();

    res.json({ message: "Patient data updated successfully" });
  } catch (err) {
    console.error("Error updating patient:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get a patient by ID
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM patients WHERE id = $1", [
      req.params.id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ message: "Patient not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a patient by ID and inner join lab-data --- patients --- doctors
router.get("/:id/details", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        patients.id AS patient_id,
        patients.name AS patient_name,
        patients.hn_number AS hn_number,
        lab_data.age AS patient_age,
        lab_data.date_of_birth AS DOB,
        lab_data.gender AS patient_gender,
        lab_data.blood_type AS patient_blood_type,
        lab_data.weight AS patient_weight,
        lab_data.height AS patient_height,
        lab_data.bmi AS patient_bmi,
        lab_data.systolic AS patient_systolic,
        lab_data.diastolic AS patient_diastolic,
        lab_data.order_date AS order_date,
        doctors.name AS doctor_name,
        patients.phone_no AS patient_phone,
        patients.email AS patient_email,
        patients.registered_at AS registered_at,
        patients.updated_at AS updated_at
      FROM patients
      INNER JOIN doctors ON patients.doctor_id = doctors.id
      INNER JOIN lab_data ON lab_data.hn_number = patients.hn_number
      WHERE patients.id = $1`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Patient reschedules an appointment
router.patch("/:appointmentId/reschedule", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { doctor_id, hn_number, appointment_date, appointment_time } =
      req.body;

    // Step 1: Verify that the appointment belongs to the patient and matches doctor_id
    const { rows: existingAppointments } = await pool.query(
      `SELECT * FROM appointments WHERE id = $1 AND hn_number = $2 AND doctor_id = $3`,
      [appointmentId, hn_number, doctor_id]
    );

    if (existingAppointments.length === 0) {
      return res.status(404).json({
        message: "Appointment not found or access denied",
      });
    }

    const currentAppointment = existingAppointments[0];

    // Step 2: Check if appointment_date or appointment_time is changing
    const isDateChanged =
      appointment_date &&
      appointment_date !== currentAppointment.appointment_date;
    const isTimeChanged =
      appointment_time &&
      appointment_time !== currentAppointment.appointment_time;

    if (!isDateChanged && !isTimeChanged) {
      return res.status(400).json({
        message: "No changes detected in appointment date or time",
      });
    }

    // Step 3: Update the appointment with new values and set status to Pending
    await pool.query(
      `UPDATE appointments 
       SET appointment_date = $1, appointment_time = $2, status = 'pending' 
       WHERE id = $3`,
      [
        appointment_date || currentAppointment.appointment_date,
        appointment_time || currentAppointment.appointment_time,
        appointmentId,
      ]
    );

    res.json({
      message: "Appointment rescheduled successfully. Status set to Pending.",
      appointmentId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a patient with lab test and lab test items
router.get("/id=:id/lab-results", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        lt.hn_number,
        lt.id AS lab_test_id,
        lt.lab_test_name,
        lt.lab_test_date,
        lti.lab_item_name,
        lti.lab_item_normal_ref_value,
        lti.lab_item_value,
        lti.lab_item_status,
        lti.lab_item_recommendation
      FROM lab_tests lt
      LEFT JOIN lab_test_items lti ON lt.id = lti.lab_test_id
      WHERE lt.hn_number = $1`,
      [req.params.id]
    );

    if (rows.length === 0)
      return res.status(404).json({ message: "No Lab Data Found" });

    const response = {
      hn_number: req.params.id,
      total_lab_test: 0,
      lab_test: [],
    };

    const labTestsMap = new Map();

    rows.forEach((row) => {
      if (!labTestsMap.has(row.lab_test_id)) {
        labTestsMap.set(row.lab_test_id, {
          name: row.lab_test_name,
          date: row.lab_test_date,
          items: [],
        });
      }

      if (row.lab_item_name) {
        labTestsMap.get(row.lab_test_id).items.push({
          name: row.lab_item_name,
          normal_reference_value: row.lab_item_normal_ref_value,
          value: row.lab_item_value,
          result: row.lab_item_status,
          recommendation: row.lab_item_recommendation,
        });
      }
    });

    response.lab_test = Array.from(labTestsMap.values());
    response.total_lab_test = response.lab_test.length;

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a patient
router.put("/:id", async (req, res) => {
  const { name, citizen_id, phone_no, email, password, status, doctor_id } =
    req.body;

  try {
    await pool.query(
      `UPDATE patients SET name = $1, citizen_id = $2, phone_no = $3, email = $4, password = $5, status = $6, doctor_id = $7 WHERE id = $8`,
      [
        name,
        citizen_id,
        phone_no,
        email,
        password,
        status,
        doctor_id,
        req.params.id,
      ]
    );
    res.json({ message: "Patient updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get completed lab tests for web app
router.get("/details/:hnNumber", async (req, res) => {
  const { hnNumber } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
        p.hn_number,
        p.name AS patient_name,
        lt.lab_test_date,
        ltm.test_name AS lab_test_name,
        li.lab_item_name,
        r.generated_recommendation
      FROM patients p
      JOIN lab_tests lt ON p.hn_number = lt.hn_number
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN lab_test_items lti ON lt.lab_test_master_id = lti.lab_test_master_id
      JOIN lab_items li ON lti.lab_item_id = li.id
      JOIN recommendations r ON r.lab_test_id = lt.id
      WHERE lt.status = 'completed' AND r.status = 'sent' AND p.hn_number = $1
      ORDER BY lt.lab_test_date DESC
    `,
      [hnNumber]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No completed lab tests found for this patient.",
      });
    }

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching completed lab tests:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
