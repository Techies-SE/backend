// // routes/labResults.js
// const express = require("express");
// const router = express.Router();
// const multer = require("multer");
// const pool = require("../db"); // Import your database connection
// const { spawn } = require("child_process");
// const csv = require("csv-parser");
// const fs = require("fs");
// const path = require("path"); 
// const upload = require("../middlewear/upload");

// const pythonScriptPath = path.join(__dirname, "../rule-based/script.py"); 


// function runPythonProcess(scriptPath, inputObject) {
//   return new Promise((resolve, reject) => {
//     const args = Object.entries(inputObject).map(([key, val]) => `--${key}=${val}`);
//     const python = spawn("python3", [scriptPath, ...args]);

//     let output = "";
//     python.stdout.on("data", (data) => (output += data.toString()));
//     python.stderr.on("data", (data) => console.error("Python stderr:", data.toString()));

//     python.on("close", () => {
//       try {
//         resolve(JSON.parse(output));
//       } catch (err) {
//         reject(`Invalid JSON from Python: ${output}`);
//       }
//     });
//   });
// }

// router.post("/upload-lab-results", upload.single("file"), async (req, res) => {
//   if (!req.file) return res.status(400).json({ message: "CSV file is required." });

//   const results = [];
//   const insertedLabTests = new Set();

//   try {
//     await pool.execute("START TRANSACTION");

//     fs.createReadStream(req.file.path)
//       .pipe(csv())
//       .on("data", (data) => results.push(data))
//       .on("end", async () => {
//         try {
//           for (const row of results) {
//             const hnNumber = row.hn_number;
//             const labItemName = row.lab_item_name;
//             const labItemValue = parseFloat(row.lab_item_value);

//             const [itemRows] = await pool.execute(
//               "SELECT id FROM lab_test_items WHERE name = ?",
//               [labItemName]
//             );
//             if (itemRows.length === 0) {
//               console.warn(`❌ Unknown lab item: ${labItemName}. Skipping...`);
//               continue;
//             }
//             const labItemId = itemRows[0].id;

//             const [testRows] = await pool.execute(
//               `SELECT id, lab_test_master_id FROM lab_tests
//                WHERE hn_number = ? AND status = 'pending'
//                ORDER BY lab_test_date DESC LIMIT 1`,
//               [hnNumber]
//             );
//             if (testRows.length === 0) {
//               console.warn(`⚠️ No active lab test for ${hnNumber}. Skipping...`);
//               continue;
//             }

//             const labTestId = testRows[0].id;
//             insertedLabTests.add(`${labTestId}|${testRows[0].lab_test_master_id}`);

//             await pool.execute(
//               `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value)
//                VALUES (?, ?, ?)`,
//               [labTestId, labItemId, labItemValue]
//             );
//           }

//           // ✅ Process each lab test group
//           for (const labTestEntry of insertedLabTests) {
//             const [labTestId, labTestMasterId] = labTestEntry.split("|").map(Number);

//             const [requiredItems] = await pool.execute(
//               "SELECT id, name FROM lab_test_items WHERE lab_test_master_id = ?",
//               [labTestMasterId]
//             );

//             const [uploadedItems] = await pool.execute(
//               "SELECT lab_item_id, lab_item_value FROM lab_results WHERE lab_test_id = ?",
//               [labTestId]
//             );

//             if (requiredItems.length !== uploadedItems.length) {
//               console.log(`⏳ Lab test ${labTestId} incomplete. Still pending.`);
//               continue;
//             }

//             const inputForPython = {};
//             for (const item of requiredItems) {
//               const match = uploadedItems.find((u) => u.lab_item_id === item.id);
//               if (match) inputForPython[item.name] = match.lab_item_value;
//             }

//             const statuses = await runPythonProcess(pythonScriptPath, inputForPython);

//             for (const item of requiredItems) {
//               await pool.execute(
//                 `UPDATE lab_results SET lab_item_status = ?
//                  WHERE lab_test_id = ? AND lab_item_id = ?`,
//                 [statuses[item.name] || "unknown", labTestId, item.id]
//               );
//             }

//             await pool.execute(
//               "UPDATE lab_tests SET status = 'completed' WHERE id = ?",
//               [labTestId]
//             );
//           }

//           await pool.execute("COMMIT");
//           fs.unlinkSync(req.file.path);
//           res.status(200).json({ message: "Lab results uploaded and processed successfully." });
//         } catch (error) {
//           await pool.execute("ROLLBACK");
//           console.error("❌ Error processing lab results:", error);
//           res.status(500).json({ message: "Error processing lab results." });
//         }
//       })
//       .on("error", async (err) => {
//         await pool.execute("ROLLBACK");
//         console.error("❌ Error reading CSV:", err);
//         res.status(500).json({ message: "Error reading CSV." });
//       });
//   } catch (err) {
//     console.error("❌ DB error:", err);
//     res.status(500).json({ message: "Database error." });
//   }
// });


