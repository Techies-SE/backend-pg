const express = require("express");
const router = express.Router();
const pool = require("../db"); // Make sure this is your PostgreSQL pool instance
const bcrypt = require("bcrypt");
const authenticateToken = require("../middleware/auth");

// Admin Profile (Protected Route)
router.get("/profile", authenticateToken, async (req, res) => {
  // Verify the user is an admin
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Admin role required" });
  }

  const adminId = req.user.id;
  let client;

  try {
    client = await pool.connect();

    // Get admin information (excluding password)
    const { rows: adminResults } = await client.query(
      `SELECT 
         id, name, phone_no, email,
         status, registered_at, 
         updated_at
       FROM admin 
       WHERE id = $1`,
      [adminId]
    );

    if (adminResults.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    const admin = adminResults[0];

    res.json({
      message: "Admin profile retrieved successfully",
      admin: {
        ...admin,
      },
    });
  } catch (err) {
    console.error("Admin profile error:", err);
    res.status(500).json({ error: "Database error" });
  } finally {
    if (client) client.release();
  }
});

// Get all admins
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM admin");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create an admin
router.post("/", authenticateToken, async (req, res) => {
  const { name, phone_no, email, status } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(phone_no, 10); // default password = phone number

    const { rows } = await pool.query(
      `INSERT INTO admin (name, phone_no, email, password, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [name, phone_no, email, hashedPassword, status]
    );

    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;