// ***
// fixed all
const express = require("express");
const router = express.Router();
const db = require("../db"); 
const bcrypt = require("bcrypt");
const saltRounds = 10;
// ***
// create a patient 
router.post("/", async (req, res) => {
  const { hn_number, name, citizen_id, phone_no, doctor_id, lab_test_master_id } = req.body;

  // Validate required fields
  if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id || !lab_test_master_id) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    // Get a connection from the pool
    const connection = await db.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Check if patient already exists
      const [existingPatients] = await connection.query(
        "SELECT * FROM patients WHERE hn_number = ? OR citizen_id = ?",
        [hn_number, citizen_id]
      );
      
      // Check for patient existence and potential conflicts
      if (existingPatients.length > 0) {
        const existingPatient = existingPatients[0];
        
        // Check for citizen_id conflict with different HN number
        if (existingPatient.hn_number !== hn_number && existingPatient.citizen_id === citizen_id) {
          return res.status(409).json({ 
            error: `Citizen ID ${citizen_id} already exists with different HN number ${existingPatient.hn_number}` 
          });
        }
        
        // Check for HN number conflict with different citizen_id
        if (existingPatient.hn_number === hn_number && existingPatient.citizen_id !== citizen_id) {
          return res.status(409).json({ 
            error: `HN number ${hn_number} already exists with different Citizen ID` 
          });
        }
        
        // If patient exists but all details match, we can proceed with just the lab test
        console.log(`Patient with HN ${hn_number} already exists, adding lab test only`);
      } else {
        // Patient doesn't exist, create new patient
        const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);
        
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

         // INSERT into patient_data table
         await connection.query(
          `INSERT INTO patient_data (hn_number) VALUES (?)`,
          [hn_number]
        );
        
        console.log(`Created new patient with HN ${hn_number}`);
      }
      
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
        message: "Lab test created successfully.",
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
    console.error("Error processing patient request:", error);
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
                'doctor', d.name,
                'doctor_id', d.id
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
      `SELECT * FROM appointments WHERE id = ? AND hn_number = ? AND status = 'rescheduled'`,
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

