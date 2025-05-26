const express = require('express');
const router = express.Router();
const pool = require('../db');

// Create a lab_test_result
router.post('/', async (req, res) => {
    const { lab_test_name, lab_test_result, lab_data_id } = req.body;
    
    try {
        const { rows } = await pool.query(
            'INSERT INTO lab_test_result (lab_test_name, lab_test_result, lab_data_id) VALUES ($1, $2, $3) RETURNING id',
            [lab_test_name, lab_test_result, lab_data_id]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Get all lab_test_result
router.get('/', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM lab_test_result');
        res.json(rows);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;