const express = require('express');
const router = express.Router();
const db = require('../db');


// create a department
router.post('/', (req,res)=>{
    const {name} = req.body;
    const query = 'INSERT INTO departments (name) VALUES (?)';
    db.query(query, [name], (err,results)=>{
        if(err){
            return res.status(500).json({error: err.message})
        }
        res.status(201).json({ id: results.insertId });
    });
});

// using
// get all departments
router.get('/', (req, res)=>{
    db.query('SELECT * FROM departments', (err, results)=>{
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

//will use
// Get a department and its doctors by department ID
router.get('/id=:id', (req, res) => {
    const departmentId = req.params.id;

    const query = `
        SELECT d.id AS department_id, d.name AS department_name, 
               doc.id AS doctor_id, doc.name AS doctor_name, 
               doc.phone_no, doc.email, doc.specialization, doc.status 
        FROM departments d
        LEFT JOIN doctors doc ON d.id = doc.department_id
        WHERE d.id = ?;
    `;

    db.query(query, [departmentId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (results.length === 0) {
            return res.status(404).json({ message: 'Department not found' });
        }

        // Formatting the response
        const department = {
            id: results[0].department_id,
            name: results[0].department_name,
            doctors: results.filter(row => row.doctor_id !== null).map(row => ({
                id: row.doctor_id,
                name: row.doctor_name,
                phone_no: row.phone_no,
                email: row.email,
                specialization: row.specialization,
                status: row.status
            }))
        };

        res.json(department);
    });
});

module.exports = router;