// module.exports = router;
// routes/labResults.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../db"); // Import your database connection
const { spawn } = require("child_process");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path"); 
const upload = require("../middlewear/upload");

const pythonScriptPath = path.join(__dirname, "../rule-based/script.py"); 

function runPythonProcess(scriptPath, inputObject) {
  return new Promise((resolve, reject) => {
    const args = Object.entries(inputObject).map(([key, val]) => `--${key}=${val}`);
    const python = spawn("python3", [scriptPath, ...args]);

    let output = "";
    python.stdout.on("data", (data) => (output += data.toString()));
    python.stderr.on("data", (data) => console.error("Python stderr:", data.toString()));

    python.on("close", () => {
      try {
        resolve(JSON.parse(output));
      } catch (err) {
        reject(`Invalid JSON from Python: ${output}`);
      }
    });
  });
}

router.post("/upload-lab-results", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "CSV file is required." });

  const results = [];
  const insertedLabTests = new Set();

  try {
    // Get a connection for transaction
    const connection = await pool.getConnection();
    
    try {
      // Start transaction
      await connection.beginTransaction();
      
      // Read and process the CSV file
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on("data", (data) => {
            results.push(data);
          })
          .on("end", resolve)
          .on("error", reject);
      });
      
      // Process each row from the CSV
      for (const row of results) {
        const hnNumber = row.hn_number;
        const labItemName = row.lab_item_name;
        const labItemValue = parseFloat(row.lab_item_value);

        if (!hnNumber || !labItemName || isNaN(labItemValue)) {
          console.warn(`❌ Invalid row data: ${JSON.stringify(row)}. Skipping...`);
          continue;
        }

        const [itemRows] = await connection.execute(
          "SELECT id FROM lab_test_items WHERE name = ?",
          [labItemName]
        );
        
        if (itemRows.length === 0) {
          console.warn(`❌ Unknown lab item: ${labItemName}. Skipping...`);
          continue;
        }
        const labItemId = itemRows[0].id;

        const [testRows] = await connection.execute(
          `SELECT id, lab_test_master_id FROM lab_tests
           WHERE hn_number = ? AND status = 'pending'
           ORDER BY lab_test_date DESC LIMIT 1`,
          [hnNumber]
        );
        
        if (testRows.length === 0) {
          console.warn(`⚠️ No active lab test for ${hnNumber}. Skipping...`);
          continue;
        }

        const labTestId = testRows[0].id;
        insertedLabTests.add(`${labTestId}|${testRows[0].lab_test_master_id}`);

        await connection.execute(
          `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value)
           VALUES (?, ?, ?)`,
          [labTestId, labItemId, labItemValue]
        );
      }

      // Process each lab test group
      for (const labTestEntry of insertedLabTests) {
        const [labTestId, labTestMasterId] = labTestEntry.split("|").map(Number);

        const [requiredItems] = await connection.execute(
          "SELECT id, name FROM lab_test_items WHERE lab_test_master_id = ?",
          [labTestMasterId]
        );

        const [uploadedItems] = await connection.execute(
          "SELECT lab_item_id, lab_item_value FROM lab_results WHERE lab_test_id = ?",
          [labTestId]
        );

        if (requiredItems.length !== uploadedItems.length) {
          console.log(`⏳ Lab test ${labTestId} incomplete. Still pending.`);
          continue;
        }

        const inputForPython = {};
        for (const item of requiredItems) {
          const match = uploadedItems.find((u) => u.lab_item_id === item.id);
          if (match) inputForPython[item.name] = match.lab_item_value;
        }

        const statuses = await runPythonProcess(pythonScriptPath, inputForPython);

        for (const item of requiredItems) {
          await connection.execute(
            `UPDATE lab_results SET lab_item_status = ?
             WHERE lab_test_id = ? AND lab_item_id = ?`,
            [statuses[item.name] || "unknown", labTestId, item.id]
          );
        }

        await connection.execute(
          "UPDATE lab_tests SET status = 'completed' WHERE id = ?",
          [labTestId]
        );
      }

      // Commit transaction and clean up
      await connection.commit();
      connection.release();
      fs.unlinkSync(req.file.path);
      res.status(200).json({ message: "Lab results uploaded and processed successfully." });
    } catch (error) {
      // Rollback on error
      await connection.rollback();
      connection.release();
      console.error("❌ Error processing lab results:", error);
      res.status(500).json({ message: "Error processing lab results." });
    }
  } catch (err) {
    console.error("❌ DB error:", err);
    res.status(500).json({ message: "Database error." });
  }
});

module.exports = router;