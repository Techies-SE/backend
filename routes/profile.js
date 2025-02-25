const express = require("express");
const router = express.Router();
const db = require("../db");
const authenticateToken = require("../middlewear/auth");


// Protected Route
router.get("/", authenticateToken, (req, res)=>{
    const userId = req.user.id; // extract userID from token

    const patientQuery = `SELECT hn_number, name, citizen_id, phone_no, doctor_id, lab_data_status, account_status FROM patients WHERE id = ?`
    db.query(patientQuery, [userId], (err, patientResults)=>{
        if (err) return res.status(500).json({ error: "Database error" });
        if (patientResults.length === 0) return res.status(404).json({ error: "User not found" });

        const patient = patientResults[0];

        const labQuery = `SELECT gender, blood_type, age, date_of_birth, weight, height, bmi, systolic, diastolic, order_date FROM lab_data WHERE hn_number = ? ORDER BY order_date DESC`;

        db.query(labQuery, [patient.hn_number], (err, labResults)=>{
            if (err) return res.status(500).json({ error: "Database error" });
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
                    lab_data: labResults.length > 0 ? labResults : []
                }
            })
        })
    })

})

module.exports = router