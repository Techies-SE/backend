const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/:hn_number", async (req, res) => {
  const hn_number = req.params.hn_number;

  try {
    const connection = await db.getConnection();

    const [rows] = await connection.query(
      `
        SELECT
          p.hn_number,
          p.name,
          p.citizen_id,
          p.phone_no,
          p.lab_data_status,
          p.account_status,
          p.registered_at,
          p.updated_at,
  
          pd.gender,
          pd.blood_type,
          pd.age,
          pd.date_of_birth,
          pd.weight,
          pd.height,
          pd.bmi,
  
          lt.id AS lab_test_id,
          lt.lab_test_date,
          lt.status AS lab_test_status,
          ltm.test_name,
  
          li.id AS lab_item_id,
          li.lab_item_name,
          li.unit,
          lr.lab_item_value,
          lr.lab_item_status,
          ref.normal_range,
  
          a.id AS appointment_id,
          a.appointment_date,
          a.appointment_time,
          a.notes,
          a.status,
          d.name AS doctor_name,
          dept.name AS department_name
  
        FROM patients p
        LEFT JOIN patient_data pd ON pd.hn_number = p.hn_number
        LEFT JOIN lab_tests lt ON lt.hn_number = p.hn_number
        LEFT JOIN lab_tests_master ltm ON ltm.id = lt.lab_test_master_id
        LEFT JOIN lab_results lr ON lr.lab_test_id = lt.id
        LEFT JOIN lab_items li ON li.id = lr.lab_item_id
        LEFT JOIN lab_references ref ON ref.lab_item_id = li.id
  
        LEFT JOIN appointments a ON a.hn_number = p.hn_number
        LEFT JOIN doctors d ON d.id = a.doctor_id
        LEFT JOIN departments dept ON dept.id = d.department_id
  
        WHERE p.hn_number = ?
        ORDER BY lt.lab_test_date DESC, a.appointment_date DESC
        `,
      [hn_number]
    );

    connection.release();

    if (rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Build a structured JSON response
    const patient = {
      hn_number: rows[0].hn_number,
      name: rows[0].name,
      citizen_id: rows[0].citizen_id,
      phone_no: rows[0].phone_no,
      lab_data_status: rows[0].lab_data_status,
      account_status: rows[0].account_status,
      registered_at: rows[0].registered_at,
      updated_at: rows[0].updated_at,
      patient_data: {
        gender: rows[0].gender,
        blood_type: rows[0].blood_type,
        age: rows[0].age,
        date_of_birth: rows[0].date_of_birth,
        weight: rows[0].weight,
        height: rows[0].height,
        bmi: rows[0].bmi,
      },
      lab_tests: [],
      appointments: [],
    };

    const labTestMap = new Map();
    const appointmentSet = new Set();

    for (const row of rows) {
      // Group Lab Tests
      if (row.lab_test_id && !labTestMap.has(row.lab_test_id)) {
        labTestMap.set(row.lab_test_id, {
          lab_test_date: row.lab_test_date,
          status: row.lab_test_status,
          test_name: row.test_name,
          results: [],
          resultMap: new Set(), // Track added lab_item_id to avoid duplicates
        });
      }

      if (row.lab_test_id && row.lab_item_id) {
        const labTest = labTestMap.get(row.lab_test_id);
        if (!labTest.resultMap.has(row.lab_item_id)) {
          labTest.results.push({
            lab_item_name: row.lab_item_name,
            lab_item_status: row.lab_item_status,
            unit: row.unit,
            value: row.lab_item_value,
            normal_range: row.normal_range,
          });
          labTest.resultMap.add(row.lab_item_id);
        }
      }

      // Group Appointments
      if (row.appointment_id && !appointmentSet.has(row.appointment_id)) {
        appointmentSet.add(row.appointment_id);
        patient.appointments.push({
          appointment_date: row.appointment_date,
          appointment_time: row.appointment_time,
          status: row.status,
          note: row.note,
          doctor: {
            name: row.doctor_name,
            department: row.department_name,
          },
        });
      }
    }

    //patient.lab_tests = Array.from(labTestMap.values());
    patient.lab_tests = Array.from(labTestMap.values()).map(
      ({ resultMap, ...rest }) => rest
    );
    res.json(patient);
  } catch (err) {
    console.error("Error fetching patient details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:hn_number/lab-test/:lab_test_id", async (req, res) => {
  const { hn_number, lab_test_id } = req.params;

  try {
    const connection = await db.getConnection();

    const [rows] = await connection.query(
      `
        SELECT
          p.hn_number,
          p.name,
          p.citizen_id,
          p.phone_no,
          p.lab_data_status,
          p.account_status,
          p.registered_at,
          p.updated_at,
  
          pd.gender,
          pd.blood_type,
          pd.age,
          pd.date_of_birth,
          pd.weight,
          pd.height,
          pd.bmi,
  
          lt.id AS lab_test_id,
          lt.lab_test_date,
          lt.status AS lab_test_status,
          ltm.test_name,
  
          li.id AS lab_item_id,
          li.lab_item_name,
          li.unit,
          lr.lab_item_value,
          lr.lab_item_status,
          ref.normal_range,
          
          r.id,
          r.generated_recommendation,
          r.status AS recommendation_status,
          r.updated_at AS recommendation_updated_at
  
        FROM patients p
        LEFT JOIN patient_data pd ON pd.hn_number = p.hn_number
        LEFT JOIN lab_tests lt ON lt.hn_number = p.hn_number
        LEFT JOIN lab_tests_master ltm ON ltm.id = lt.lab_test_master_id
        LEFT JOIN lab_results lr ON lr.lab_test_id = lt.id
        LEFT JOIN lab_items li ON li.id = lr.lab_item_id
        LEFT JOIN lab_references ref ON ref.lab_item_id = li.id
        LEFT JOIN recommendations r ON r.lab_test_id = lt.id
  
        WHERE p.hn_number = ? AND lt.id = ?
        ORDER BY lr.lab_item_id ASC
        `,
      [hn_number, lab_test_id]
    );

    connection.release();

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for this patient and lab test" });
    }

    // Construct response
    const patient = {
      hn_number: rows[0].hn_number,
      name: rows[0].name,
      citizen_id: rows[0].citizen_id,
      phone_no: rows[0].phone_no,
      lab_data_status: rows[0].lab_data_status,
      account_status: rows[0].account_status,
      registered_at: rows[0].registered_at,
      updated_at: rows[0].updated_at,
      patient_data: {
        gender: rows[0].gender,
        blood_type: rows[0].blood_type,
        age: rows[0].age,
        date_of_birth: rows[0].date_of_birth,
        weight: rows[0].weight,
        height: rows[0].height,
        bmi: rows[0].bmi,
      },
      lab_test: {
        lab_test_id: rows[0].lab_test_id,
        lab_test_date: rows[0].lab_test_date,
        status: rows[0].lab_test_status,
        test_name: rows[0].test_name,
        recommendation_id: rows[0].id,
        generated_recommendation: rows[0].generated_recommendation,
        recommendation_status: rows[0].recommendation_status,
        recommendation_updated_at: rows[0].recommendation_updated_at,
        results: [],
      },
    };

    const resultMap = new Set();

    for (const row of rows) {
      if (row.lab_item_id && !resultMap.has(row.lab_item_id)) {
        patient.lab_test.results.push({
          lab_item_name: row.lab_item_name,
          lab_item_status: row.lab_item_status,
          unit: row.unit,
          value: row.lab_item_value,
          normal_range: row.normal_range,
        });
        resultMap.add(row.lab_item_id);
      }
    }

    res.json(patient);
  } catch (err) {
    console.error("Error fetching specific lab test details:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/:hn_number", async (req, res) => {
  const hn_number = req.params.hn_number;
  const {
    name,
    citizen_id,
    phone_no,
    doctor_id,
    gender,
    blood_type,
    age,
    date_of_birth,
    weight,
    height,
    bmi,
  } = req.body;

  try {
    const connection = await db.getConnection();

    // Update patients table
    await connection.query(
      `
        UPDATE patients
        SET name = ?, citizen_id = ?, phone_no = ?, doctor_id = ?, updated_at = NOW()
        WHERE hn_number = ?
        `,
      [name, citizen_id, phone_no, doctor_id, hn_number]
    );

    // Check if patient_data exists
    const [existingData] = await connection.query(
      "SELECT id FROM patient_data WHERE hn_number = ?",
      [hn_number]
    );

    if (existingData.length > 0) {
      // Update patient_data table
      await connection.query(
        `
          UPDATE patient_data
          SET gender = ?, blood_type = ?, age = ?, date_of_birth = ?, weight = ?, height = ?, bmi = ?
          WHERE hn_number = ?
          `,
        [gender, blood_type, age, date_of_birth, weight, height, bmi, hn_number]
      );
    } else {
      // Insert into patient_data if it doesn't exist
      await connection.query(
        `
          INSERT INTO patient_data (hn_number, gender, blood_type, age, date_of_birth, weight, height, bmi)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        [hn_number, gender, blood_type, age, date_of_birth, weight, height, bmi]
      );
    }

    connection.release();

    res.json({ message: "Patient data updated successfully" });
  } catch (err) {
    console.error("Error updating patient:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
