const express = require("express");
const router = express.Router();
const pool = require("../db");
const authenticateToken = require("../middleware/auth");

// Get all pending appointments for admin approval
router.get("/pending", authenticateToken, async (req, res) => {
  try {
    const { rows: appointments } = await pool.query(`
      SELECT 
        appointments.id AS appointment_id,
        appointments.appointment_date,
        appointments.appointment_time,
        appointments.status, 
        patients.name AS patient_name,
        patients.phone_no AS patient_phone,
        doctors.id AS doctor_id,
        doctors.name AS doctor_name,
        doctors.specialization
      FROM appointments
      JOIN patients ON appointments.patient_id = patients.id
      JOIN doctors ON appointments.doctor_id = doctors.id
      WHERE appointments.status = 'pending'
    `);
    res.json({ pending_appointments: appointments });
  } catch (error) {
    console.error("Error fetching pending appointments:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Count endpoints
const countRoutes = [
  {
    path: "/pending/count",
    status: "pending",
    label: "total_pending_appointments",
  },
  {
    path: "/confirm/count",
    status: "scheduled",
    label: "total_confirm_appointments",
  },
  {
    path: "/reschedule/count",
    status: "rescheduled",
    label: "total_reschedule_appointments",
  },
  {
    path: "/cancel/count",
    status: "canceled",
    label: "total_canceled_appointments",
  },
  {
    path: "/complete/count",
    status: "completed",
    label: "total_completed_appointments",
  },
];

countRoutes.forEach(({ path, status, label }) => {
  router.get(path, authenticateToken, async (req, res) => {
    try {
      const { rows: result } = await pool.query(
        `SELECT COUNT(*) AS total FROM appointments WHERE status = $1`,
        [status]
      );
      res.json({ [label]: result[0].total });
    } catch (error) {
      console.error(`Error fetching ${status} appointments count:`, error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
});

// Total appointments count
router.get("/count", authenticateToken, async (req, res) => {
  try {
    const { rows: result } = await pool.query(
      `SELECT COUNT(*) AS total FROM appointments`
    );
    res.json({ total_appointments: result[0].total });
  } catch (error) {
    console.error("Error fetching appointments count:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin approve the patient's appointment
router.patch("/approve/:appointment_id", authenticateToken, async (req, res) => {
  try {
    const { appointment_id } = req.params;
    const { rowCount } = await pool.query(
      `UPDATE appointments SET status = 'scheduled' 
       WHERE id = $1 AND status = 'pending'`,
      [appointment_id]
    );
    
    if (rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Appointment not found or already approved." });
    }
    res.json({ message: "Appointment approved successfully!" });
  } catch (error) {
    console.error("Error approving appointment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin cancel the patient's appointment
router.patch("/cancel/:appointment_id", authenticateToken, async (req, res) => {
  try {
    const { appointment_id } = req.params;
    const { rowCount } = await pool.query(
      `UPDATE appointments SET status = 'canceled' 
       WHERE id = $1 AND status = 'pending'`,
      [appointment_id]
    );
    
    if (rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Appointment not found or already approved." });
    }
    res.json({ message: "Appointment canceled successfully!" });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get reschedule data
router.get("/:appointment_id/reschedule", authenticateToken, async (req, res) => {
  try {
    const { appointment_id } = req.params;

    const { rows: appointmentResult } = await pool.query(
      `SELECT 
          a.id AS appointment_id, 
          a.appointment_date, 
          a.appointment_time, 
          d.id AS doctor_id, 
          d.name AS doctor_name, 
          d.specialization, 
          ds.day_of_week, 
          ds.start_time, 
          ds.end_time, 
          p.hn_number, 
          p.name AS patient_name, 
          p.phone_no 
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN doctor_schedules ds ON d.id = ds.doctor_id
      WHERE a.id = $1`,
      [appointment_id]
    );

    if (appointmentResult.length === 0) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    const appointment = appointmentResult[0];

    const { rows: bookedSlotsResult } = await pool.query(
      `SELECT appointment_time FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND id != $3`,
      [appointment.doctor_id, appointment.appointment_date, appointment_id]
    );

    const bookedTimes = bookedSlotsResult.map((slot) =>
      slot.appointment_time.slice(0, 5)
    );

    const availableSlots = generateTimeSlots(
      appointment.start_time,
      appointment.end_time,
      30
    ).filter((slot) => !bookedTimes.includes(slot));

    res.json({ appointment, available_slots: availableSlots });
  } catch (error) {
    console.error("Error fetching reschedule details:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin reschedule the patient appointment
router.patch("/:appointment_id/reschedule", authenticateToken, async (req, res) => {
  try {
    const { appointment_id } = req.params;
    const { new_date, new_time } = req.body;

    const { rowCount } = await pool.query(
      `UPDATE appointments 
       SET appointment_date = $1, appointment_time = $2, status = 'rescheduled' 
       WHERE id = $3`,
      [new_date, new_time, appointment_id]
    );

    if (rowCount === 0) {
      return res
        .status(404)
        .json({ message: "Appointment not found or could not be updated" });
    }

    res.json({ message: "Appointment rescheduled successfully!" });
  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get available slots for rescheduling
router.get("/available-slots/:doctor_id/:date", authenticateToken, async (req, res) => {
  try {
    const { doctor_id, date } = req.params;
    const dayOfWeek = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
    });

    const { rows: schedule } = await pool.query(
      `SELECT start_time, end_time FROM doctor_schedules 
       WHERE doctor_id = $1 AND day_of_week = $2`,
      [doctor_id, dayOfWeek]
    );

    if (schedule.length === 0) {
      return res
        .status(404)
        .json({ message: "Doctor is not available on this day." });
    }

    const { start_time, end_time } = schedule[0];
    const slots = generateTimeSlots(start_time, end_time, 30);

    const { rows: bookedSlots } = await pool.query(
      `SELECT appointment_time FROM appointments 
       WHERE doctor_id = $1 AND appointment_date = $2 AND status IN ('pending', 'scheduled', 'rescheduled')`,
      [doctor_id, date]
    );

    const bookedTimes = bookedSlots.map((slot) =>
      slot.appointment_time.slice(0, 5)
    );
    const availableSlots = slots.filter((slot) => !bookedTimes.includes(slot));

    res.json({ date, available_slots: availableSlots });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Utility function to generate time slots
function generateTimeSlots(start, end, interval) {
  const slots = [];
  let currentTime = new Date(`1970-01-01T${start}`);
  const endTime = new Date(`1970-01-01T${end}`);

  while (currentTime < endTime) {
    slots.push(currentTime.toTimeString().slice(0, 5));
    currentTime.setMinutes(currentTime.getMinutes() + interval);
  }

  return slots;
}

module.exports = router;