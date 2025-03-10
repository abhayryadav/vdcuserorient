const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/user.routes');
const app = express();
const {connectToDb,testConnection} = require('./db/db');


// connectToDb()
// testConnection();



connectToDb()
    .then(() => {
        // Only call testConnection after the database is connected
        testConnection();
    })
    .catch((err) => {
        console.error('DB connection failed:', err);
    });



app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended:true}))




app.use('/user',userRoutes);




module.exports = app;