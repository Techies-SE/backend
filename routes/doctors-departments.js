const express = require("express");
const router = express.Router();
const db = require("../db");

// get a table for doctors-departments
router.get("/", (req, res) => {
  db.query(
    `SELECT
    doctors.id AS doctor_id,
    doctors.name AS doctor_name,
    doctors.specialization AS doctor_specialization,
    departments.name AS department,
    doctors.phone_no AS doctor_phone_no,
    doctors.email AS doctor_email,
    doctors.status AS status
    FROM doctors
    INNER JOIN departments ON doctors.department_id = departments.id
     order by doctor_id asc;
        `,
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    }
  );
});
// get a table for doctors-departments with a specific id
router.get("/:id/details", (req, res) => {
  db.query(
    `SELECT
    doctors.id AS doctor_id,
    doctors.name AS doctor_name,
    doctors.specialization AS doctor_specialization,
    departments.name AS department,
    doctors.phone_no AS doctor_phone_no,
    doctors.email AS doctor_email,
    doctors.status AS status,
    doctors.registered_at as registered_at,
    doctors.updated_at as updated_at
    FROM doctors
    INNER JOIN departments ON doctors.department_id = departments.id
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

module.exports = router;
