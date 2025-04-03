const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const authenticateToken = require('../middlewear/auth');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET;

// user login
router.post("/", async (req, res)=>{

    const {phone_no, password} = req.body;
    
   // (?) place holder for parameter
   // [phone_no] parameter array which will go into the place holder
    db.query("SELECT * FROM patients WHERE phone_no = ?", [phone_no], async (err, results)=>{
        if (err) return res.status(500).json({ error: "Database error" });
        if (results.length === 0) return res.status(401).json({ error: "Invalid phone number or password" });
        // response which is results is in JavaScript Object {}
        // results[0] retrieves the first row from the database query
        const patient = results[0];
        
        // Compare password
        const isMatch = await bcrypt.compare(password, patient.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid phone number or password" });

       
        // Generate JWT token using .env secret
        // payload - the data you want to include in the token - in my code -  { id: patient.id, phone_no: patient.phone_no }
        // secretOrPrivateKey - A secret key used to sign the token (stored in .env for security).
        // options - additional information like expiry time

        const token = jwt.sign(
            { id: patient.id, phone_no: patient.phone_no },
            SECRET_KEY,
            { expiresIn: process.env.TOKEN_EXPIRY || "1h" }
        );

        const isFirstTimeLogin = patient.account_status === 0;

        res.json({ message: "Login successful", token, firstTimeLogin: isFirstTimeLogin, id: patient.id });
        console.log('Log In Status: ' + res.statusCode);
        //console.log(patient);
    })
});

router.post("/change-password", authenticateToken,async(req, res)=>{
    console.log("Request body:", req.body);
    const {userId, newPassword} = req.body;
    
    if(!userId || !newPassword) {
        return res.status(400).json({error: "User ID and password are required"});
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.query("UPDATE patients set password = ?, account_status = 1 WHERE id = ?", [hashedPassword, userId],(err, result)=>{
        if(err) return res.status(500).json({error: "Database Error"});
        res.status(200).json({success : true, message : "Password changed successfully"});
    })

})
module.exports = router;