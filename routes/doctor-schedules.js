const express = require("express");
const router = express.Router();
const {pool} = require("../db");
const authenticateToken = require("../middleware/auth");

// Get all doctors with their schedules
router.get("/doctors", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        d.id AS doctor_id,
        d.name AS doctor_name,
        ds.day_of_week,
        TO_CHAR(ds.start_time, 'HH24:MI:SS') AS start_time,
        TO_CHAR(ds.end_time, 'HH24:MI:SS') AS end_time
      FROM doctors d
      JOIN doctor_schedules ds ON d.id = ds.doctor_id
      WHERE d.status = 'active'
      ORDER BY d.id, 
               CASE ds.day_of_week 
                 WHEN 'Monday' THEN 1
                 WHEN 'Tuesday' THEN 2
                 WHEN 'Wednesday' THEN 3
                 WHEN 'Thursday' THEN 4
                 WHEN 'Friday' THEN 5
                 WHEN 'Saturday' THEN 6
                 WHEN 'Sunday' THEN 7
               END
    `);

    const grouped = {};

    rows.forEach((row) => {
      if (!grouped[row.doctor_id]) {
        grouped[row.doctor_id] = {
          doctor_id: row.doctor_id,
          doctor_name: row.doctor_name,
          schedules: [],
        };
      }
      grouped[row.doctor_id].schedules.push({
        day: row.day_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
      });
    });

    res.status(200).json({
      success: true,
      data: Object.values(grouped),
    });
  } catch (error) {
    console.error("Error fetching doctor schedules:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

// Get doctor with schedules
router.get("/doctor/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT 
        doctors.id, doctors.name, doctors.phone_no, doctors.email, doctors.specialization, 
        doctor_schedules.id AS schedule_id, doctor_schedules.day_of_week, 
        doctor_schedules.start_time, doctor_schedules.end_time
      FROM doctors
      LEFT JOIN doctor_schedules ON doctors.id = doctor_schedules.doctor_id
      WHERE doctors.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const { id: doctorId, name, phone_no, email, specialization } = rows[0];

    const schedules = rows
      .filter((row) => row.schedule_id)
      .map((row) => ({
        schedule_id: row.schedule_id,
        day_of_week: row.day_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
      }));

    res.json({
      doctor: {
        id: doctorId,
        name,
        phone_no,
        email,
        specialization,
        schedules,
      },
    });
  } catch (error) {
    console.error("Error fetching doctor details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete specific schedule
router.delete("/doctor/:doctor_id", async (req, res) => {
  try {
    const { doctor_id } = req.params;
    const { day_of_week, start_time } = req.body;

    if (!day_of_week || !start_time) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { rows } = await pool.query(
      `SELECT * FROM doctor_schedules WHERE doctor_id = $1 AND day_of_week = $2 AND start_time = $3`,
      [doctor_id, day_of_week, start_time]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Schedule not found" });
    }

    await pool.query(
      `DELETE FROM doctor_schedules WHERE doctor_id = $1 AND day_of_week = $2 AND start_time = $3`,
      [doctor_id, day_of_week, start_time]
    );

    res.json({ message: "Schedule deleted successfully" });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Add schedule for doctor
router.post("/doctor/:doctor_id", async (req, res) => {
  try {
    const { doctor_id } = req.params;
    const { day_of_week, start_time, end_time } = req.body;

    if (!day_of_week || !start_time || !end_time) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { rows } = await pool.query(`SELECT id FROM doctors WHERE id = $1`, [
      doctor_id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    await pool.query(
      `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)`,
      [doctor_id, day_of_week, start_time, end_time]
    );

    res.status(201).json({ message: "Schedule added successfully" });
  } catch (error) {
    console.error("Error adding schedule:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update schedule fully
router.put(
  "/doctor/id=:doctor_id/schedule/id=:schedule_id",
  async (req, res) => {
    try {
      const { doctor_id, schedule_id } = req.params;
      const { day_of_week, start_time, end_time } = req.body;

      if (!day_of_week || !start_time || !end_time) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { rows: doctor } = await pool.query(`SELECT id FROM doctors WHERE id = $1`, [
        doctor_id,
      ]);
      if (doctor.length === 0) {
        return res.status(404).json({ message: "Doctor not found" });
      }

      const { rows: schedule } = await pool.query(
        `SELECT id FROM doctor_schedules WHERE id = $1 AND doctor_id = $2`,
        [schedule_id, doctor_id]
      );
      if (schedule.length === 0) {
        return res.status(404).json({ message: "Schedule not found" });
      }

      await pool.query(
        `UPDATE doctor_schedules SET day_of_week = $1, start_time = $2, end_time = $3 WHERE id = $4 AND doctor_id = $5`,
        [day_of_week, start_time, end_time, schedule_id, doctor_id]
      );

      res.status(200).json({ message: "Schedule updated successfully" });
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
);

// Patch schedule partially
router.patch("/:schedule_id", async (req, res) => {
  try {
    const { schedule_id } = req.params;
    const { day_of_week, start_time, end_time } = req.body;

    if (!day_of_week && !start_time && !end_time) {
      return res
        .status(400)
        .json({ message: "No fields provided for update." });
    }

    let updateFields = [];
    let values = [];
    let paramCount = 1;

    if (day_of_week) {
      updateFields.push(`day_of_week = $${paramCount++}`);
      values.push(day_of_week);
    }
    if (start_time) {
      updateFields.push(`start_time = $${paramCount++}`);
      values.push(start_time);
    }
    if (end_time) {
      updateFields.push(`end_time = $${paramCount++}`);
      values.push(end_time);
    }

    values.push(schedule_id);

    const updateQuery = `UPDATE doctor_schedules SET ${updateFields.join(
      ", "
    )} WHERE id = $${paramCount}`;

    const { rowCount } = await pool.query(updateQuery, values);

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Schedule not found or no changes made." });
    }

    res.json({ message: "Schedule updated successfully." });
  } catch (error) {
    console.error("Error updating schedule:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;