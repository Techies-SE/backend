const express = require("express");
const router = express.Router();
const pool = require("../db"); // Make sure this is your createPool instance
const authenticateToken = require("../middlewear/auth");

router.get("/", authenticateToken, async (req, res) => {
  const userId = req.user.id;

  let connection;
  try {
    connection = await pool.getConnection();

    const [patientResults] = await connection.query(
      `SELECT id, hn_number, name, citizen_id, phone_no, doctor_id, lab_data_status, account_status 
       FROM patients 
       WHERE id = ?`,
      [userId]
    );

    if (patientResults.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const patient = patientResults[0];

    const [labResults] = await connection.query(
      `SELECT gender, blood_type, age, date_of_birth, weight, height, bmi, systolic, diastolic, order_date 
       FROM patient_data 
       WHERE hn_number = ? 
       ORDER BY order_date DESC`,
      [patient.hn_number]
    );

    res.json({
      message: "Welcome to your profile",
      user: {
        id: patient.id,
        hn_number: patient.hn_number,
        name: patient.name,
        citizen_id: patient.citizen_id,
        phone_no: patient.phone_no,
        doctor_id: patient.doctor_id,
        lab_data_status: patient.lab_data_status,
        account_status: patient.account_status,
        lab_data: labResults.length > 0 ? labResults : [],
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/id=:id/lab-results", authenticateToken, async (req, res) => {
  const hnNum = req.params.id;

  let connection;
  try {
    connection = await pool.getConnection();

    const [result] = await connection.query(
      `
      SELECT 
        lt.hn_number,
        lt.id AS lab_test_id,
        lt.lab_test_name,
        lt.lab_test_date,
        lti.lab_item_name,
        lti.lab_item_normal_ref_value,
        lti.lab_item_value,
        lti.unit,
        lti.lab_item_status,
        lti.lab_item_recommendation
      FROM lab_tests lt
      LEFT JOIN lab_test_items lti ON lt.id = lti.lab_test_id
      WHERE lt.hn_number = ?
      `,
      [hnNum]
    );

    if (result.length === 0)
      return res.status(404).json({ message: "No Lab Data Found" });

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
          unit: row.unit || "N/A",
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
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
