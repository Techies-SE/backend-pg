const express = require("express");
const router = express.Router();
const {pool} = require("../db");
const authenticateToken = require("../middleware/auth");

router.post("/", async (req, res) => {
  const { recommendation, lab_test_id, patient_id, doctor_id } = req.body;

  try {
    const { rows } = await pool.query(
      "INSERT INTO recommendations (recommendation, lab_test_id, patient_id, doctor_id) VALUES ($1, $2, $3, $4) RETURNING id",
      [recommendation, lab_test_id, patient_id, doctor_id]
    );

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
        SELECT 
          r.id AS recommendation_id,
          p.hn_number,
          p.name AS patient_name,
          d.name AS doctor_name,
          ltm.test_name AS lab_test_name,
          r.generated_recommendation,
          r.status
        FROM recommendations r
        JOIN lab_tests lt ON r.lab_test_id = lt.id
        JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
        JOIN patients p ON lt.patient_id = p.id
        JOIN doctors d ON p.doctor_id = d.id
        ORDER BY r.updated_at DESC
      `);

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching pending recommendations:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.get("/:id", authenticateToken, async (req, res) => {
  const recommendationId = req.params.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT 
          r.id AS recommendation_id,
          r.generated_recommendation,
          r.doctor_recommendation,
          r.status AS recommendation_status,
          r.updated_at AS recommendation_updated_at,
          
          p.hn_number,
          p.name AS patient_name,
          p.phone_no AS patient_phone,
          p.citizen_id,
          p.account_status AS patient_account_status,
          
          pd.gender,
          pd.blood_type,
          pd.age,
          pd.date_of_birth,
          pd.weight,
          pd.height,
          pd.bmi,
          
          d.id AS doctor_id,
          d.name AS doctor_name,
          d.phone_no AS doctor_phone,
          d.email AS doctor_email,
          d.specialization,
          dep.name AS department_name,
          
          lt.id AS lab_test_id,
          lt.lab_test_date,
          lt.status AS lab_test_status,
          
          ltm.test_name,
          
          li.lab_item_name,
          li.unit,
          
          lr.lab_item_value,
          lr.lab_item_status,
          
          lref.normal_range
          
      FROM 
          recommendations r
      JOIN lab_tests lt ON r.lab_test_id = lt.id
      JOIN patients p ON lt.patient_id = p.id
      JOIN patient_data pd ON p.hn_number = pd.hn_number
      JOIN doctors d ON p.doctor_id = d.id
      JOIN departments dep ON d.department_id = dep.id
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN lab_results lr ON lt.id = lr.lab_test_id
      JOIN lab_items li ON lr.lab_item_id = li.id
      LEFT JOIN lab_references lref ON li.id = lref.lab_item_id AND 
          (lref.gender_specific = false OR lref.gender_specific = (pd.gender = 'male'))
      WHERE 
          r.id = $1
      ORDER BY 
          li.lab_item_name;
      `,
      [recommendationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Recommendation not found" });
    }

    const base = rows[0];

    const response = {
      recommendation_id: base.recommendation_id,
      generated_recommendation: base.generated_recommendation,
      doctor_recommendation: base.doctor_recommendation,
      status: base.recommendation_status,
      updated_at: base.recommendation_updated_at,

      patient: {
        hn_number: base.hn_number,
        name: base.patient_name,
        phone: base.patient_phone,
        citizen_id: base.citizen_id,
        account_status: base.patient_account_status,
        gender: base.gender,
        blood_type: base.blood_type,
        age: base.age,
        date_of_birth: base.date_of_birth,
        weight: base.weight,
        height: base.height,
        bmi: base.bmi,
      },

      doctor: {
        id: base.doctor_id,
        name: base.doctor_name,
        phone: base.doctor_phone,
        email: base.doctor_email,
        specialization: base.specialization,
        department: base.department_name,
      },

      lab_test: {
        id: base.lab_test_id,
        lab_test_date: base.lab_test_date,
        status: base.lab_test_status,
        test_name: base.test_name,
        results: rows.map((row) => ({
          lab_item_name: row.lab_item_name,
          unit: row.unit,
          normal_range: row.normal_range,
          lab_item_value: row.lab_item_value,
          lab_item_status: row.lab_item_status,
        })),
      },
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching recommendation detail:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/send-recommendation", authenticateToken, async (req, res) => {
  const { recommendationId } = req.body;

  if (!recommendationId) {
    return res
      .status(400)
      .json({ success: false, message: "recommendationId is required" });
  }

  try {
    const { rowCount } = await pool.query(
      `UPDATE recommendations 
         SET status = 'sent', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
      [recommendationId]
    );

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Recommendation not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Recommendation sent successfully" });
  } catch (err) {
    console.error("Error updating recommendation status:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.patch("/:lab_test_id", authenticateToken, async (req, res) => {
  try {
    const { lab_test_id } = req.params;
    const { generated_recommendation } = req.body;

    if (!generated_recommendation) {
      return res.status(400).json({
        success: false,
        message: "Generated recommendation is required",
      });
    }

    const client = await pool.connect();

    try {
      const { rowCount } = await client.query(
        "UPDATE recommendations SET generated_recommendation = $1, updated_at = NOW() WHERE lab_test_id = $2",
        [generated_recommendation, lab_test_id]
      );

      if (rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Recommendation not found or no changes made",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Recommendation updated successfully",
        data: {
          lab_test_id,
          generated_recommendation,
          updated_at: new Date(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating recommendation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update recommendation",
      error: error.message,
    });
  }
});

router.patch("/:lab_test_id/approve", authenticateToken, async (req, res) => {
  try {
    const { lab_test_id } = req.params;

    const client = await pool.connect();

    try {
      const { rowCount } = await client.query(
        'UPDATE recommendations SET status = "approved", updated_at = NOW() WHERE lab_test_id = $1',
        [lab_test_id]
      );

      if (rowCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Recommendation not found or no changes made",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Recommendation approved successfully",
        data: {
          lab_test_id,
          recommendation_status: "approved",
          updated_at: new Date(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error approving recommendation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve recommendation",
      error: error.message,
    });
  }
});

module.exports = router;