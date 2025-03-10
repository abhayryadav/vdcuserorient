const jwt = require('jsonwebtoken');
const userModel = require('../models/user.models'); // Adjust the path based on your project structure

module.exports.verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Authorization token is required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY); // Replace with your secret key

        // Check if the user exists in the database
        const user = await userModel.findOne({ email: decoded.email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        req.user = user; // Attach the user object to the request
        console.log("User verified:", user.email);

        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
