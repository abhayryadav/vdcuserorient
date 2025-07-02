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



const corsOptions = {
        origin: (origin, callback) => {
          const allowedOrigins = [
            'https://vdcendo.com',
            'https://vdcinternational.vercel.app',
            'https://vdcendo-api-testing-front.vercel.app',
            'http://localhost:3000', // Add local development URL if needed
          ];
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
      };
      
      app.use(cors(corsOptions));
app.use(express.json())
app.use(express.urlencoded({extended:true}))




app.use('/user',userRoutes);




module.exports = app;