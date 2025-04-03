const express = require("express");
const router = express.Router();
const db = require("../db");

// Get all pending appointments for admin approval
router.get("/pending", async (req, res) => {
    try {
      const [appointments] = await db.promise().query(
        `SELECT 
            appointments.id AS appointment_id,
            appointments.appointment_date,
            appointments.appointment_time,
            appointments.status, 
            patients.hn_number AS hn_number,
            patients.name AS patient_name,
            patients.phone_no AS patient_phone,
            doctors.id AS doctor_id,
            doctors.name AS doctor_name,
            doctors.specialization
          FROM appointments
          JOIN patients ON appointments.hn_number = patients.hn_number
          JOIN doctors ON appointments.doctor_id = doctors.id
          WHERE appointments.status = 'pending'`
      );
  
      res.json({ pending_appointments: appointments });
    } catch (error) {
      console.error("Error fetching pending appointments:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.get("/pending/count", async (req, res) => {
    try {
      const [result] = await db.promise().query(
        `SELECT COUNT(*) AS total_pending FROM appointments WHERE status = 'pending'`
      );
  
      res.json({ total_pending_appointments: result[0].total_pending });
    } catch (error) {
      console.error("Error fetching pending appointments count:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.get("/confirm/count", async (req, res) => {
    try {
      const [result] = await db.promise().query(
        `SELECT COUNT(*) AS total_pending FROM appointments WHERE status = 'scheduled'`
      );
  
      res.json({ total_confirm_appointments: result[0].total_pending });
    } catch (error) {
      console.error("Error fetching confirm appointments count:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.get("/reschedule/count", async (req, res) => {
    try {
      const [result] = await db.promise().query(
        `SELECT COUNT(*) AS total_pending FROM appointments where status = 'rescheduled'`
      );
  
      res.json({ total_reschedule_appointments: result[0].total_pending });
    } catch (error) {
      console.error("Error fetching reschedule appointments count:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.get("/cancel/count", async (req, res) => {
    try {
      const [result] = await db.promise().query(
        `SELECT COUNT(*) AS total_pending FROM appointments where status = 'canceled'`
      );
  
      res.json({ total_canceled_appointments: result[0].total_pending });
    } catch (error) {
      console.error("Error fetching canceled appointments count:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.get("/complete/count", async (req, res) => {
    try {
      const [result] = await db.promise().query(
        `SELECT COUNT(*) AS total_pending FROM appointments where status = 'completed'`
      );
  
      res.json({ total_completed_appointments: result[0].total_pending });
    } catch (error) {
      console.error("Error fetching completed appointments count:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.get("/count", async (req, res) => {
    try {
      const [result] = await db.promise().query(
        `SELECT COUNT(*) AS total_pending FROM appointments`
      );
  
      res.json({ total_appointments: result[0].total_pending });
    } catch (error) {
      console.error("Error fetching appointments count:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  

  router.patch("/approve/:appointment_id", async (req, res) => {
    try {
      const { appointment_id } = req.params;
  
      // Update appointment status to 'approved'
      const [result] = await db.promise().query(
        `UPDATE appointments 
         SET status = 'scheduled' 
         WHERE id = ? AND status = 'pending'`,
        [appointment_id]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Appointment not found or already approved." });
      }
  
      res.json({ message: "Appointment approved successfully!" });
    } catch (error) {
      console.error("Error approving appointment:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.patch("/cancel/:appointment_id", async (req, res) => {
    try {
      const { appointment_id } = req.params;
  
      // Update appointment status to 'approved'
      const [result] = await db.promise().query(
        `UPDATE appointments 
         SET status = 'canceled' 
         WHERE id = ? AND status = 'pending'`,
        [appointment_id]
      );
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Appointment not found or already approved." });
      }
  
      res.json({ message: "Appointment canceled successfully!" });
    } catch (error) {
      console.error("Error cancelling appointment:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // reschedule
  // GET Appointment Details & Available Slots
router.get("/:appointment_id/reschedule", async (req, res) => {
    try {
      const { appointment_id } = req.params;
  
      // Fetch appointment details
      const [appointmentResult] = await db.promise().query(
        `SELECT 
            a.id AS appointment_id, 
            a.appointment_date, 
            a.appointment_time, 
            d.id AS doctor_id, 
            d.name AS doctor_name, 
            d.specialization, 
            ds.day_of_week, 
            ds.start_time, 
            ds.end_time, 
            p.hn_number, 
            p.name AS patient_name, 
            p.phone_no 
        FROM appointments a
        JOIN patients p ON a.hn_number = p.hn_number
        JOIN doctors d ON a.doctor_id = d.id
        JOIN doctor_schedules ds ON d.id = ds.doctor_id
        WHERE a.id = ?`,
        [appointment_id]
      );
  
      if (appointmentResult.length === 0) {
        return res.status(404).json({ message: "Appointment not found" });
      }
  
      const appointment = appointmentResult[0];
  
      // Get booked slots for that doctor on the same date
      const [bookedSlotsResult] = await db.promise().query(
        `SELECT appointment_time FROM appointments 
         WHERE doctor_id = ? 
         AND appointment_date = ? 
         AND id != ?`,
        [appointment.doctor_id, appointment.appointment_date, appointment_id]
      );
  
      const bookedTimes = bookedSlotsResult.map((slot) => slot.appointment_time.slice(0, 5));
  
      // Generate available time slots
      const availableSlots = generateTimeSlots(appointment.start_time, appointment.end_time, 30)
        .filter(slot => !bookedTimes.includes(slot));
  
      res.json({
        appointment,
        available_slots: availableSlots
      });
    } catch (error) {
      console.error("Error fetching reschedule details:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // PATCH Reschedule Appointment
router.patch("/:appointment_id/reschedule", async (req, res) => {
    try {
      const { appointment_id } = req.params;
      const { new_date, new_time } = req.body;
  
      // Update appointment date, time & status
      const [updateResult] = await db.promise().query(
        `UPDATE appointments 
         SET appointment_date = ?, appointment_time = ?, status = 'rescheduled' 
         WHERE id = ?`,
        [new_date, new_time, appointment_id]
      );
  
      if (updateResult.affectedRows === 0) {
        return res.status(404).json({ message: "Appointment not found or could not be updated" });
      }
  
      res.json({ message: "Appointment rescheduled successfully!" });
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  router.get("/available-slots/:doctor_id/:date", async (req, res) => {
    try {
      const { doctor_id, date } = req.params;
  
      // Get the day of the week from the given date
      const dayOfWeek = new Date(date).toLocaleDateString("en-US", { weekday: "long" });
  
      // Fetch the doctor's schedule for that day
      const [schedule] = await db
        .promise()
        .query(
          `SELECT start_time, end_time FROM doctor_schedules 
           WHERE doctor_id = ? AND day_of_week = ?`,
          [doctor_id, dayOfWeek]
        );
  
      if (schedule.length === 0) {
        return res.status(404).json({ message: "Doctor is not available on this day." });
      }
  
      const { start_time, end_time } = schedule[0];
  
      // Generate available time slots (30-minute intervals)
      const slots = generateTimeSlots(start_time, end_time, 30);
  
      // Fetch booked appointments for that date
      const [bookedSlots] = await db
        .promise()
        .query(
          `SELECT appointment_time FROM appointments 
           WHERE doctor_id = ? AND appointment_date = ? AND status IN ('pending', 'scheduled', 'rescheduled')`,
          [doctor_id, date]
        );
  
      const bookedTimes = bookedSlots.map((slot) => slot.appointment_time.slice(0, 5));
  
      // Filter out booked slots
      const availableSlots = slots.filter((slot) => !bookedTimes.includes(slot));
  
      res.json({ date, available_slots: availableSlots });
    } catch (error) {
      console.error("Error fetching available slots:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });
  
  // Function to Generate Time Slots
  function generateTimeSlots(start, end, interval) {
    const slots = [];
    let currentTime = new Date(`1970-01-01T${start}`);
    const endTime = new Date(`1970-01-01T${end}`);
  
    while (currentTime < endTime) {
      slots.push(currentTime.toTimeString().slice(0, 5)); // Format HH:mm
      currentTime.setMinutes(currentTime.getMinutes() + interval);
    }
  
    return slots;
  }

  module.exports = router;
