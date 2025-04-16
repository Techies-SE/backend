const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const db = require("../db");
const bcrypt = require("bcrypt");
const router = express.Router();
const upload = multer({ dest: "uploads/" }); // Temporary folder for uploads

const saltRounds = 10; // the times the hashing algorithm will run to generate a  secure salt

// fixed ***
// router.post("/patients", upload.single("csvFile"), async (req, res) => {
//   if (!req.file) return res.status(400).send("No file uploaded");

//   const filePath = req.file.path;
//   const records = [];

//   try {
//     // Read and parse CSV file
//     await new Promise((resolve, reject) => {
//       fs.createReadStream(filePath)
//         .pipe(csv())
//         .on("data", (row) => records.push(row))
//         .on("end", resolve)
//         .on("error", reject);
//     });

//     if (records.length === 0) {
//       fs.unlinkSync(filePath);
//       return res.send("No data found in CSV");
//     }

//     // Process each record
//     for (const row of records) {
//       const {
//         hn_number,
//         name,
//         citizen_id,
//         phone_no,
//         doctor_id,
//         lab_test_name,
//         lab_test_date,
//       } = row;

//       if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id || !lab_test_name) {
//         continue; // Skip rows with missing data
//       }

//       // Find lab_test_master_id from lab_test_name
//       const [labTestResults] = await db.query(
//         "SELECT id FROM lab_tests_master WHERE test_name = ?",
//         [lab_test_name]
//       );

//       const labTestMasterId = labTestResults.length > 0 ? labTestResults[0].id : null;

//       if (!labTestMasterId) {
//         console.warn(`Skipping record: No matching test name found for ${lab_test_name}`);
//         continue;
//       }

//       const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);
//       const formattedLabTestDate = lab_test_date ? new Date(lab_test_date) : new Date();

//       // Start transaction
//       const connection = await db.getConnection();
      
//       try {
//         await connection.beginTransaction();

//         // Insert patient
//         await connection.query(
//           `INSERT INTO patients 
//            (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
//            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//           [
//             hn_number,
//             name,
//             citizen_id,
//             phone_no,
//             hashedPassword,
//             false,
//             false,
//             doctor_id,
//           ]
//         );

//         // Insert lab test
//         await connection.query(
//           `INSERT INTO lab_tests 
//            (hn_number, lab_test_master_id, status, lab_test_date)
//            VALUES (?, ?, ?, ?)`,
//           [hn_number, labTestMasterId, "pending", formattedLabTestDate]
//         );

//         await connection.commit();
//       } catch (error) {
//         await connection.rollback();
//         throw error;
//       } finally {
//         connection.release(); // Always release the connection
//       }
//     }

//     // Clean up and respond
//     fs.unlinkSync(filePath);
//     res.send("CSV file uploaded and patients with lab tests inserted successfully");
//   } catch (error) {
//     // Ensure file is deleted on error
//     if (fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//     }
//     console.error("Error processing upload:", error);
//     return res.status(500).send("Error inserting patients: " + error.message);
//   }
// });
// router.post("/patients", upload.single("csvFile"), async (req, res) => {
//   if (!req.file) return res.status(400).send("No file uploaded");

//   const filePath = req.file.path;
//   const records = [];
//   const processedPatients = new Set(); // Track which patients we've already processed

//   try {
//     // Read and parse CSV file
//     await new Promise((resolve, reject) => {
//       fs.createReadStream(filePath)
//         .pipe(csv())
//         .on("data", (row) => records.push(row))
//         .on("end", resolve)
//         .on("error", reject);
//     });

//     if (records.length === 0) {
//       fs.unlinkSync(filePath);
//       return res.send("No data found in CSV");
//     }

//     // Process each record
//     for (const row of records) {
//       const {
//         hn_number,
//         name,
//         citizen_id,
//         phone_no,
//         doctor_id,
//         lab_test_name,
//         lab_test_date,
//       } = row;

//       if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id || !lab_test_name) {
//         console.warn("Skipping row with missing required data");
//         continue; // Skip rows with missing data
//       }

//       // Find lab_test_master_id from lab_test_name
//       const [labTestResults] = await db.query(
//         "SELECT id FROM lab_tests_master WHERE test_name = ?",
//         [lab_test_name]
//       );

//       const labTestMasterId = labTestResults.length > 0 ? labTestResults[0].id : null;

//       if (!labTestMasterId) {
//         console.warn(`Skipping record: No matching test name found for ${lab_test_name}`);
//         continue;
//       }

//       const formattedLabTestDate = lab_test_date ? new Date(lab_test_date) : new Date();

//       // Start transaction
//       const connection = await db.getConnection();
      
//       try {
//         await connection.beginTransaction();

//         // Check if patient already exists
//         const [existingPatients] = await connection.query(
//           "SELECT hn_number FROM patients WHERE hn_number = ?",
//           [hn_number]
//         );

//         // Only insert patient if they don't already exist
//         if (existingPatients.length === 0 && !processedPatients.has(hn_number)) {
//           const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);
          
