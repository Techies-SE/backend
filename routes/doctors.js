// **
// all fixed
const express = require('express');
const router = express.Router();
const db = require('../db');

// using
// create a doctor 
router.post('/', async (req, res) => {
    const { name, phone_no, email, password, specialization, status, department_id } = req.body;
    const query = `
        INSERT INTO doctors (name, phone_no, email, password, specialization, status, department_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    try {
        const [results] = await db.query(query, [name, phone_no, email, password, specialization, status, department_id]);
        res.status(201).json({ id: results.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// get all doctors
router.get('/', async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM doctors');
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// ***
// get doctor by id
router.get("/id=:id", async (req, res) => {
    const doctorId = req.params.id;
    try {
      const [rows] = await db.query("SELECT * FROM doctors WHERE id = ?", [doctorId]);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });



// Get a doctor by ID and inner join doctors --- departments
router.get("/:id/details", async (req, res) => {
    const query = `
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
        WHERE doctors.id = ?
    `;

    try {
        const [results] = await db.query(query, [req.params.id]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

// delete a doctor by id
router.delete('/:id', async (req, res) => {
    const query = 'DELETE FROM doctors WHERE id = ?';
    try {
        await db.query(query, [req.params.id]);
        res.json({ message: 'Doctor deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;