const express = require("express");
const router = express.Router();
const db = require('../db');

//get a table for lab_data - patients - doctors
router.get("/", (req, res) => {
  db.query(
    `
    SELECT
    patients.id AS patient_id,
    patients.name AS patient_name,
    patients.hn_number AS hn_number,
    lab_data.age AS patient_age,
    lab_data.gender AS patient_gender,
    lab_data.blood_type AS patient_blood_type,
    doctors.name AS doctor_name,
    patients.phone_no AS patient_phone,
    patients.email AS patient_email
    FROM patients
    INNER JOIN doctors ON patients.doctor_id = doctors.id
    INNER JOIN lab_data ON lab_data.hn_number = patients.hn_number
    order by hn_number desc;
    `,
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    }
  );
});

module.exports = router;