// Patient click Cancel for any appointments
router.put("/:appointmentId/cancel", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { hnNumber } = req.body; // For verification purposes
    
    // First, verify this appointment belongs to this patient
    const [appointment] = await db.query(
      `SELECT * FROM appointments WHERE id = ? AND hn_number = ?`,
      [appointmentId, hnNumber]
    );
    
    if (appointment.length === 0) {
      return res.status(404).json({ 
        message: "Appointment not found or not eligible for cancellation" 
      });
    }
    
    // Update the appointment status to Scheduled
    await db.query(
      `UPDATE appointments SET status = 'canceled' WHERE id = ?`,
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

// Patient click Reschedule for any appointments
// Patient reschedules an appointment
router.patch("/:appointmentId/reschedule", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { doctor_id, hn_number, appointment_date, appointment_time } = req.body;

    // Step 1: Verify that the appointment belongs to the patient and matches doctor_id
    const [existingAppointments] = await db.query(
      `SELECT * FROM appointments WHERE id = ? AND hn_number = ? AND doctor_id = ?`,
      [appointmentId, hn_number, doctor_id]
    );

    if (existingAppointments.length === 0) {
      return res.status(404).json({ 
        message: "Appointment not found or access denied" 
      });
    }

    const currentAppointment = existingAppointments[0];

    // Step 2: Check if appointment_date or appointment_time is changing
    const isDateChanged = appointment_date && appointment_date !== currentAppointment.appointment_date;
    const isTimeChanged = appointment_time && appointment_time !== currentAppointment.appointment_time;

    if (!isDateChanged && !isTimeChanged) {
      return res.status(400).json({
        message: "No changes detected in appointment date or time"
      });
    }

    // Step 3: Update the appointment with new values and set status to Pending
    await db.query(
      `UPDATE appointments 
       SET appointment_date = ?, appointment_time = ?, status = 'pending' 
       WHERE id = ?`,
      [
        appointment_date || currentAppointment.appointment_date,
        appointment_time || currentAppointment.appointment_time,
        appointmentId
      ]
    );

    res.json({
      message: "Appointment rescheduled successfully. Status set to Pending.",
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

// router.get('/details/:hn_number', async (req, res) => {
//   const { hn_number } = req.params;

//   try {
//     // Query to fetch patient details and completed lab tests with recommendations
//     const [rows] = await db.execute(`
//       SELECT 
//         p.hn_number,
//         p.name AS patient_name,
//         pd.gender,
//         pd.blood_type,
//         lt.lab_test_date,
//         ltm.test_name AS lab_test_name,
//         r.generated_recommendation,
//         r.status AS recommendation_status
//       FROM patients p
//       JOIN patient_data pd ON p.hn_number = pd.hn_number
//       LEFT JOIN lab_tests lt ON p.hn_number = lt.hn_number AND lt.status = 'completed'
//       LEFT JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
//       LEFT JOIN recommendations r ON r.lab_test_id = lt.id AND r.status = 'sent'
//       WHERE p.hn_number = ?
//     `, [hn_number]);

//     if (rows.length === 0) {
//       return res.status(404).json({ success: false, message: 'Patient not found' });
//     }

//     res.status(200).json({ success: true, data: rows });
//   } catch (err) {
//     console.error('Error fetching patient details:', err);
//     res.status(500).json({ success: false, message: 'Internal server error' });
//   }
// });
router.get('/details/:hnNumber', async (req, res) => {
  const { hnNumber } = req.params; // Get the hnNumber from URL parameters

  try {
    // Query to fetch completed lab tests, their items, and recommendations
    const [rows] = await dbç.execute(`
      SELECT 
        p.hn_number,
        p.name AS patient_name,
        lt.lab_test_date,
        ltm.test_name AS lab_test_name,
        li.lab_item_name,
        r.generated_recommendation
      FROM patients p
      JOIN lab_tests lt ON p.hn_number = lt.hn_number
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN lab_test_items lti ON lt.lab_test_master_id = lti.lab_test_master_id
      JOIN lab_items li ON lti.lab_item_id = li.id
      JOIN recommendations r ON r.lab_test_id = lt.id
      WHERE lt.status = 'completed' AND r.status = 'sent' AND p.hn_number = ?
      ORDER BY lt.lab_test_date DESC
    `, [hnNumber]); // Use parameterized query to avoid SQL injection

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No completed lab tests found for this patient.' });
    }

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching completed lab tests:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// patients lab tests
router.get('/lab-tests/:hn_number', async (req, res) => {
  const { hn_number } = req.params;

  try {
    const [rows] = await db.execute(`
      SELECT 
        lt.id AS lab_test_id,
        lt.lab_test_date,
        ltm.test_name
      FROM lab_tests lt
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      WHERE lt.hn_number = ?
      ORDER BY lt.lab_test_date DESC
    `, [hn_number]);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching lab tests for patient:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// each lab tests lab items
router.get('/lab-test-items/:lab_test_id', async (req, res) => {
  const { lab_test_id } = req.params;

  try {
    const [rows] = await db.execute(`
      SELECT 
        li.id AS lab_item_id,
        li.lab_item_name,
        li.unit,
        ref.normal_range,
        lr.lab_item_value,
        lr.lab_item_status,
        lt.lab_test_date
      FROM lab_results lr
      JOIN lab_items li ON lr.lab_item_id = li.id
      JOIN lab_references ref ON ref.lab_item_id = li.id
      JOIN lab_tests lt ON lr.lab_test_id = lt.id
      WHERE lr.lab_test_id = ?
    `, [lab_test_id]);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching lab items:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/lab-test/:lab_test_id/recommendations', async (req, res) => {
  const { lab_test_id } = req.params;

  try {
    const [rows] = await db.execute(`
      SELECT 
        r.id AS recommendation_id,
        r.status AS recommendation_status,
        r.updated_at,
        r.generated_recommendation,
        d.name AS doctor_name,
        d.specialization,
        lt.lab_test_date,
        ltm.test_name
      FROM recommendations r
      JOIN lab_tests lt ON r.lab_test_id = lt.id
      JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
      JOIN doctors d ON r.doctor_id = d.id
      WHERE r.lab_test_id = ?
    `, [lab_test_id]);

    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
