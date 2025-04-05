// const express = require("express");
// const router = express.Router();
// const db = require("../db");

// // get a table for doctors-departments
// router.get("/", (req, res) => {
//   db.query(
//     `SELECT
//     doctors.id AS doctor_id,
//     doctors.name AS doctor_name,
//     doctors.specialization AS doctor_specialization,
//     departments.name AS department,
//     doctors.phone_no AS doctor_phone_no,
//     doctors.email AS doctor_email,
//     doctors.status AS status
//     FROM doctors
//     INNER JOIN departments ON doctors.department_id = departments.id
//      order by doctor_id asc;
//         `,
//     (err, results) => {
//       if (err) {
//         return res.status(500).json({ error: err.message });
//       }
//       res.json(results);
//     }
//   );
// });
// // get a table for doctors-departments with a specific id
// router.get("/:id/details", (req, res) => {
//   db.query(
//     `SELECT
//     doctors.id AS doctor_id,
//     doctors.name AS doctor_name,
//     doctors.specialization AS doctor_specialization,
//     departments.name AS department,
//     doctors.phone_no AS doctor_phone_no,
//     doctors.email AS doctor_email,
//     doctors.status AS status,
//     doctors.registered_at as registered_at,
//     doctors.updated_at as updated_at
//     FROM doctors
//     INNER JOIN departments ON doctors.department_id = departments.id
//      where doctors.id = ?
//         `,
//         [req.params.id],
//     (err, results) => {
//       if (err) {
//         return res.status(500).json({ error: err.message });
//       }
//       res.json(results);
//     }
//   );
// });

// module.exports = router;

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
