// const express = require('express');
// const router = express.Router();
// const db = require('../db');

// // create recommendation
// router.post('/', (req, res)=>{
//     const {recommendation, lab_test_id, patient_id, doctor_id} = req.body;
//     const query = 'INSERT INTO recommendations (recommendation, lab_test_id, patient_id, doctor_id) VALUES (?, ?, ?, ?)';
//     db.query(query, [recommendation, lab_test_id, patient_id, doctor_id], (err,results)=> {
//         if(err){
//             return res.status(500).json({ error: err.message });
//         }
//         res.status(201).json({ id: results.insertId });
//     });
// });

// // get all recommendation
// router.get('/', (req, res)=>{
//     db.query('SELECT * FROM recommendations', (err, results)=>{
//         if (err) {
//             return res.status(500).json({ error: err.message });
//         }
//         res.json(results);
//     });
// });

// module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../db'); // Ensure this is your createPool instance

// Create recommendation
router.post('/', async (req, res) => {
    const { recommendation, lab_test_id, patient_id, doctor_id } = req.body;

    try {
        const query = 'INSERT INTO recommendations (recommendation, lab_test_id, patient_id, doctor_id) VALUES (?, ?, ?, ?)';
        const [results] = await pool.query(query, [recommendation, lab_test_id, patient_id, doctor_id]);

        res.status(201).json({ id: results.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all recommendations
router.get('/', async (req, res) => {
    try {
        const [results] = await pool.query('SELECT * FROM recommendations');

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
