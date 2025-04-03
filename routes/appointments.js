const express = require("express");
const router = express.Router();
const db = require("../db");

// patient made an appointment
router.post("/confirmation", async (req, res) => {
    const { hn_number, doctor_id, appointment_date, appointment_time } = req.body;

    try {
        // Validate input data
        if (!hn_number || !doctor_id || !appointment_date || !appointment_time) {
            return res.status(400).json({ message: "All fields are required." });
        }

        // Get the patient_id from hn_number
        const [patient] = await db.promise().query(
            "SELECT id FROM patients WHERE hn_number = ?",
            [hn_number]
        );

        if (patient.length === 0) {
            return res.status(404).json({ message: "Patient not found." });
        }

        const patient_id = patient[0].id; // Get the patient ID

        // Insert new appointment into appointments table
        const [result] = await db.promise().query(
            "INSERT INTO appointments (hn_number, doctor_id, appointment_date, appointment_time, status) VALUES (?, ?, ?, ?, ?)",
            [hn_number, doctor_id, appointment_date, appointment_time, "pending"]
        );

        // Success response
        res.status(201).json({ message: "Appointment confirmed successfully!", appointment_id: result.insertId });
    } catch (error) {
        console.error("Error confirming appointment:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;
