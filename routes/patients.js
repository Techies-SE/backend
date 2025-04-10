// ***
// fixed all
const express = require("express");
const router = express.Router();
const db = require("../db"); 
const bcrypt = require("bcrypt");
const saltRounds = 10;
// ***
// create a patient 
// router.post("/", async (req, res) => {
//   const { hn_number, name, citizen_id, phone_no, doctor_id, lab_test_master_id } = req.body;

//   // Validate required fields
//   if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id || !lab_test_master_id) {
//     return res.status(400).json({ error: "All fields are required." });
//   }

//   try {
//     // Hash the citizen_id to create a password
//     const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);

//     // Start transaction
//     db.beginTransaction((err) => {
//       if (err) return res.status(500).json({ error: err.message });

//       // Insert into patients table
//       const patientQuery = `
//         INSERT INTO patients (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
//         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

//       const patientValues = [
//         hn_number,
//         name,
//         citizen_id,
//         phone_no,
//         hashedPassword,
//         false,
//         false,
//         doctor_id,
//       ];

//       db.query(patientQuery, patientValues, (err, results) => {
//         if (err) {
//           return db.rollback(() => {
//             res.status(500).json({ error: err.message });
//           });
//         }

//         // Insert into lab_tests table with current timestamp for lab_test_result_date
//         const labTestQuery = `
//           INSERT INTO lab_tests (hn_number, lab_test_master_id, status, lab_test_date)
//           VALUES (?, ?, ?, ?)`;

//         const currentTimestamp = new Date(); // or use: new Date().toISOString()
//         const labTestValues = [hn_number, lab_test_master_id, "pending", currentTimestamp];

//         db.query(labTestQuery, labTestValues, (err, labResults) => {
//           if (err) {
//             return db.rollback(() => {
//               res.status(500).json({ error: err.message });
//             });
//           }

//           // Commit transaction
//           db.commit((err) => {
//             if (err) {
//               return db.rollback(() => {
//                 res.status(500).json({ error: err.message });
//               });
//             }