//           await connection.query(
//             `INSERT INTO patients 
//              (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
//              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//             [
//               hn_number,
//               name,
//               citizen_id,
//               phone_no,
//               hashedPassword,
//               false,
//               false,
//               doctor_id,
//             ]
//           );
          
//           processedPatients.add(hn_number); // Mark this patient as processed
//         }

//         // Always insert the lab test
//         await connection.query(
//           `INSERT INTO lab_tests 
//            (hn_number, lab_test_master_id, status, lab_test_date)
//            VALUES (?, ?, ?, ?)`,
//           [hn_number, labTestMasterId, "pending", formattedLabTestDate]
//         );

//         await connection.commit();
//       } catch (error) {
//         await connection.rollback();
//         throw error;
//       } finally {
//         connection.release(); // Always release the connection
//       }
//     }

//     // Clean up and respond
//     fs.unlinkSync(filePath);
//     res.send("CSV file uploaded and patients with lab tests inserted successfully");
//   } catch (error) {
//     // Ensure file is deleted on error
//     if (fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//     }
//     console.error("Error processing upload:", error);
//     return res.status(500).send("Error inserting patients: " + error.message);
//   }
// });
// router.post("/patients", upload.single("csvFile"), async (req, res) => {
//   if (!req.file) return res.status(400).send("No file uploaded");

//   const filePath = req.file.path;
//   const records = [];
//   const processedPatients = new Set(); // Track which patients we've already processed

//   try {
//     // Read and parse CSV file
//     await new Promise((resolve, reject) => {
//       fs.createReadStream(filePath)
//         .pipe(csv())
//         .on("data", (row) => records.push(row))
//         .on("end", resolve)
//         .on("error", reject);
//     });

//     if (records.length === 0) {
//       fs.unlinkSync(filePath);
//       return res.send("No data found in CSV");
//     }

//     let successCount = 0;
//     let skipCount = 0;
    
//     // Process each record
//     for (const row of records) {
//       const {
//         hn_number,
//         name,
//         citizen_id,
//         phone_no,
//         doctor_id,
//         lab_test_name,
//         lab_test_date,
//       } = row;

//       if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id || !lab_test_name) {
//         console.warn("Skipping row with missing required data");
//         skipCount++;
//         continue; // Skip rows with missing data
//       }

//       // Find lab_test_master_id from lab_test_name
//       const [labTestResults] = await db.query(
//         "SELECT id FROM lab_tests_master WHERE test_name = ?",
//         [lab_test_name]
//       );

//       const labTestMasterId = labTestResults.length > 0 ? labTestResults[0].id : null;

//       if (!labTestMasterId) {
//         console.warn(`Skipping record: No matching test name found for ${lab_test_name}`);
//         skipCount++;
//         continue;
//       }

//       const formattedLabTestDate = lab_test_date ? new Date(lab_test_date) : new Date();

//       // Start transaction
//       const connection = await db.getConnection();
      
//       try {
//         await connection.beginTransaction();

//         // Check if patient already exists by either hn_number or citizen_id
//         const [existingPatients] = await connection.query(
//           "SELECT hn_number FROM patients WHERE hn_number = ? OR citizen_id = ?",
//           [hn_number, citizen_id]
//         );

//         // Only insert patient if they don't already exist
//         if (existingPatients.length === 0 && !processedPatients.has(hn_number)) {
//           const hashedPassword = await bcrypt.hash(citizen_id, saltRounds);
          
//           await connection.query(
//             `INSERT INTO patients 
//              (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
//              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//             [
//               hn_number,
//               name,
//               citizen_id,
//               phone_no,
//               hashedPassword,
//               false,
//               false,
//               doctor_id,
//             ]
//           );
          
//           processedPatients.add(hn_number); // Mark this patient as processed
//         } else if (existingPatients.length > 0) {
//           console.log(`Patient with hn_number ${hn_number} or citizen_id ${citizen_id} already exists. Skipping patient insert.`);
//         }

//         // Always insert the lab test
//         await connection.query(
//           `INSERT INTO lab_tests 
//            (hn_number, lab_test_master_id, status, lab_test_date)
//            VALUES (?, ?, ?, ?)`,
//           [hn_number, labTestMasterId, "pending", formattedLabTestDate]
//         );

//         await connection.commit();
//         successCount++;
//       } catch (error) {
//         await connection.rollback();
//         console.error(`Error processing row for hn_number ${hn_number}:`, error.message);
//         skipCount++;
//       } finally {
//         connection.release(); // Always release the connection
//       }
//     }

