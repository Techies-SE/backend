const express = require('express');
const router = express.Router();
const db = require('../db');

// create an admin
router.post('/', (req, res) => {
    const { name, phone_no, email, password, status} = req.body;
    const query = 'INSERT INTO admins (name, phone_no, email, password, status) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [name, phone_no, email, password, status], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: results.insertId });
    });
});

//get all admin
router.get('/', (req, res) => {
    db.query('SELECT * FROM admins', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

module.exports = router;