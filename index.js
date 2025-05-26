const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors"); // Fixed typo from 'corse' to 'cors'
const { pool } = require("./db"); // Import pg module

// Route imports
const adminsRoutes = require("./routes/admin");
const loginRoute = require("./routes/auth");
const patientsRoutes = require("./routes/patients");
const appointmentRoutes = require("./routes/appointments");
const doctorsRoutes = require("./routes/doctors");
const departmentsRoutes = require("./routes/departments");
const scheduleRoute = require("./routes/doctor-schedules");
const uploadRoutes = require("./routes/upload-csv");
const bulkRoute = require("./routes/bulk-upload");
const labDataRoutes = require("./routes/lab_data");
const labTestResultRoutes = require("./routes/lab_test_result");
const recommendationsRotues = require("./routes/recommendations");
const patientsWDoctors = require("./routes/lab_data-patients-doctors");
const doctorsWDepartments = require("./routes/doctors-departments");
const availableSlotsRoute = require("./routes/available_slots");
const labTestRoute = require("./routes/lab_tests");
const generateRecommendationRoute = require("./routes/generateRecommendations");
const imageUploadRoute = require("./routes/image_upload");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make the pool available to routes by attaching it to the app
app.set("dbPool", pool);

// Routes
app.use("/admins", adminsRoutes);
app.use("/login", loginRoute);
app.use("/patients", patientsRoutes);
app.use("/doctors", doctorsRoutes);
app.use("/departments", departmentsRoutes);
app.use("/upload", uploadRoutes);
app.use("/appointments", appointmentRoutes);
app.use("/recommendations", recommendationsRotues);
app.use("/bulk", bulkRoute);
app.use("/lab-data", labDataRoutes);
app.use("/lab_test_result", labTestResultRoutes);
app.use("/patients-with-doctors", patientsWDoctors);
app.use("/doctors-with-departments", doctorsWDepartments);
app.use("/slots", availableSlotsRoute);
app.use("/schedule", scheduleRoute);
app.use("/lab-tests", labTestRoute);
app.use("/api", generateRecommendationRoute);
app.use("/image", imageUploadRoute);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

let shuttingDown = false;

// Graceful shutdown
process.on("SIGINT", async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("Gracefully shutting down...");
  try {
    const timeout = setTimeout(() => {
      console.warn("Force exiting after 5 seconds...");
      process.exit(1);
    }, 5000); // fallback timeout

    await pool.end();
    clearTimeout(timeout); // clear the fallback
    console.log("PostgreSQL pool has ended");
    process.exit(0);
  } catch (err) {
    console.error("Error during pool shutdown", err);
    process.exit(1);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