//     // Clean up and respond
//     fs.unlinkSync(filePath);
//     res.send(`CSV file processed: ${successCount} records inserted successfully, ${skipCount} records skipped`);
//   } catch (error) {
//     // Ensure file is deleted on error
//     if (fs.existsSync(filePath)) {
//       fs.unlinkSync(filePath);
//     }
//     console.error("Error processing upload:", error);
//     return res.status(500).send("Error inserting patients: " + error.message);
//   }
// });
router.post("/patients", upload.single("csvFile"), async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");

  const filePath = req.file.path;
  const records = [];
  const processedPatients = new Set(); // Track which patients we've already processed
  const warnedHNs = new Set(); // Track which HN numbers we've already warned about

  try {
    // Read and parse CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => records.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    if (records.length === 0) {
      fs.unlinkSync(filePath);
      return res.send("No data found in CSV");
    }

    // First pass: Get all unique patients by HN number
    const patientMap = new Map(); // Map of HN numbers to patient data
    
    for (const row of records) {
      const { hn_number, name, citizen_id, phone_no, doctor_id } = row;
      
      if (!hn_number || !name || !citizen_id || !phone_no || !doctor_id) {
        continue; // Skip rows with missing data
      }
      
      // Store the patient data by HN number (last entry for each HN wins)
      patientMap.set(hn_number, { hn_number, name, citizen_id, phone_no, doctor_id });
    }
    
    console.log(`Found ${patientMap.size} unique patients in CSV`);
    
    // Check which patients already exist in the database
    const connection = await db.getConnection();
    const existingPatients = new Set();
    const existingCitizenIds = new Map();
    
    try {
      // Get all existing patients
      const [existingResults] = await connection.query(
        "SELECT hn_number, citizen_id FROM patients"
      );
      
      for (const patient of existingResults) {
        existingPatients.add(patient.hn_number);
        existingCitizenIds.set(patient.citizen_id, patient.hn_number);
      }
      
      console.log(`Found ${existingPatients.size} existing patients in database`);
      
      // First, insert all new patients
      let newPatientsInserted = 0;
      
      for (const [hn_number, patientData] of patientMap.entries()) {
        // Skip if patient already exists by HN
        if (existingPatients.has(hn_number)) {
          continue;
        }
        
        // Check for citizen_id conflict
        if (existingCitizenIds.has(patientData.citizen_id)) {
          const conflictHN = existingCitizenIds.get(patientData.citizen_id);
          if (!warnedHNs.has(hn_number)) {
            console.warn(`Patient with HN ${hn_number} has citizen_id ${patientData.citizen_id} which conflicts with existing patient HN ${conflictHN}`);
            warnedHNs.add(hn_number);
          }
          continue;
        }
        
        // Insert new patient
        const hashedPassword = await bcrypt.hash(patientData.citizen_id, saltRounds);
        
        await connection.query(
          `INSERT INTO patients 
           (hn_number, name, citizen_id, phone_no, password, lab_data_status, account_status, doctor_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            patientData.hn_number,
            patientData.name,
            patientData.citizen_id,
            patientData.phone_no,
            hashedPassword,
            false,
            false,
            patientData.doctor_id,
          ]
        );
        
        existingPatients.add(hn_number); // Mark as existing now
        existingCitizenIds.set(patientData.citizen_id, hn_number);
        newPatientsInserted++;
      }
      
      console.log(`Inserted ${newPatientsInserted} new patients`);
      
      // Now process all lab tests
      let labTestsInserted = 0;
      let labTestsSkipped = 0;
      
      for (const row of records) {
        const { hn_number, lab_test_name, lab_test_date } = row;
        
        if (!hn_number || !lab_test_name) {
          continue;
        }
        
        // Skip lab tests for patients that don't exist
        if (!existingPatients.has(hn_number)) {
          if (!warnedHNs.has(hn_number)) {
            console.warn(`Skipping lab test for non-existent patient with HN ${hn_number}`);
            warnedHNs.add(hn_number);
          }
          labTestsSkipped++;
          continue;
        }
        
        // Find lab_test_master_id
        const [labTestResults] = await connection.query(
          "SELECT id FROM lab_tests_master WHERE test_name = ?",
          [lab_test_name]
        );
        
        const labTestMasterId = labTestResults.length > 0 ? labTestResults[0].id : null;
        
        if (!labTestMasterId) {
          console.warn(`No matching test name found for ${lab_test_name}`);
          labTestsSkipped++;
          continue;
        }
        
        const formattedLabTestDate = lab_test_date ? new Date(lab_test_date) : new Date();
        
        // Insert lab test
        await connection.query(
          `INSERT INTO lab_tests 
           (hn_number, lab_test_master_id, status, lab_test_date)
           VALUES (?, ?, ?, ?)`,
          [hn_number, labTestMasterId, "pending", formattedLabTestDate]
        );
        
        labTestsInserted++;
      }
      
      console.log(`Inserted ${labTestsInserted} lab tests, skipped ${labTestsSkipped} lab tests`);
      
      // Clean up and respond
      fs.unlinkSync(filePath);
      res.send(`CSV file processed: ${newPatientsInserted} new patients inserted, ${labTestsInserted} lab tests inserted, ${labTestsSkipped} lab tests skipped`);
    } catch (error) {
      console.error("Error processing upload:", error);
      res.status(500).send("Error processing upload: " + error.message);
    } finally {
      connection.release();
    }
  } catch (error) {
    // Ensure file is deleted on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    console.error("Error processing upload:", error);
    return res.status(500).send("Error inserting patients: " + error.message);
  }
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
