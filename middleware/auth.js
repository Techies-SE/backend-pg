// middleware to protect route 
const jwt = require("jsonwebtoken");
require('dotenv').config(); //load environment variables
const SECRET_KEY = process.env.JWT_SECRET;


const authenticateToken = (req, res, next) => {
    const token = req.header("Authorization")?.split(" ")[1]; // Extract Bearer token
    if (!token) return res.status(401).json({ error: "Access denied" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        console.log('jwt token user:' + user.id);
        next();
    });
};
module.exports = authenticateToken;