const express = require('express');
const router = express.Router();
const db = require('../db');

// create a lab_data
router.post('/', (req, res) => {
    const {hn_number, gender, blood_type, age, date_of_birth, weight, height, bmi, systolic, diastolic, order_date} = req.body;
    
    // Validate HN number format
    if (!/^\d{9}$/.test(hn_number)) {
        return res.status(400).json({ error: "HN Number must be exactly 9 digits" });
    }

    // First check if the hn_number exists in patients table
    db.query('SELECT hn_number FROM patients WHERE hn_number = ?', [hn_number], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'Patient with this HN number does not exist' });
        }
        
        // If hn_number exists, proceed with lab data insertion
        const insertQuery = 'INSERT INTO lab_data (hn_number, gender, blood_type, age, date_of_birth, weight, height, bmi, systolic, diastolic, order_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        
        db.query(insertQuery, [hn_number, gender, blood_type, age, date_of_birth, weight, height, bmi, systolic, diastolic, order_date], (err, insertResults) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            // After successful lab data insertion, update patient's lab_data_status
            const updateQuery = 'UPDATE patients SET lab_data_status = true WHERE hn_number = ?';
            
            db.query(updateQuery, [hn_number], (updateErr, updateResults) => {
                if (updateErr) {
                    return res.status(500).json({ error: "Lab data inserted but failed to update patient status: " + updateErr.message });
                }
                
                res.status(201).json({ 
                    id: insertResults.insertId,
                    message: "Lab data created and patient status updated successfully"
                });
            });
        });
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