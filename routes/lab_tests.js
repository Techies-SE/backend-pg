const express = require("express");
const router = express.Router();
const {pool} = require("../db");

// Get all test names from lab_tests_master
router.get("/", async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT * FROM lab_tests_master");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;