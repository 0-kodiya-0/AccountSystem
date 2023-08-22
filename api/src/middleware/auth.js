const { forbiddenError, unauthorizedError } = require("../../local_modules/MyExpressServer/src/response");

/**
 * 
 * Decodes the authorization header and check the username and password
 * 
 * @param {string} authorization - Authorization header
 * @returns {Array}
 */
function basicAuthCheck(authorization) {
    if (typeof authorization === "undefined") {
        throw unauthorizedError("Basic details missing");
    };
    const authDetails = authorization.split(" ");
    if (authDetails.length < 1) {
        throw forbiddenError("Basic details not enterd correctly");
    };
    const authDataArr = Buffer.from(authDetails[1], "base64").toString("utf-8").split(":");
    if (authDataArr.length < 1) {
        throw forbiddenError("Basic details decode error");
    };
    if (authDataArr[0] !== process.env.SERVER_USERNAME || authDataArr[1] !== process.env.SERVER_PASSWORD) { // remider to fix
        throw forbiddenError("Basic details not valid");
    };
    return authDataArr;
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
            throw forbiddenError("Under construction"); // fix
        };
        next();
    } catch (error) {
        next(error);
    };
};

/**
 * 
 * Validates the authentication when accessing path account/username in search
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function s_a_UsernameAuth(req, res, next) {
    try {
        if (req.searchParams.for === "server") { // Can access the server details with the server username and password
            basicAuthCheck(req.headers.authorization);
            req.aType = "server";
            req.fillter = req.searchParams.username ? { _id: req.searchParams.username } : {};
        } else {
            throw forbiddenError("Under construction"); // fix
        };
        next();
    } catch (error) {
        next(error);
    };
};

module.exports = {
    basicAuthCheck, createSessionPathAccess, s_a_UsernameAuth
};