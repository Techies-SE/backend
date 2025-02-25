const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const db = require("../db");
const bcrypt = require("bcrypt");
const router = express.Router();
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploads

const saltRounds = 10; // the times the hashing algorithm will run to generate a  secure salt

function formatDate(date) {
  // Convert a date string to the format YYYY-MM-DD
  const parsedDate = new Date(date);
  if (isNaN(parsedDate)) return null; // Return null if the date is invalid

  const year = parsedDate.getFullYear();
  const month = (parsedDate.getMonth() + 1).toString().padStart(2, "0");
  const day = parsedDate.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// patient bulk upload with CSV
router.post("/patients", upload.single("csvFile"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const filePath = req.file.path;
  const records = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => records.push(row))
    .on("end", async () => {
      if (records.length === 0) {
        fs.unlinkSync(filePath); // Clean up the file
        return res.send("No data found in CSV");
      }

      // Define the fields for insertion, including additional columns
      const fields = [
        "hn_number",
        "name",
        "citizen_id",
        "phone_no",
        "password",
        "lab_data_status",
        "account_status",
        "doctor_id",
      ];

      try {
        // Map each record to an array of values, hashing the citizen_id for the password,
        // and setting lab_data_status & account_status to false.
        const values = await Promise.all(
          records.map(async (row) => {
            const hashedPassword = await bcrypt.hash(row.citizen_id, saltRounds);
            return [
              row.hn_number,
              row.name,
              row.citizen_id,
              row.phone_no,
              hashedPassword,
              false, // lab_data_status default value
              false, // account_status default value
              row.doctor_id,
            ];
          })
        );

        const query = `INSERT INTO patients (${fields.join(", ")}) VALUES ?`;
        db.query(query, [values], (err) => {
          fs.unlinkSync(filePath); // Delete file after processing
          if (err) {
            return res.status(500).send("Error inserting data: " + err.message);
          }
          res.send("CSV file uploaded and data inserted successfully");
        });
      } catch (error) {
        fs.unlinkSync(filePath); // Clean up file in case of error
        return res.status(500).send("Error processing CSV data: " + error.message);
      }
    });
});

router.post("/lab-data", upload.single("csvFile"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const filePath = req.file.path;
  const records = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => records.push(row))
    .on("end", async () => {
      if (records.length === 0) {
        fs.unlinkSync(filePath);
        return res.send("No data found in CSV");
      }
      
      // Insert lab data records (simplified)
      const labDataFields = [
        "gender",
        "blood_type",
        "age",
        "date_of_birth",
        "weight",
        "height",
        "bmi",
        "systolic",
        "diastolic",
        "order_date",
        "hn_number"
      ];

      const labDataQuery = `INSERT INTO lab_data (${labDataFields.join(", ")}) VALUES ?`;
      const labDataValues = records.map((row) =>
        labDataFields.map((field) => row[field])
      );

      db.query(labDataQuery, [labDataValues], (err) => {
        if (err) {
          fs.unlinkSync(filePath);
          return res.status(500).send("Error inserting lab data: " + err.message);
        }

        // After inserting lab data, update patients table for each hn_number
        // Get unique hn_numbers from the CSV
        const hnNumbers = [...new Set(records.map(row => row.hn_number))];
        const updateQuery = `UPDATE patients SET lab_data_status = true WHERE hn_number IN (?)`;

        db.query(updateQuery, [hnNumbers], (updateErr) => {
          fs.unlinkSync(filePath);
          if (updateErr) {
            return res.status(500).send("Error updating patient status: " + updateErr.message);
          }
          res.send("Lab data uploaded and patient status updated successfully");
        });
      });
    });
});


module.exports = router;
