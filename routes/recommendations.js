const express = require("express");
const router = express.Router();
const pool = require("../db"); // Ensure this is your createPool instance

// Create recommendation
router.post("/", async (req, res) => {
  const { recommendation, lab_test_id, patient_id, doctor_id } = req.body;

  try {
    const query =
      "INSERT INTO recommendations (recommendation, lab_test_id, patient_id, doctor_id) VALUES (?, ?, ?, ?)";
    const [results] = await pool.query(query, [
      recommendation,
      lab_test_id,
      patient_id,
      doctor_id,
    ]);

    res.status(201).json({ id: results.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all recommendations
router.get("/", async (req, res) => {
  try {
    const [results] = await pool.query("SELECT * FROM recommendations");

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// router.get("/pending-recommendations", async (req, res) => {
//   try {
//     const [rows] = await pool.execute(`
//         SELECT
//           p.hn_number,
//           p.name AS patient_name,
//           d.name AS doctor_name,
//           ltm.test_name AS lab_test_name,
//           r.generated_recommendation,
//           r.status
//         FROM recommendations r
//         JOIN lab_tests lt ON r.lab_test_id = lt.id
//         JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
//         JOIN patients p ON lt.hn_number = p.hn_number
//         JOIN doctors d ON p.doctor_id = d.id
//         WHERE r.status = 'pending'
//         ORDER BY r.updated_at DESC
//       `);

//     res.status(200).json({ success: true, data: rows });
//   } catch (err) {
//     console.error("Error fetching pending recommendations:", err);
//     res.status(500).json({ success: false, message: "Internal server error" });
//   }
// });

router.get("/pending-recommendations", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
        SELECT 
          r.id AS recommendation_id,
          p.hn_number,
          p.name AS patient_name,
          d.name AS doctor_name,
          ltm.test_name AS lab_test_name,
          r.generated_recommendation,
          r.status
        FROM recommendations r
        JOIN lab_tests lt ON r.lab_test_id = lt.id
        JOIN lab_tests_master ltm ON lt.lab_test_master_id = ltm.id
        JOIN patients p ON lt.hn_number = p.hn_number
        JOIN doctors d ON p.doctor_id = d.id
        WHERE r.status = 'pending'
        ORDER BY r.updated_at DESC
      `);

    res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("Error fetching pending recommendations:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/send-recommendation", async (req, res) => {
  const { recommendationId } = req.body;

  if (!recommendationId) {
    return res
      .status(400)
      .json({ success: false, message: "recommendationId is required" });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE recommendations 
         SET status = 'sent', updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
      [recommendationId]
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Recommendation not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Recommendation sent successfully" });
  } catch (err) {
    console.error("Error updating recommendation status:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

module.exports = router;
