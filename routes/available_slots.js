const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/id=:doctor_id/date=:date", async (req, res) => {
  try {
    const { doctor_id, date } = req.params;

    // Validate and parse the date
    const requestedDate = new Date(`${date}T00:00:00Z`);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    const dayOfWeek = requestedDate.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });

    // Get doctor's schedule
    const { rows: scheduleRows } = await db.query(
      "SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = $1 AND day_of_week = $2",
      [doctor_id, dayOfWeek]
    );

    if (scheduleRows.length === 0) {
      return res.status(404).json({ message: "No available schedule for this day." });
    }

    const { start_time, end_time } = scheduleRows[0];

    const allSlots = generateTimeSlots(date, start_time, end_time, 30);

    // Get already booked slots
    const { rows: bookedRows } = await db.query(
      "SELECT appointment_time FROM appointments WHERE doctor_id = $1 AND appointment_date = $2",
      [doctor_id, date]
    );

    const bookedTimes = bookedRows.map(row =>
      row.appointment_time.slice(0, 5)
    );

    const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

    res.json({ date, available_slots: availableSlots });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Generate Time Slots
function generateTimeSlots(date, start, end, interval) {
  const slots = [];
  const startDateTime = new Date(`${date}T${start}Z`);
  const endDateTime = new Date(`${date}T${end}Z`);

  while (startDateTime < endDateTime) {
    slots.push(startDateTime.toISOString().slice(11, 16)); // "HH:mm"
    startDateTime.setMinutes(startDateTime.getMinutes() + interval);
  }

  return slots;
}

module.exports = router;