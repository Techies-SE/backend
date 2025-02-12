const express = require('express');
const bodyParser = require('body-parser');
const patientsRoutes = require('./routes/patients');
const labDataRoutes = require('./routes/lab_data');
const labTestResultRoutes = require('./routes/lab_test_result');
const recommendationsRotues = require('./routes/recommendations');
const departmentsRoutes = require('./routes/departments');
const doctorsRoutes = require('./routes/doctors');
const adminsRoutes = require('./routes/admins');
const patientsWDoctors = require('./routes/lab_data-patients-doctors');
const doctorsWDepartments = require('./routes/doctors-departments');
const uploadRoutes = require("./routes/upload-csv");
const corse = require('cors');
const db = require('./db'); // import the database connection

require('dotenv').config(); // Load environment variables from .env file

const app = express();
const PORT = process.env.PORT || 3000; // Use the port from .env or default to 3000

app.use(corse());
// Middleware
app.use(bodyParser.json());

// Routes
app.use('/patients', patientsRoutes);
app.use('/lab_data', labDataRoutes);
app.use('/lab_test_result', labTestResultRoutes);
app.use('/departments', departmentsRoutes);
app.use('/doctors', doctorsRoutes);
app.use('/recommendations', recommendationsRotues);
app.use('/admins', adminsRoutes);
app.use('/patients-with-doctors', patientsWDoctors);
app.use('/doctors-with-departments', doctorsWDepartments);
app.use("/upload", uploadRoutes);

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

