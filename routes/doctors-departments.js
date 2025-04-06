//fixed
const express = require("express");
const router = express.Router();
const pool = require("../db"); // promise-based connection pool

// GET all doctors with their department
router.get("/", async (req, res) => {
  try {
    const [results] = await pool.query(
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
      ORDER BY doctor_id ASC;`
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET doctor details by ID
router.get("/:id/details", async (req, res) => {
  try {
    const [results] = await pool.query(
      `SELECT
        doctors.id AS doctor_id,
        doctors.name AS doctor_name,
        doctors.specialization AS doctor_specialization,
        departments.name AS department,
        doctors.phone_no AS doctor_phone_no,
        doctors.email AS doctor_email,
        doctors.status AS status,
        doctors.registered_at AS registered_at,
        doctors.updated_at AS updated_at
      FROM doctors
      INNER JOIN departments ON doctors.department_id = departments.id
      WHERE doctors.id = ?;`,
      [req.params.id]
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
