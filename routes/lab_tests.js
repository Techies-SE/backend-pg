const express = require("express");
const router = express.Router();
const { pool } = require("../db");

// Get all test names from lab_tests_master
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM lab_tests_master");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET lab test items by lab_test_master_id
router.get("/:id/items", async (req, res) => {
  const labTestMasterId = parseInt(req.params.id);

  if (isNaN(labTestMasterId)) {
    return res.status(400).json({ error: "Invalid lab_test_master_id" });
  }

  try {
    const result = await pool.query(
      `
      SELECT 
        ltm.test_name,
        li.id AS lab_item_id,
        li.lab_item_name,
        li.unit
      FROM lab_tests_master ltm
      JOIN lab_test_items lti ON ltm.id = lti.lab_test_master_id
      JOIN lab_items li ON lti.lab_item_id = li.id
      WHERE ltm.id = $1
      ORDER BY li.lab_item_name
      `,
      [labTestMasterId]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No lab test items found for the given ID" });
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching lab test items:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
