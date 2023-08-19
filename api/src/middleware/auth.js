const { forbiddenError } = require("../../local_modules/MyExpressServer/src/response");

/**
 * 
 * Decodes the authorization header and check the username and password
 * 
 * @param {string} authorization - Authorization header
 * @returns {Array}
 */
function basicAuthCheck(authorization) {
    if (authorization) {
        const authDetails = authorization.split(" ");
        const authDataArr = Buffer.from(authDetails[1], "base64").toString("utf-8").split(":");
        if (authDataArr[0] !== process.env.SERVER_USERNAME || authDataArr[1] !== process.env.SERVER_PASSWORD) { // remider to fix
            throw forbiddenError("Basic details not valid");
        };
        return authDataArr;
    } else {
        throw forbiddenError("Basic details missing");
    };
};

/**
 * 
 * Validates the authentication when accessing path creatsession in sign in and sign up
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function createSessionPathAccess(req, res, next) {
    try {
        if (req.searchParams.for === "server") {
            basicAuthCheck(req.headers.authorization);
        } else {
            if (req.admin === true) {
                throw forbiddenError("Cannot access admin paths");
            };
            throw forbiddenError("Under construction"); // fix
        };
        next();
    } catch (error) {
        next(error);
    };
};

module.exports = {
    basicAuthCheck, createSessionPathAccess
};