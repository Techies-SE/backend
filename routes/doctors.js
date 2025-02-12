const express = require('express');
const router = express.Router();
const db = require('../db');

//create a doctor 
router.post('/', (req, res)=>{
    const {name, phone_no, email, password, specialization, status, department_id} = req.body;
    const query = 'INSERT INTO doctors (name, phone_no, email, password, specialization, status, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [name, phone_no, email, password, specialization, status, department_id], (err, results)=>{
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: results.insertId });
    });
})

//get all doctors
router.get('/', (req, res) => {
    db.query('SELECT * FROM doctors', (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});



// Get a doctor by ID and inner join doctors --- departments
router.get("/:id/details", (req, res) => {
    db.query(
      `
    SELECT
    doctors.id AS doctor_id,
    doctors.name AS doctor_name,
    doctors.specialization AS doctor_specialization,
    departments.name AS department,
    doctors.phone_no AS doctor_phone_no,
    doctors.email AS doctor_email,
    doctors.status AS status,
    patients.hn_number as hn_number,
    patients.name as patient_name,
    doctors.registered_at as registered_at,
    doctors.updated_at as updated_at
    FROM doctors
    INNER JOIN departments ON doctors.department_id = departments.id
    INNER JOIN patients ON doctors.id = patients.doctor_id
    where doctors.id = ?
          `,
      [req.params.id],
      (err, results) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(results);
      }
    );
  });

// delete a doctor by id
router.delete('/:id', (req, res) => {
    const query = 'DELETE FROM doctors WHERE id = ?';
    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Doctor deleted successfully' });
    });
});

module.exports = router;