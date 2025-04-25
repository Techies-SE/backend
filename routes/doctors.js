// **
// all fixed
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');

// using
// create a doctor 
// router.post('/', async (req, res) => {
//     const { name, phone_no, email, password, specialization, status, department_id } = req.body;
//     const query = `
//         INSERT INTO doctors (name, phone_no, email, password, specialization, status, department_id) 
//         VALUES (?, ?, ?, ?, ?, ?, ?)
//     `;
//     try {
//         const [results] = await db.query(query, [name, phone_no, email, password, specialization, status, department_id]);
//         res.status(201).json({ id: results.insertId });
//     } catch (err) {
//         res.status(500).json({ error: err.message });
//     }
// });
router.post('/', async (req, res) => {
  const { name, phone_no, email, specialization, status, department_id } = req.body;

  try {
      const hashedPassword = await bcrypt.hash(phone_no, 10); // hash phone_no as password

      const query = `
          INSERT INTO doctors (name, phone_no, email, password, specialization, status, department_id) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const [results] = await db.query(query, [name, phone_no, email, hashedPassword, specialization, status, department_id]);

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

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const doctor = rows[0];

    // Append full image URL if image exists
    if (doctor.image) {
      doctor.imageUrl = `http://localhost:3000/${doctor.image}`;
    }

    res.json(doctor);
  } catch (err) {
    console.error("Error fetching doctor:", err);
    res.status(500).json({ error: "Internal server error" });
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

router.patch("/:id", async (req, res) => {
  const doctorId = req.params.id;
  const { name, phone_no, email } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push("name = ?");
    values.push(name);
  }

  if (phone_no !== undefined) {
    updates.push("phone_no = ?");
    values.push(phone_no);
  }

  if (email !== undefined) {
    updates.push("email = ?");
    values.push(email);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No valid fields provided for update" });
  }

  // Add updated_at timestamp
  updates.push("updated_at = NOW()");

  try {
    const connection = await db.getConnection();

    await connection.query(
      `UPDATE doctors SET ${updates.join(", ")} WHERE id = ?`,
      [...values, doctorId]
    );

    connection.release();
    res.json({ message: "Doctor information updated successfully" });
  } catch (err) {
    console.error("Error updating doctor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get('/patients-lab-tests/:doctorId', async (req, res) => {
    const { doctorId } = req.params;
  
    try {
      const [rows] = await db.execute(`
        SELECT 
          p.id AS patient_id,        
          p.hn_number,
          p.name AS patient_name,
          lt.id AS lab_test_id,
          ltm.test_name AS lab_test_name,
          lt.lab_test_date
        FROM patients p
        JOIN lab_tests lt ON p.hn_number = lt.hn_number
        JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
        JOIN recommendations r ON r.lab_test_id = lt.id
        WHERE p.doctor_id = ? AND r.status = 'sent'
        ORDER BY lt.lab_test_date DESC
      `, [doctorId]);
  
      res.status(200).json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching patients and lab tests:', err);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  });


// GET /doctors/:id/patient-count
router.get('/:id/patient-count', async (req, res) => {
  const doctorId = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS patient_count FROM patients WHERE doctor_id = ?`,
      [doctorId]
    );

    res.json({
      doctor_id: doctorId,
      patient_count: rows[0].patient_count
    });

  } catch (error) {
    console.error('Error fetching patient count:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /doctors/:id/scheduled-appointments-count
router.get('/:id/appointments-count', async (req, res) => {
  const doctorId = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS scheduled_appointment_count 
       FROM appointments 
       WHERE doctor_id = ? AND status = 'scheduled'`,
      [doctorId]
    );

    res.json({
      doctor_id: doctorId,
      scheduled_appointment_count: rows[0].scheduled_appointment_count
    });

  } catch (error) {
    console.error('Error fetching scheduled appointments count:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:doctorId/pending-lab-results', async (req, res) => {
  const { doctorId } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
          lt.id AS lab_test_id,
          p.hn_number,
          p.name AS patient_name,
          
          lt.lab_test_date,
          ltm.test_name,
          
          MAX(li.lab_item_name) AS lab_item_name, -- We can select one lab item per test, adjust as necessary
          MAX(li.unit) AS unit,
          
          MAX(lr.lab_item_value) AS lab_item_value,
          MAX(lr.lab_item_status) AS lab_item_status,
          
          r.id AS recommendation_id,
          r.status AS recommendation_status,
          r.updated_at AS recommendation_updated_at,
          
          d.id AS doctor_id,
          d.name AS doctor_name
          
      FROM 
          lab_tests lt
      JOIN 
          recommendations r ON r.lab_test_id = lt.id
      JOIN 
          patients p ON lt.hn_number = p.hn_number
      LEFT JOIN 
          lab_results lr ON lr.lab_test_id = lt.id
      LEFT JOIN 
          lab_items li ON lr.lab_item_id = li.id
      JOIN 
          lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN 
          doctors d ON p.doctor_id = d.id
      WHERE 
          r.status = 'sent' AND
          d.id = ?
      GROUP BY 
          lt.id, p.hn_number, p.name, lt.lab_test_date, ltm.test_name, r.id, r.status, r.updated_at, d.id, d.name
      ORDER BY 
          r.updated_at DESC
    `, [doctorId]);

    res.json({ success: true, data: rows });

  } catch (error) {
    console.error('Error fetching pending lab results:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});


router.get('/:doctorId/pending-lab-results-count', async (req, res) => {
  const { doctorId } = req.params;

  try {
    const [result] = await db.query(`
      SELECT 
        COUNT(DISTINCT lt.id) AS pending_lab_results_count
      FROM 
        lab_tests lt
      JOIN 
        recommendations r ON r.lab_test_id = lt.id
      JOIN 
        patients p ON lt.hn_number = p.hn_number
      WHERE 
        r.status = 'sent' AND
        p.doctor_id = ?
    `, [doctorId]);

    res.json({ success: true, count: result[0].pending_lab_results_count });

  } catch (error) {
    console.error('Error fetching pending lab result count:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.get('/:doctorId/recent-lab-tests', async (req, res) => {
  const { doctorId } = req.params;

  try {
    const [rows] = await db.query(`
      SELECT 
        p.name AS patient_name,
        p.hn_number,
        ltm.test_name,
        lt.lab_test_date,
        lt.id
      FROM 
        lab_tests lt
      JOIN 
        lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN 
        patients p ON lt.hn_number = p.hn_number
      JOIN 
        doctors d ON p.doctor_id = d.id
      WHERE 
        d.id = ?
      ORDER BY 
        lt.lab_test_date DESC
      LIMIT 3
    `, [doctorId]);

    res.json({ success: true, data: rows });

  } catch (error) {
    console.error('Error fetching recent lab tests:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});



module.exports = router;