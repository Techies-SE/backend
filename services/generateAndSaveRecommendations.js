// services/generateAndSaveRecommendation.js


const db = require('../db.js');

const {generateRecommendation} = require('./geminiService.js');

const {createRecommendationPrompt} = require('./recommendationPrompt.js');

module.exports.generateAndSaveRecommendation = async function(lab_test_id) {
  try {
    // Step 1: Get lab test data + patient info
    const [labData] = await db.query(
      `
      SELECT 
        p.name AS patient_name,
        li.lab_item_name,
        lr.lab_item_value,
        lr.lab_item_status,
        li.unit
      FROM lab_results lr
      JOIN lab_items li ON lr.lab_item_id = li.id
      JOIN lab_tests lt ON lr.lab_test_id = lt.id
      JOIN patients p ON lt.hn_number = p.hn_number
      WHERE lr.lab_test_id = ?
      `,
      [lab_test_id]
    );

    if (labData.length === 0) throw new Error("No lab results found.");

    const patientName = labData[0].patient_name;
    const prompt = await createRecommendationPrompt(patientName, labData);

    // Step 2: Generate recommendation
    const aiRecommendation = await generateRecommendation(prompt);

    // Step 3: Save to recommendations table
    await db.query(
      `
      INSERT INTO recommendations (generated_recommendation, status, lab_test_id, updated_at)
      VALUES (?, 'pending', ?, NOW())
      `,
      [aiRecommendation, lab_test_id]
    );

    return { message: "Recommendation generated and saved successfully." };

  } catch (error) {
    console.error("Error generating recommendation:", error.message);
    throw error;
  }
}
