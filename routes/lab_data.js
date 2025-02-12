const express = require('express');
const router = express.Router();
const db = require('../db');

// create a lab_data
router.post('/',(req, res)=>{
    const {gender, blood_type, age, date_of_birth, weight, height, bmi, systolic, diastolic, order_date, patient_id} = req.body;
    const query = 'INSERT INTO lab_data (gender, blood_type, age, date_of_birth, weight, height, bmi, systolic, diastolic, order_date, patient_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [gender, blood_type, age, date_of_birth, weight, height, bmi, systolic, diastolic, order_date, patient_id],(err, results)=>{
        if(err){
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: results.insertId });
    });
});

// get all lab_data
router.get('/',(req, res)=>{
    db.query('SELECT * FROM lab_data', (err, results)=>{
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
})

module.exports = router;