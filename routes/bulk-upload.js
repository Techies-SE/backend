// newly created method
const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const router = express.Router();
const db = require("../db");

// Setup Multer for file upload
const upload = multer({ dest: "uploads/" });



// POST route for CSV upload
router.post("/upload", upload.single("file"), (req, res) => {
  const labTestId = req.body.lab_test_id; // Admin selects lab test type
  if (!labTestId) {
    return res.status(400).json({ error: "Lab test type is required" });
  }

  const filePath = req.file.path;
  let results = [];

  // Read CSV file and validate headers
  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (row) => {
      results.push(row);
    })
    .on("end", async () => {
      try {
        // Validate CSV columns based on lab_test_id
        const [expectedItems] = await db.promise().query(
          "SELECT lab_item_name FROM lab_items WHERE lab_test_id = ?",
          [labTestId]
        );

        const expectedHeaders = expectedItems.map((item) => item.lab_item_name);
        const csvHeaders = Object.keys(results[0]);

        if (!expectedHeaders.every((h) => csvHeaders.includes(h))) {
          return res.status(400).json({ error: "Invalid CSV format" });
        }

        // Insert data into lab_tests
        const [labTest] = await db.promise().query(
          "INSERT INTO lab_tests (lab_test_name, lab_test_result_date, hn_number) VALUES (?, NOW(), ?)",
          ["Lab Test " + labTestId, results[0].hn_number]
        );
        const labTestIdInserted = labTest.insertId;

        // Insert into lab_results
        for (const row of results) {
          for (const item of expectedHeaders) {
            await db.promise().query(
              "INSERT INTO lab_results (lab_test_id, lab_item_name, lab_item_value, hn_number) VALUES (?, ?, ?, ?)",
              [labTestIdInserted, item, row[item], row.hn_number]
            );
          }
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        // AI Recommendation Trigger (to be implemented)
        // You can call OpenAI API or your AI function here

        res.status(200).json({ message: "CSV uploaded successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
});

module.exports = router;