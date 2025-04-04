const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const db = require("../db");
const bcrypt = require("bcrypt");
const router = express.Router();
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploads

const saltRounds = 10; // the times the hashing algorithm will run to generate a  secure salt

// function formatDate(date) {
//   // Convert a date string to the format YYYY-MM-DD
//   const parsedDate = new Date(date);
//   if (isNaN(parsedDate)) return null; // Return null if the date is invalid

//   const year = parsedDate.getFullYear();
//   const month = (parsedDate.getMonth() + 1).toString().padStart(2, "0");
//   const day = parsedDate.getDate().toString().padStart(2, "0");

//   return `${year}-${month}-${day}`;
// }

// patient blulk upload with csv (new)
router.post("/patients", upload.single("csvFile"), (req, res) => {
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

      try {
        for (const row of records) {
          const {
            hn_number,
            name,
            citizen_id,
            phone_no,
            doctor_id,
            lab_test_name,
            lab_test_date, // Now included in CSV
          } = row;

          if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id || !lab_test_name) {
            continue; // Skip rows with missing data
          }

          // Find lab_test_master_id from lab_test_name
          const labTestQuery = "SELECT id FROM lab_tests_master WHERE test_name = ?";
          const labTestMasterId = await new Promise((resolve, reject) => {
            db.query(labTestQuery, [lab_test_name], (err, results) => {
              if (err) return reject(err);
              resolve(results.length > 0 ? results[0].id : null);
            });
          });

          if (!labTestMasterId) {
            console.warn(`Skipping record: No matching test name found for ${lab_test_name}`);
            continue;
          }

          const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);
          const formattedLabTestDate = lab_test_date ? new Date(lab_test_date) : new Date();

          await new Promise((resolve, reject) => {
            db.beginTransaction((err) => {
              if (err) return reject(err);

              const patientQuery = `
                INSERT INTO patients (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
              const patientValues = [
                hn_number,
                name,
                citizen_id,
                phone_no,
                hashedPassword,
                false,
                false,
                doctor_id,
              ];

              db.query(patientQuery, patientValues, (err) => {
                if (err) return db.rollback(() => reject(err));

                const labTestInsertQuery = `
                  INSERT INTO lab_tests (hn_number, lab_test_master_id, status, lab_test_date)
                  VALUES (?, ?, ?, ?)`;
                const labTestValues = [hn_number, labTestMasterId, "pending", formattedLabTestDate];

                db.query(labTestInsertQuery, labTestValues, (err) => {
                  if (err) return db.rollback(() => reject(err));

                  db.commit((err) => {
                    if (err) return db.rollback(() => reject(err));
                    resolve();
                  });
                });
              });
            });
          });
        }

        fs.unlinkSync(filePath);
        res.send("CSV file uploaded and patients with lab tests inserted successfully");
      } catch (error) {
        fs.unlinkSync(filePath);
        return res.status(500).send("Error inserting patients: " + error.message);
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
