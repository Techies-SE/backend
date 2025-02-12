const express = require('express');
const router = express.Router();
const db = require('../db');

//create a department
router.post('/', (req,res)=>{
    const {name} = req.body;
    const query = 'INSERT INTO departments (name) VALUES (?)';
    db.query(query, [name], (err,results)=>{
        if(err){
            return res.status(500).json({error: err.message})
        }
        res.status(201).json({ id: results.insertId });
    });
});

//get all departments
router.get('/', (req, res)=>{
    db.query('SELECT * FROM departments', (err, results)=>{
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

module.exports = router;