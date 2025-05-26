const express = require('express');
const { generateAndSaveRecommendation } = require('../services/generateAndSaveRecommendation.js');
const router = express.Router();

router.post("/generate-recommendation/:lab_test_id", async (req, res) => {
  const { lab_test_id } = req.params;

  try {
    const result = await generateAndSaveRecommendation(lab_test_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;