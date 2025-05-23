const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../db");
const { spawn } = require("child_process");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const upload = require("../middlewear/upload");

const pythonScriptPath = path.join(__dirname, "../rule-based/script.py");

const {
  generateAndSaveRecommendation,
} = require("../services/generateAndSaveRecommendations");
const authenticateToken = require("../middlewear/auth");

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

// TODO: move inside the admin to bulk csv file upload
// Route to upload lab results
router.post("/upload-lab-results", upload.single("file"), authenticateToken,async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file is required." });
  }

  const results = [];
  const insertedLabTests = new Set();
  const processedGenderForTests = new Set(); // Track which tests already have gender processed
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

        // Insert gender for all associated lab tests
        const [testItemRows] = await connection.execute(
          "SELECT lab_test_master_id FROM lab_test_items WHERE lab_item_id = (SELECT id FROM lab_items WHERE lab_item_name = 'Gender')"
        );

        for (const testItem of testItemRows) {
          const labTestMasterId = testItem.lab_test_master_id;

          // Find the latest pending lab test for the patient with the associated lab_test_master_id
          const [testRows] = await connection.execute(
            `SELECT id FROM lab_tests
             WHERE hn_number = ? AND lab_test_master_id = ? AND status = 'pending'
             ORDER BY lab_test_date DESC LIMIT 1`,
            [hnNumber, labTestMasterId]
          );

          if (testRows.length > 0) {
            const labTestId = testRows[0].id; // Get the lab test ID

            // Check if we've already processed gender for this test
            const testKey = `${labTestId}|${labTestMasterId}`;
            if (processedGenderForTests.has(testKey)) {
              console.log(
                `⏭️ Gender already processed for lab test ID ${labTestId}. Skipping duplicate.`
              );
              continue;
            }

            // First check if gender already exists for this test
            const [existingGender] = await connection.execute(
              `SELECT id FROM lab_results 
               WHERE lab_test_id = ? AND lab_item_id = ?`,
              [labTestId, 9] // Assuming 9 is the ID for Gender
            );

            if (existingGender.length > 0) {
              // Update existing gender record instead of inserting a new one
              await connection.execute(
                `UPDATE lab_results SET lab_item_value = ?
                 WHERE lab_test_id = ? AND lab_item_id = ?`,
                [labItemValue, labTestId, 9]
              );
              console.log(
                `♻️ Updated existing gender value for lab test ID ${labTestId}`
              );
            } else {
              // Insert the gender value into lab_results
              await connection.execute(
                `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value)
                 VALUES (?, ?, ?)`,
                [labTestId, 9, labItemValue] // Assuming 9 is the ID for Gender
              );
              console.log(
                `✅ Inserted gender value for lab test ID ${labTestId}`
              );
            }

            // Mark this test as having gender processed
            processedGenderForTests.add(testKey);
            insertedLabTests.add(testKey); // Track processed tests
          }
        }
        continue; // Skip further processing for gender
      }

      // For non-gender fields, parse as float
      labItemValue = parseFloat(labItemValue);

      // Validate the input data
      if (!hnNumber || !labItemName || isNaN(labItemValue)) {
        console.warn(
          `❌ Invalid row data: ${JSON.stringify(row)}. Skipping...`
        );
        continue; // Skip invalid rows
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
      const testKey = `${labTestId}|${labTestMasterId}`;
      insertedLabTests.add(testKey); // Track inserted lab test
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

      // Check if result already exists for this test and item
      const [existingResult] = await connection.execute(
        `SELECT id FROM lab_results 
         WHERE lab_test_id = ? AND lab_item_id = ?`,
        [labTestId, labItemId]
      );

      if (existingResult.length > 0) {
        // Update existing record instead of inserting a new one
        await connection.execute(
          `UPDATE lab_results SET lab_item_value = ?
           WHERE lab_test_id = ? AND lab_item_id = ?`,
          [labItemValue, labTestId, labItemId]
        );
        console.log(`♻️ Updated existing value for lab item ${labItemName}`);
      } else {
        // Insert the lab result into the database
        await connection.execute(
          `INSERT INTO lab_results (lab_test_id, lab_item_id, lab_item_value)
           VALUES (?, ?, ?)`,
          [labTestId, labItemId, labItemValue]
        );
        console.log(`✅ Inserted value for lab item ${labItemName}`);
      }
    }

    // Loop through lab test groups and check for completeness
    for (const entry of insertedLabTests) {
      const [labTestId, labTestMasterId] = entry.split("|").map(Number);

      // Get required items
      const [requiredItems] = await connection.execute(
        "SELECT lab_item_id FROM lab_test_items WHERE lab_test_master_id = ?",
        [labTestMasterId]
      );

      const [uploadedItems] = await connection.execute(
        `SELECT DISTINCT lr.lab_item_id, li.lab_item_name, lr.lab_item_value
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

      // Check if all required items are present
      const requiredIds = new Set(requiredItems.map((r) => r.lab_item_id));
      const uploadedIds = new Set(uploadedItems.map((u) => u.lab_item_id));

      // Check if all required items are uploaded
      let allItemsUploaded = true;
      for (const id of requiredIds) {
        if (!uploadedIds.has(id)) {
          allItemsUploaded = false;
          break;
        }
      }

      if (!allItemsUploaded) {
        console.log(`⏳ Lab test ${labTestId} incomplete. Still pending.`);
        continue;
      }

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

      for (const item of uploadedItems) {
        // Skip gender for status updates
        if (item.lab_item_name === "Gender") continue;

        // Debug logging
        console.log(`Matching item: ${item.lab_item_name}`);
        console.log(`Looking for key in: ${Object.keys(statuses).join(", ")}`);

        // Handle different key formats
        const possibleKeys = [
          item.lab_item_name.toLowerCase().replace(/\s+/g, "_"), // "uric_acid"
          item.lab_item_name.toLowerCase(), // lowercase
          item.lab_item_name, // Original name if it matches exactly
          item.lab_item_name.replace(/\s+/g, ""), // Without spaces
        ];

        let status = "unknown";
        for (const key of possibleKeys) {
          if (statuses[key] && statuses[key].classification) {
            status = statuses[key].classification;
            break;
          }
        }

        console.log(`Found status: ${status}`);

        await connection.execute(
          `UPDATE lab_results SET lab_item_status = ? 
           WHERE lab_test_id = ? AND lab_item_id = ?`,
          [status, labTestId, item.lab_item_id]
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
    // 🔥 After the commit is successful
    for (const entry of insertedLabTests) {
      const [labTestIdStr] = entry.split("|");
      const labTestId = parseInt(labTestIdStr);

      try {
        const result = await generateAndSaveRecommendation(labTestId);
        console.log(
          `💡 Recommendation generated for lab test ${labTestId}:`,
          result
        );
      } catch (recommendationError) {
        console.error(
          `⚠️ Failed to generate recommendation for lab test ${labTestId}:`,
          recommendationError.message
        );
      }
    }

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
