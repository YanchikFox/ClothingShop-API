const jwt = require('jsonwebtoken');

/**
 * JWT Authentication Middleware
 * 
 * Validates the JWT token from the x-auth-token header and extracts user information.
 * If the token is valid, adds the user object to req.user and calls next().
 * If the token is missing or invalid, returns a 401 Unauthorized response.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next middleware function
 */
module.exports = function(req, res, next) {
    const token = req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ message: 'No token provided, authorization denied' });
    }

    try {
        // Verify and decode the JWT token
        const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
        const decoded = jwt.verify(token, secret);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is invalid' });
    }
};