//             res.status(201).json({
//               patient_id: results.insertId,
//               message: "Patient and lab test created successfully.",
//             });
//           });
//         });
//       });
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });
router.post("/", async (req, res) => {
  const { hn_number, name, citizen_id, phone_no, doctor_id, lab_test_master_id } = req.body;

  // Validate required fields
  if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id || !lab_test_master_id) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Hash the citizen_id to create a password
    const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);

    // Get a connection from the pool
    const connection = await db.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Insert into patients table
      await connection.query(
        `INSERT INTO patients 
         (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          hn_number,
          name,
          citizen_id,
          phone_no,
          hashedPassword,
          false,
          false,
          doctor_id,
        ]
      );
      
      // Insert into lab_tests table
      const currentTimestamp = new Date();
      await connection.query(
        `INSERT INTO lab_tests 
         (hn_number, lab_test_master_id, status, lab_test_date)
         VALUES (?, ?, ?, ?)`,
        [hn_number, lab_test_master_id, "pending", currentTimestamp]
      );
      
      // Commit transaction
      await connection.commit();
      
      res.status(201).json({
        message: "Patient and lab test created successfully.",
      });
      
    } catch (error) {
      // Rollback in case of error
      await connection.rollback();
      throw error;
    } finally {
      // Always release the connection
      connection.release();
    }
  } catch (error) {
    console.error("Error creating patient:", error);
    res.status(500).json({ error: error.message });
  }
});

//fixed
// Get all patients
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM patients");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a patient by ID
router.get("/:id", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM patients WHERE id = ?", [req.params.id]);
    if (results.length === 0) return res.status(404).json({ message: "Patient not found" });
    res.json(results[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a patient by ID and inner join lab-data --- patients --- doctors
router.get("/:id/details", async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT
        patients.id AS patient_id,
        patients.name AS patient_name,
        patients.hn_number AS hn_number,
        lab_data.age AS patient_age,
        lab_data.date_of_birth AS DOB,
        lab_data.gender AS patient_gender,
        lab_data.blood_type AS patient_blood_type,
        lab_data.weight AS patient_weight,
        lab_data.height AS patient_height,
        lab_data.bmi AS patient_bmi,
        lab_data.systolic AS patient_systolic,
        lab_data.diastolic AS patient_diastolic,
        lab_data.order_date AS order_date,
        doctors.name AS doctor_name,
        patients.phone_no AS patient_phone,
        patients.email AS patient_email,
        patients.registered_at AS registered_at,
        patients.updated_at AS updated_at
      FROM patients
      INNER JOIN doctors ON patients.doctor_id = doctors.id
      INNER JOIN lab_data ON lab_data.hn_number = patients.hn_number
      WHERE patients.id = ?`,
      [req.params.id]
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get a patient with appointments
router.get("/id=:id/appointments", async (req, res) => {
  try {
    const [result] = await db.query(
      `SELECT a.hn_number,
        COUNT(a.id) AS total_appointments,
        JSON_ARRAYAGG(
            JSON_OBJECT(
                'id', a.id,
                'appointment_date', a.appointment_date,
                'appointment_time', a.appointment_time,
                'specialization', d.specialization,
                'status', a.status,
                'doctor', d.name
            )
        ) AS appointments
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      WHERE a.hn_number = ?
      GROUP BY a.hn_number`,
      [req.params.id]
    );

    if (result.length === 0) return res.status(404).json({ message: "No appointments found" });
    res.json(result[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Patient click Confirm for Rescheduled Appointments
router.put("/:appointmentId/confirm", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { hnNumber } = req.body; // For verification purposes
    
    // First, verify this appointment belongs to this patient and is in Rescheduled status
    const [appointment] = await db.query(
      `SELECT * FROM appointments WHERE id = ? AND hn_number = ? AND status = 'Rescheduled'`,
      [appointmentId, hnNumber]
    );
    
    if (appointment.length === 0) {
      return res.status(404).json({ 
        message: "Appointment not found or not eligible for confirmation" 
      });
    }
    
    // Update the appointment status to Scheduled
    await db.query(
      `UPDATE appointments SET status = 'Scheduled' WHERE id = ?`,
      [appointmentId]
    );
    
    res.json({ 
      message: "Appointment confirmed successfully", 
      appointmentId 
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// get a patient with lab test and lab test items
router.get("/id=:id/lab-results", async (req, res) => {
  try {
    const [result] = await db.query(
      `SELECT 
        lt.hn_number,
        lt.id AS lab_test_id,
        lt.lab_test_name,
        lt.lab_test_date,
        lti.lab_item_name,
        lti.lab_item_normal_ref_value,
        lti.lab_item_value,
        lti.lab_item_status,
        lti.lab_item_recommendation
      FROM lab_tests lt
      LEFT JOIN lab_test_items lti ON lt.id = lti.lab_test_id
      WHERE lt.hn_number = ?`,
      [req.params.id]
    );

    if (result.length === 0) return res.status(404).json({ message: "No Lab Data Found" });

    const response = {
      hn_number: req.params.id,
      total_lab_test: 0,
      lab_test: [],
    };

    const labTestsMap = new Map();

    result.forEach((row) => {
      if (!labTestsMap.has(row.lab_test_id)) {
        labTestsMap.set(row.lab_test_id, {
          name: row.lab_test_name,
          date: row.lab_test_date,
          items: [],
        });
      }

      if (row.lab_item_name) {
        labTestsMap.get(row.lab_test_id).items.push({
          name: row.lab_item_name,
          normal_reference_value: row.lab_item_normal_ref_value,
          value: row.lab_item_value,
          result: row.lab_item_status,
          recommendation: row.lab_item_recommendation,
        });
      }
    });

    response.lab_test = Array.from(labTestsMap.values());
    response.total_lab_test = response.lab_test.length;

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Update a patient
router.put("/:id", async (req, res) => {
  const { name, citizen_id, phone_no, email, password, status, doctor_id } = req.body;

  try {
    await db.query(
      `UPDATE patients SET name = ?, citizen_id = ?, phone_no = ?, email = ?, password = ?, status = ?, doctor_id = ? WHERE id = ?`,
      [name, citizen_id, phone_no, email, password, status, doctor_id, req.params.id]
    );
    res.json({ message: "Patient updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a patient
router.delete("/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM patients WHERE id = ?", [req.params.id]);
    res.json({ message: "Patient deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
