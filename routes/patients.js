const express = require("express");
const router = express.Router();
const db = require("../db"); // Make sure to create a db.js file for database connection
const bcrypt = require('bcrypt');
const saltRounds = 10;

// create a patient 
router.post("/", async (req, res) => {
  const { hn_number, name, citizen_id, phone_no, doctor_id } = req.body;

  // Validate required fields
  if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // Hash the citizen_id to create a password
  const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);

  // Prepare the SQL query
  const query = `
    INSERT INTO patients (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  const values = [
    hn_number,
    name,
    citizen_id,
    phone_no,
    hashedPassword, // Hashed password
    false, // lab_data_status default value
    false, // account_status default value
    doctor_id
  ];

  // Execute the query
  db.query(query, values, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ id: results.insertId, message: "Patient created successfully." });
  });
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
