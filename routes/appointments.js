// ***
// all fixed
const express = require("express");
const router = express.Router();
const db = require("../db");

// Patient makes an appointment
router.post("/confirmation", async (req, res) => {
  const { hn_number, doctor_id, appointment_date, appointment_time, notes } = req.body;

  try {
    if (!hn_number || !doctor_id || !appointment_date || !appointment_time) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Find patient by hn_number
    const [patientRows] = await db.query(
      "SELECT id FROM patients WHERE hn_number = ?",
      [hn_number]
    );

    if (patientRows.length === 0) {
      return res.status(404).json({ message: "Patient not found." });
    }

    const patient_id = patientRows[0].id;

    // Insert new appointment
    const [insertResult] = await db.query(
      "INSERT INTO appointments (hn_number, doctor_id, appointment_date, appointment_time, status, notes) VALUES (?, ?, ?, ?, ?, ?)",
      [hn_number, doctor_id, appointment_date, appointment_time, "pending", notes]
    );

    res.status(201).json({
      message: "Appointment confirmed successfully!",
      appointment_id: insertResult.insertId,
    });
  } catch (error) {
    console.error("Error confirming appointment:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
