const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/doctor/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Fetch doctor details with schedules
      const [results] = await db
        .promise()
        .query(
          `SELECT 
            doctors.id, doctors.name, doctors.phone_no, doctors.email, doctors.specialization, 
            doctor_schedules.id AS schedule_id, doctor_schedules.day_of_week, 
            doctor_schedules.start_time, doctor_schedules.end_time
          FROM doctors
          LEFT JOIN doctor_schedules ON doctors.id = doctor_schedules.doctor_id
          WHERE doctors.id = ?`,
          [id]
        );
  
      if (results.length === 0) {
        return res.status(404).json({ message: "Doctor not found" });
      }
  
      // Extract doctor info (assuming all rows belong to the same doctor)
      const { id: doctorId, name, phone_no, email, specialization } = results[0];
  
      // Format schedules
      const schedules = results
        .filter((row) => row.schedule_id) // Exclude null schedules
        .map((row) => ({
          schedule_id: row.schedule_id,
          day_of_week: row.day_of_week,
          start_time: row.start_time,
          end_time: row.end_time,
        }));
  
      // Construct response
      const response = {
        doctor: {
          id: doctorId,
          name,
          phone_no,
          email,
          specialization,
          schedules,
        },
      };
  
      res.json(response);
    } catch (error) {
      console.error("Error fetching doctor details:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

router.delete("/doctor/:doctor_id/", async (req, res) => {
    try {
      const { doctor_id } = req.params;
      const { day_of_week, start_time } = req.body; // Expecting JSON body
  
      if (!day_of_week || !start_time) {
        return res.status(400).json({ message: "Missing required fields" });
      }
  
      // Check if the schedule exists
      const [schedule] = await db
        .promise()
        .query(
          `SELECT * FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ? AND start_time = ?`,
          [doctor_id, day_of_week, start_time]
        );
  
      if (schedule.length === 0) {
        return res.status(404).json({ message: "Schedule not found" });
      }
  
      // Delete the schedule
      await db
        .promise()
        .query(
          `DELETE FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ? AND start_time = ?`,
          [doctor_id, day_of_week, start_time]
        );
  
      res.json({ message: "Schedule deleted successfully" });
    } catch (error) {
      console.error("Error deleting schedule:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.post("/doctor/:doctor_id", async (req, res) => {
    try {
      const { doctor_id } = req.params;
      const { day_of_week, start_time, end_time } = req.body;
  
      if (!day_of_week || !start_time || !end_time) {
        return res.status(400).json({ message: "Missing required fields" });
      }
  
      // Check if the doctor exists
      const [doctor] = await db
        .promise()
        .query(`SELECT id FROM doctors WHERE id = ?`, [doctor_id]);
  
      if (doctor.length === 0) {
        return res.status(404).json({ message: "Doctor not found" });
      }
  
      // Insert the schedule into the database
      await db
        .promise()
        .query(
          `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)`,
          [doctor_id, day_of_week, start_time, end_time]
        );
  
      res.status(201).json({ message: "Schedule added successfully" });
    } catch (error) {
      console.error("Error adding schedule:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Edit an existing schedule for a doctor
router.put("/doctor/id=:doctor_id/schedule/id=:schedule_id", async (req, res) => {
    try {
      const { doctor_id, schedule_id } = req.params;
      const { day_of_week, start_time, end_time } = req.body;
  
      if (!day_of_week || !start_time || !end_time) {
        return res.status(400).json({ message: "Missing required fields" });
      }
  
      // Check if the doctor exists
      const [doctor] = await db
        .promise()
        .query(`SELECT id FROM doctors WHERE id = ?`, [doctor_id]);
  
      if (doctor.length === 0) {
        return res.status(404).json({ message: "Doctor not found" });
      }
  
      // Check if the schedule exists for the doctor
      const [schedule] = await db
        .promise()
        .query(
          `SELECT id FROM doctor_schedules WHERE id = ? AND doctor_id = ?`,
          [schedule_id, doctor_id]
        );
  
      if (schedule.length === 0) {
        return res.status(404).json({ message: "Schedule not found" });
      }
  
      // Update the schedule in the database
      await db
        .promise()
        .query(
          `UPDATE doctor_schedules SET day_of_week = ?, start_time = ?, end_time = ? WHERE id = ? AND doctor_id = ?`,
          [day_of_week, start_time, end_time, schedule_id, doctor_id]
        );
  
      res.status(200).json({ message: "Schedule updated successfully" });
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Update a specific schedule for a doctor
router.patch("/:schedule_id", async (req, res) => {
    try {
      const { schedule_id } = req.params;
      const { day_of_week, start_time, end_time } = req.body;
  
      // Check if at least one field is provided for update
      if (!day_of_week && !start_time && !end_time) {
        return res.status(400).json({ message: "No fields provided for update." });
      }
  
      // Build the update query dynamically
      let updateFields = [];
      let values = [];
  
      if (day_of_week) {
        updateFields.push("day_of_week = ?");
        values.push(day_of_week);
      }
      if (start_time) {
        updateFields.push("start_time = ?");
        values.push(start_time);
      }
      if (end_time) {
        updateFields.push("end_time = ?");
        values.push(end_time);
      }
  
      values.push(schedule_id);
  
      const updateQuery = `UPDATE doctor_schedules SET ${updateFields.join(", ")} WHERE id = ?`;
  
      // Execute the update query
      const [result] = await db.promise().query(updateQuery, values);
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Schedule not found or no changes made." });
      }
  
      res.json({ message: "Schedule updated successfully." });
    } catch (error) {
      console.error("Error updating schedule:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  
  

module.exports = router;
