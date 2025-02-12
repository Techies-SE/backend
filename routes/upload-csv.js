const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const db = require("../db");
const bcrypt = require("bcrypt");
const router = express.Router();
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploads

function formatDate(date) {
  // Convert a date string to the format YYYY-MM-DD
  const parsedDate = new Date(date);
  if (isNaN(parsedDate)) return null; // Return null if the date is invalid

  const year = parsedDate.getFullYear();
  const month = (parsedDate.getMonth() + 1).toString().padStart(2, "0");
  const day = parsedDate.getDate().toString().padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Route to handle CSV upload
// upload patients info
router.post("/patients", upload.single("csvFile"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const filePath = req.file.path;
  const records = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => records.push(row))
    .on("end", () => {
      if (records.length === 0) return res.send("No data found in CSV");

      //const fields = Object.keys(records[0]); // Get column names from CSV
      const fields = [
        "hn_number",
        "name",
        "citizen_id",
        "phone_no",
        "email",
        "password",
        "status",
        "doctor_id",
      ];
      const query = `INSERT INTO patients (${fields.join(", ")}) VALUES ?`;
      const values = records.map((row) => fields.map((field) => row[field]));

      db.query(query, [values], (err) => {
        fs.unlinkSync(filePath); // Delete file after processing
        if (err)
          return res.status(500).send("Error inserting data: " + err.message);
        res.send("CSV file uploaded and data inserted successfully");
      });
    });
});

// router.post("/patients", upload.single("csvFile"), (req, res) => {
//   if (!req.file) return res.status(400).send("No file uploaded");

//   const filePath = req.file.path;
//   const records = [];

//   fs.createReadStream(filePath)
//     .pipe(csv())
//     .on("data", (row) => {
//       // ensure hn_number is treated as a string
//       row.hn_number = String(row.hn_number).padStart(9, "0");
//       // Hash password before insertion
//       if (row.password) {
//         row.password = bcrypt.hashSync(row.password, 10); // Hash the password
//       }
//     })
//     .on("end", () => {
//       if (records.length === 0) return res.send("No data found in CSV");

//       //const fields = Object.keys(records[0]); // Get column names from CSV
//       const fields = [
//         "hn_number",
//         "name",
//         "citizen_id",
//         "phone_no",
//         "email",
//         "password",
//         "status",
//         "doctor_id",
//       ];
//       const query = `INSERT INTO patients (${fields.join(", ")}) VALUES ?`;
//      // Map records to match column order
//      const values = records.map((row) => [
//       row.hn_number,
//       row.name,
//       row.citizen_id || null,  // Handle nulls
//       row.phone_no,
//       row.email,
//       row.password, // Ensure password is hashed
//       row.status || "active",  // Default to "active" if not present
//       row.doctor_id,
//     ]);

//       db.query(query, [values], (err) => {
//         fs.unlinkSync(filePath); // Delete file after processing
//         if (err)
//           return res.status(500).send("Error inserting data: " + err.message);
//         res.send("CSV file uploaded and data inserted successfully");
//       });
//     });
// });

// upload patients lab-data
router.post("/lab-data", upload.single("csvFile"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const filePath = req.file.path;
  const records = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => records.push(row))
    .on("end", () => {
      if (records.length === 0) return res.send("No data found in CSV");

      const fields = [
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
        "hn_number",
      ];
      const query = `INSERT INTO lab_data (${fields.join(", ")}) VALUES ?`;
      const values = records.map((row) => fields.map((field) => row[field]));

      db.query(query, [values], (err) => {
        fs.unlinkSync(filePath);
        if (err) res.status(500).send("Error inserting data: " + err.message);
        res.send("CSV file uploaded and data inserted successfully");
      });
    });
});
// router.post("/lab-data", upload.single("csvFile"), (req, res) => {
//   if (!req.file) return res.status(400).send("No file uploaded");

//   const filePath = req.file.path;
//   const records = [];

//   fs.createReadStream(filePath)
//     .pipe(csv())
//     .on("data", (row) => {
//       // Format the date field (adjust 'date_of_birth' to your actual column name)
//       if (row.date_of_birth) {
//         row.date_of_birth = formatDate(row.date_of_birth);
//       }
//       records.push(row);
//     })

//     .on("end", () => {
//       if (records.length === 0) return res.send("No data found in CSV");

//       const fields = [
//         "gender",
//         "blood_type",
//         "age",
//         "date_of_birth",
//         "weight",
//         "height",
//         "bmi",
//         "systolic",
//         "diastolic",
//         "order_date",
//         "hn_number",
//       ];
//       const query = `INSERT INTO lab_data (${fields.join(", ")}) VALUES ?`;
//       const values = records.map((row) => fields.map((field) => row[field]));

//       db.query(query, [values], (err) => {
//         fs.unlinkSync(filePath);
//         if (err) res.status(500).send("Error inserting data: " + err.message);
//         res.send("CSV file uploaded and data inserted successfully");
//       });
//     });
// });

module.exports = router;
