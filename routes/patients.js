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
    // Hash the citizen_id to create a password
    const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);

    // Start transaction
    db.beginTransaction((err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Insert into patients table
      const patientQuery = `
        INSERT INTO patients (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

      const patientValues = [
        hn_number,
        name,
        citizen_id,
        phone_no,
        hashedPassword,
        false,
        false,
        doctor_id,
      ];

      db.query(patientQuery, patientValues, (err, results) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ error: err.message });
          });
        }

        // Insert into lab_tests table with current timestamp for lab_test_result_date
        const labTestQuery = `
          INSERT INTO lab_tests (hn_number, lab_test_master_id, status, lab_test_date)
          VALUES (?, ?, ?, ?)`;

        const currentTimestamp = new Date(); // or use: new Date().toISOString()
        const labTestValues = [hn_number, lab_test_master_id, "pending", currentTimestamp];

        db.query(labTestQuery, labTestValues, (err, labResults) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({ error: err.message });
            });
          }

          // Commit transaction
          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json({ error: err.message });
              });
            }

            res.status(201).json({
              patient_id: results.insertId,
              message: "Patient and lab test created successfully.",
            });
          });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Get all patients
router.get("/", (req, res) => {
  db.query("SELECT * FROM patients", (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// Get a patient by ID
router.get("/:id", (req, res) => {
  const query = "SELECT * FROM patients WHERE id = ?";
  db.query(query, [req.params.id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }
    res.json(results[0]);
  });
});
// Get a patient by ID and inner join lab-data --- patients --- doctors
router.get("/:id/details", (req, res) => {
  db.query(
    `
    SELECT
    patients.id AS patient_id,
    patients.name AS patient_name,
    patients.hn_number AS hn_number,
    lab_data.age AS patient_age,
    lab_data.date_of_birth AS DOB,
    lab_data.gender AS patient_gender,
    lab_data.blood_type AS patient_blood_type,
    lab_data.weight AS patient_weight,
    lab_data.height AS  patient_height,
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
    where patients.id = ?
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

// Get a patient with appointments
router.get("/id=:id/appointments", async (req, res) => {
  const hnNum = req.params.id;
  const query = `SELECT a.hn_number,
    COUNT(a.id) AS total_appointments,
    JSON_ARRAYAGG(
        JSON_OBJECT(
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
GROUP BY a.hn_number;`;
  db.query(query, [hnNum], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.length === 0)
      return res.status(404).json({ message: "No appointments found" });
    res.json(result[0]);
  });
});

// get a patient with lab test and lab test items
router.get("/id=:id/lab-results", async (req, res) => {
  const hnNum = req.params.id;
  const query = `
    SELECT 
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
    WHERE lt.hn_number = ?
  `;

  db.query(query, [hnNum], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.length === 0)
      return res.status(404).json({ message: "No Lab Data Found" });

    // Grouping lab tests
    const response = {
      hn_number: hnNum,
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
  });
});


// Update a patient
router.put("/:id", (req, res) => {
  const { name, citizen_id, phone_no, email, password, status, doctor_id } =
    req.body;
  const query =
    "UPDATE patients SET name = ?, citizen_id = ?, phone_no = ?, email = ?, password = ?, status = ?, doctor_id = ? WHERE id = ?";
  db.query(
    query,
    [
      name,
      citizen_id,
      phone_no,
      email,
      password,
      status,
      doctor_id,
      req.params.id,
    ],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "Patient updated successfully" });
    }
  );
});

// Delete a patient
router.delete("/:id", (req, res) => {
  const query = "DELETE FROM patients WHERE id = ?";
  db.query(query, [req.params.id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: "Patient deleted successfully" });
  });
});

module.exports = router;
