const express = require("express");
const router = express.Router();
const db = require("../db");

// // currently using
// // Get Available Time Slots for a Doctor on a Specific Date for patients
// router.get("/id=:doctor_id/date=:date", async (req, res) => {
//   try {
//     const { doctor_id, date } = req.params;

//     // Get the day of the week from the date
//     const dayOfWeek = new Date(date).toLocaleDateString("en-US", {
//       weekday: "long",
//     });

//     // Fetch the doctor's working hours
//     const [schedule] = await db
//       .promise()
//       .query(
//         "SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ?",
//         [doctor_id, dayOfWeek]
//       );

//     if (schedule.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "No available schedule for this day." });
//     }

//     const { start_time, end_time } = schedule[0];

//     // Generate 30-minute time slots
//     const slots = generateTimeSlots(start_time, end_time, 30);

//     // Fetch already booked slots from the `appointments` table
//     const [bookedSlots] = await db
//       .promise()
//       .query(
//         "SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ?",
//         [doctor_id, date]
//       );

//     const bookedTimes = bookedSlots.map((slot) =>
//       slot.appointment_time.slice(0, 5)
//     ); // Convert to "HH:mm"

//     // Filter out booked time slots
//     const availableSlots = slots.filter((slot) => !bookedTimes.includes(slot));

//     res.json({ date, available_slots: availableSlots });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // Function to Generate Time Slots
// function generateTimeSlots(start, end, interval) {
//   const slots = [];
//   let currentTime = new Date(`1970-01-01T${start}`);
//   const endTime = new Date(`1970-01-01T${end}`);

//   while (currentTime < endTime) {
//     slots.push(currentTime.toTimeString().slice(0, 5)); // Format HH:mm
//     currentTime.setMinutes(currentTime.getMinutes() + interval);
//   }

//   return slots;
// }

// router.get("/id=:doctor_id/date=:date", async (req, res) => {
//   try {
//     const { doctor_id, date } = req.params;

//     // Get the day of the week from the date
//     const dayOfWeek = new Date(date).toLocaleDateString("en-US", {
//       weekday: "long",
//     });

//     // Fetch the doctor's working hours
//     const [schedule] = await db
//       .promise()
//       .query(
//         "SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ?",
//         [doctor_id, dayOfWeek]
//       );

//     if (schedule.length === 0) {
//       return res.status(404).json({ message: "No available schedule for this day." });
//     }

//     const { start_time, end_time } = schedule[0];

//     // Generate 30-minute time slots using the provided date
//     const slots = generateTimeSlots(date, start_time, end_time, 30);

//     // Fetch already booked slots from the `appointments` table
//     const [bookedSlots] = await db
//       .promise()
//       .query(
//         "SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ?",
//         [doctor_id, date]
//       );

//     const bookedTimes = bookedSlots.map((slot) =>
//       slot.appointment_time.slice(0, 5)
//     ); // Convert to "HH:mm"

//     // Filter out booked time slots
//     const availableSlots = slots.filter((slot) => !bookedTimes.includes(slot));

//     res.json({ date, available_slots: availableSlots });
//   } catch (error) {
//     console.error("Error:", error);
//     res.status(500).json({ message: "Internal Server Error" });
//   }
// });

// // Function to Generate Time Slots with Correct Date
// function generateTimeSlots(date, start, end, interval) {
//   const slots = [];
//   const startDateTime = new Date(`${date}T${start}`); // Use provided date
//   const endDateTime = new Date(`${date}T${end}`);

//   while (startDateTime < endDateTime) {
//     slots.push(startDateTime.toTimeString().slice(0, 5)); // Format HH:mm
//     startDateTime.setMinutes(startDateTime.getMinutes() + interval);
//   }

//   return slots;
// }

router.get("/id=:doctor_id/date=:date", async (req, res) => {
  try {
    const { doctor_id, date } = req.params;

    // Ensure correct date parsing in UTC to avoid shifting issues
    const requestedDate = new Date(`${date}T00:00:00Z`);
    
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    // Get the day of the week from the requested date
    const dayOfWeek = requestedDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

    // Fetch the doctor's working hours
    const [schedule] = await db
      .promise()
      .query(
        "SELECT start_time, end_time FROM doctor_schedules WHERE doctor_id = ? AND day_of_week = ?",
        [doctor_id, dayOfWeek]
      );

    if (schedule.length === 0) {
      return res.status(404).json({ message: "No available schedule for this day." });
    }

    const { start_time, end_time } = schedule[0];

    // Generate 30-minute time slots using the correct date
    const slots = generateTimeSlots(date, start_time, end_time, 30);

    // Fetch already booked slots from the appointments table
    const [bookedSlots] = await db
      .promise()
      .query(
        "SELECT appointment_time FROM appointments WHERE doctor_id = ? AND appointment_date = ?",
        [doctor_id, date]
      );

    const bookedTimes = bookedSlots.map((slot) =>
      slot.appointment_time.slice(0, 5)
    ); // Convert to "HH:mm"

    // Filter out booked time slots
    const availableSlots = slots.filter((slot) => !bookedTimes.includes(slot));

    res.json({ date, available_slots: availableSlots });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Function to Generate Time Slots with Correct Date Handling
function generateTimeSlots(date, start, end, interval) {
  const slots = [];
  const startDateTime = new Date(`${date}T${start}Z`); // Ensure UTC
  const endDateTime = new Date(`${date}T${end}Z`);

  while (startDateTime < endDateTime) {
    slots.push(startDateTime.toISOString().slice(11, 16)); // Format HH:mm (UTC-safe)
    startDateTime.setMinutes(startDateTime.getMinutes() + interval);
  }

  return slots;
}

module.exports = router;
