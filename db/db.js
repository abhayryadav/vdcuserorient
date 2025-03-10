// const mongoose = require('mongoose');

// // Function to connect to the database
// async function connectToDb() {
//     try {
//         // Attempt to connect to MongoDB
//         await mongoose.connect(process.env.CONNECTION_STRING, {
//             useNewUrlParser: true, // New URL parser for connection
//             useUnifiedTopology: true, // Enable the new server discovery and monitoring engine
//         });

//         // Log success on connection
//         console.log('Connected to DB');
//         testConnection();
//         // Log the connection state
//         console.log('Connection state:', mongoose.connection.readyState);  // should log 1 if connected

      
//     } catch (err) {
//         // Log connection errors
//         console.error('Error connecting to DB:', err);
//     }
// }

// // Function to test connection after successful MongoDB connection
// async function testConnection() {
//     // Wait until the connection is fully established
//     if (mongoose.connection.readyState === 1) {
//         try {
//             // Simple query to test if the connection works
//             const result = await mongoose.connection.db.collection('users').findOne({});
//             if (result) {
//                 console.log('Connection is working!');
//             } else {
//                 console.log('No data found, connection may be unstable.');
//             }
//         } catch (err) {
//             console.error('Error querying the database:', err);
//         }
//     } else {
//         console.log('MongoDB connection is not yet established.');
//     }
// }

// // Export the function to be used elsewhere
// module.exports = {
//     connectToDb,
//     testConnection
// };











require('dotenv').config(); 
const mongoose = require('mongoose');

// Function to connect to the database
function connectToDb() {
    return new Promise(async (resolve, reject) => {
        try {
            // Attempt to connect to MongoDB
            await mongoose.connect(process.env.CONNECTION_STRING);

            // Log success on connection
            console.log('Connected to DB');
            console.log('Connection state:', mongoose.connection.readyState);  // 1 = connected

            // Resolve the promise after a successful connection
            resolve();
        } catch (err) {
            // Reject the promise if connection fails
            console.error('Error connecting to DB:', err);
            reject(err);
        }
    });
}

// Function to test connection after successful MongoDB connection
async function testConnection() {
    // Wait until the connection is fully established
    if (mongoose.connection.readyState === 1) {
        try {
            // Simple query to test if the connection works
            const result = await mongoose.connection.db.collection('users').findOne({});
            if (result) {
                console.log('Connection is working!');
            } else {
                console.log('No data found, connection may be unstable.');
            }
        } catch (err) {
            console.error('Error querying the database:', err);
        }
    } else {
        console.log('MongoDB connection is not yet established.');
    }
}

// Export the function to be used elsewhere
module.exports = {
    connectToDb,
    testConnection
};
