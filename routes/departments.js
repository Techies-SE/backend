// ***
// all fixed
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db'); 
const fs = require('fs');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads'); // Save to /uploads folder
  },
  filename: (req, file, cb) => {
    const uniqueName = `department-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// PATCH route for department image upload
router.patch('/image/upload/:id', upload.single('image'), async (req, res) => {
  const departmentId = req.params.id;

  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  const imagePath = `uploads/${req.file.filename}`;
  const imageUrl = `http://localhost:3000/${imagePath}`;

  try {
    const [result] = await db.execute(
      'UPDATE departments SET image = ? WHERE id = ?',
      [imagePath, departmentId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json({
      message: 'Department image updated',
      imagePath,
      imageUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/image/delete/:id', async (req, res) => {
  const departmentId = req.params.id;

  try {
    // Get current image path from DB
    const [rows] = await db.execute('SELECT image FROM departments WHERE id = ?', [departmentId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const imagePath = rows[0].image;

    // Delete file from disk if it exists
    if (imagePath) {
      const fullPath = path.join(__dirname, '..', imagePath);
      fs.unlink(fullPath, (err) => {
        if (err && err.code !== 'ENOENT') {
          console.warn('Image file deletion failed:', err);
        }
      });
    }

    // Update DB: remove image reference
    await db.execute(
      'UPDATE departments SET image = NULL WHERE id = ?',
      [departmentId]
    );

    res.json({ message: 'Department image removed successfully' });
  } catch (err) {
    console.error('Error removing department image:', err);
    res.status(500).json({ error: 'Failed to remove image' });
  }
});


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

router.get('/doctor-counts', async (req, res) => {
  // console.log('GET /departments/doctor-counts called');
  try {
    const [rows] = await db.query(`
      SELECT 
        d.id AS department_id,
        d.name AS department_name,
        d.description AS description,
        COUNT(doc.id) AS doctor_count
      FROM 
        departments d
      LEFT JOIN 
        doctors doc ON d.id = doc.department_id
      GROUP BY 
        d.id, d.name, d.description
      ORDER BY 
        d.id;
    `);

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching doctor counts:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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

// router.get('/:id', async (req, res) => {
//   const departmentId = req.params.id;

//   const query = `
//     SELECT d.id AS department_id, d.name AS department_name, d.description AS department_description, d.image AS department_image,
//            doc.name AS doctor_name, 
//            doc.phone_no, doc.email, doc.specialization
//     FROM departments d
//     LEFT JOIN doctors doc ON d.id = doc.department_id
//     WHERE d.id = ?;
//   `;

//   try {
//     const [results] = await db.query(query, [departmentId]);

//     if (results.length === 0) {
//       return res.status(404).json({ message: 'Department not found' });
//     }

//     const department = {
//       id: results[0].department_id,
//       name: results[0].department_name,
//       description: results[0].department_description,
//       image: results[0].department_image,
//       doctors: results
//         .filter(row => row.doctor_id !== null)
//         .map(row => ({
//           //id: row.doctor_id,
//           name: row.doctor_name,
//           phone_no: row.phone_no,
//           email: row.email,
//           specialization: row.specialization,
//           //status: row.status
//         }))
//     };

//     res.json(department);
//   } catch (err) {
//     console.error('Error fetching department details:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

router.get('/:id', async (req, res) => {
  const departmentId = req.params.id;

  const query = `
    SELECT d.id AS department_id, d.name AS department_name, d.description AS department_description, d.image AS department_image,
           doc.name AS doctor_name, 
           doc.phone_no, doc.email, doc.specialization
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
      description: results[0].department_description,
      image: results[0].department_image,
      imageUrl: results[0].department_image 
        ? `http://localhost:3000/${results[0].department_image}`
        : null,
      doctors: results
        .filter(row => row.doctor_name !== null)
        .map(row => ({
          name: row.doctor_name,
          phone_no: row.phone_no,
          email: row.email,
          specialization: row.specialization
        }))
    };

    res.json(department);
  } catch (err) {
    console.error('Error fetching department details:', err);
    res.status(500).json({ error: err.message });
  }
});







module.exports = router;
