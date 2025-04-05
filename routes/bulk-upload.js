const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../db");
const { spawn } = require("child_process");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const upload = require("../middlewear/upload"); // Fix the typo from "middlewear" to "middlewares"

const pythonScriptPath = path.join(__dirname, "../rule-based/script.py");

// Define runPythonProcess properly
async function runPythonProcess(scriptPath, labTestMasterId, inputForPython) {
  return new Promise((resolve, reject) => {
    // Convert the input data to JSON
    const jsonInput = JSON.stringify(inputForPython);

    // Run Python with the correct arguments
    const pythonProcess = spawn("python", [
      scriptPath,
      labTestMasterId.toString(), // Convert number to string
      jsonInput,
    ]);

    let resultData = "";
    let errorData = "";

    pythonProcess.stdout.on("data", (data) => {
      resultData += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      console.error(`Python stderr: ${data}`);
      errorData += data.toString();
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        reject(new Error(`Python error: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(resultData);
        resolve(result);
      } catch (error) {
        console.error(`Invalid JSON from Python: ${resultData}`);
        reject(new Error(`Invalid JSON from Python: ${resultData}`));
      }
    });
  });
}

// Route to upload lab results
router.post("/upload-lab-results", upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "CSV file is required." });

  const results = [];
  const insertedLabTests = new Set();
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", resolve)
        .on("error", reject);
    });

    for (const row of results) {
      const hnNumber = row.hn_number; // Patient's HN number
      const labItemName = row.lab_item_name; // Lab item name
      let labItemValue = row.lab_item_value; // Lab item value as string initially
      console.log(`🔍 Processing lab item: "${labItemName}"`);

      // Special handling for Gender values
      if (labItemName === "Gender") {
        // Convert gender to numeric value (M=0, F=1)
        if (labItemValue === "M" || labItemValue === "m") {
          labItemValue = 0;
        } else if (labItemValue === "F" || labItemValue === "f") {
          labItemValue = 1;
        } else {
          console.warn(`❌ Invalid gender value: ${labItemValue}. Skipping...`);
          continue; // Skip invalid gender values
        }
      } else {
        // For non-gender fields, parse as float
        labItemValue = parseFloat(labItemValue);

        // Validate the input data
        if (!hnNumber || !labItemName || isNaN(labItemValue)) {
          console.warn(
            `❌ Invalid row data: ${JSON.stringify(row)}. Skipping...`
          );
          continue; // Skip invalid rows
        }
      }

      // Look up lab_item_id based on lab_item_name
      const [itemRows] = await connection.execute(
        "SELECT id FROM lab_items WHERE lab_item_name = ?",
        [labItemName]
      );
      console.log(`📦 Query result for "${labItemName}":`, itemRows);

      // Check if the lab item exists
      if (itemRows.length === 0) {
        console.warn(`❌ Unknown lab item: ${labItemName}. Skipping...`);
        continue; // Skip unknown lab items
      }

      const labItemId = itemRows[0].id; // Get the corresponding lab_item_id

      // Look up the lab_test_master_id using the lab_item_id
      const [testItemRows] = await connection.execute(
        "SELECT lab_test_master_id FROM lab_test_items WHERE lab_item_id = ?",
        [labItemId]
      );

      // Check if the lab_test_master_id exists
      if (testItemRows.length === 0) {
        console.warn(
          `❌ No associated lab test found for lab item ID: ${labItemId}. Skipping...`
        );
        continue; // Skip if no associated lab test
      }

      const labTestMasterId = testItemRows[0].lab_test_master_id; // Get the lab_test_master_id
      console.log("labMasterId" + labTestMasterId);

      // Find the latest pending lab test for the patient with the associated lab_test_master_id
      const [testRows] = await connection.execute(
        `SELECT id FROM lab_tests
         WHERE hn_number = ? AND lab_test_master_id = ? AND status = 'pending'
         ORDER BY lab_test_date DESC LIMIT 1`,
        [hnNumber, labTestMasterId]
      );

      // Check if there is an active lab test
      if (testRows.length === 0) {
        console.warn(
          `⚠️ No active lab test for ${hnNumber} with master ID ${labTestMasterId}. Skipping...`
        );
        continue; // Skip if no active test found
      }

      const labTestId = testRows[0].id; // Get the lab test ID
      insertedLabTests.add(`${labTestId}|${labTestMasterId}`); // Track inserted lab test
      console.log("labItemId" + labItemId);

      // Check if the lab_item_id is associated with the lab_test_id
      const [labTestItemRows] = await connection.execute(
        "SELECT lab_item_id FROM lab_test_items WHERE lab_test_master_id = ? AND lab_item_id = ?",
        [labTestMasterId, labItemId]
      );

      if (labTestItemRows.length === 0) {
        console.warn(
          `❌ Lab item ${labItemName} is not associated with lab_test_master_id ${labTestMasterId}. Skipping...`
        );
        continue;
      }

      // Insert the lab result into the database
      await connection.execute(
        `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value)
         VALUES (?, ?, ?)`,
        [labTestId, labItemId, labItemValue]
      );
    }

    // The rest of your code remains the same
    for (const entry of insertedLabTests) {
      const [labTestId, labTestMasterId] = entry.split("|").map(Number);

      // Get required items
      const [requiredItems] = await connection.execute(
        "SELECT lab_item_id FROM lab_test_items WHERE lab_test_master_id = ?",
        [labTestMasterId]
      );

      const [uploadedItems] = await connection.execute(
        `SELECT lr.lab_item_id, li.lab_item_name, lr.lab_item_value
         FROM lab_results lr
         JOIN lab_items li ON lr.lab_item_id = li.id
         JOIN lab_test_items lti ON lr.lab_item_id = lti.lab_item_id
         WHERE lr.lab_test_id = ? AND lti.lab_test_master_id = ?`,
        [labTestId, labTestMasterId]
      );

      console.log(`✅ Required count: ${requiredItems.length}`);
      console.log(`✅ Uploaded count: ${uploadedItems.length}`);
      console.log(
        "🧾 Required item IDs:",
        requiredItems.map((r) => r.lab_item_id)
      );
      console.log(
        "📄 Uploaded item IDs:",
        uploadedItems.map((u) => u.lab_item_id)
      );

      if (requiredItems.length !== uploadedItems.length) {
        console.log(`⏳ Lab test ${labTestId} incomplete. Still pending.`);
        continue;
      }

      // Prepare input for Python - special handling for Gender values
      const inputForPython = {};
      for (const item of uploadedItems) {
        if (item.lab_item_name === "Gender") {
          // Convert back to M/F for Python if needed
          inputForPython[item.lab_item_name] =
            item.lab_item_value == 0 ? "M" : "F";
        } else {
          // For other items, use the value as is (it's already numeric)
          inputForPython[item.lab_item_name] = parseFloat(item.lab_item_value);
        }
      }

      const statuses = await runPythonProcess(
        pythonScriptPath,
        labTestMasterId,
        inputForPython
      );

      console.log("Python returned statuses:", statuses);

      for (const item of requiredItems) {
        const matched = uploadedItems.find(
          (u) => u.lab_item_id === item.lab_item_id
        );
        if (!matched) continue;

        // Convert lab_item_name to lowercase to match Python response keys
        const itemNameLower = matched.lab_item_name.toLowerCase();

        // Extract the classification from the nested structure
        //const status = statuses[itemNameLower]?.classification || "unknown";
        const matchingKey = Object.keys(statuses).find(
          (key) => key.toLowerCase() === itemNameLower
        );
        const status = matchingKey
          ? statuses[matchingKey].classification
          : "unknown";

        await connection.execute(
          `UPDATE lab_results SET lab_item_status = ? 
           WHERE lab_test_id = ? AND lab_item_id = ?`,
          [status, labTestId, matched.lab_item_id]
        );
      }

      // Mark test as completed
      await connection.execute(
        "UPDATE lab_tests SET status = 'completed' WHERE id = ?",
        [labTestId]
      );

      // Update patient lab_data_status = true
      await connection.execute(
        `UPDATE patients SET lab_data_status = true 
         WHERE hn_number = (
            SELECT hn_number FROM lab_tests WHERE id = ?
         )`,
        [labTestId]
      );
    }

    await connection.commit();
    res
      .status(200)
      .json({ message: "Lab results uploaded and processed successfully." });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("❌ Error processing lab results:", error);
    res.status(500).json({ message: "Error processing lab results." });
  } finally {
    if (connection) connection.release();
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });
  }
});

module.exports = router;
