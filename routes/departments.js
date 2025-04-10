// ***
// all fixed
const express = require('express');
const router = express.Router();
const db = require('../db'); // assumed to be created with mysql2/promise

// Create a department
router.post('/', async (req, res) => {
  const { name } = req.body;

  try {
    const [result] = await db.query('INSERT INTO departments (name) VALUES (?)', [name]);
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Error creating department:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all departments
router.get('/', async (req, res) => {
  try {
    const [departments] = await db.query('SELECT * FROM departments');
    res.json(departments);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a department and its doctors by department ID
router.get('/id=:id', async (req, res) => {
  const departmentId = req.params.id;

  const query = `
    SELECT d.id AS department_id, d.name AS department_name, 
           doc.id AS doctor_id, doc.name AS doctor_name, 
           doc.phone_no, doc.email, doc.specialization, doc.status 
    FROM departments d
    LEFT JOIN doctors doc ON d.id = doc.department_id
    WHERE d.id = ?;
  `;

  try {
    const [results] = await db.query(query, [departmentId]);

    if (results.length === 0) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const department = {
      id: results[0].department_id,
      name: results[0].department_name,
      doctors: results
        .filter(row => row.doctor_id !== null)
        .map(row => ({
          id: row.doctor_id,
          name: row.doctor_name,
          phone_no: row.phone_no,
          email: row.email,
          specialization: row.specialization,
          status: row.status
        }))
    };

    res.json(department);
  } catch (err) {
    console.error('Error fetching department details:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
