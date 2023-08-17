const { forbiddenError, serverError } = require("../../local_modules/MyExpressServer/src/response");
const { redis } = require("../config/db/cache");
const { verify } = require("../config/jwt");

/**
 * 
 * Decodes the authorization header and check the username and password
 * 
 * @param {string} authorization - Authorization header
 * @returns {Array}
 */
function basicAuthCheck(authorization) {
    const authDetails = authorization.split(" ");
    const authDataArr = Buffer.from(authDetails[1], "base64").toString("utf-8").split(":");
    if (authDataArr[0] !== process.env.SERVER_USERNAME || authDataArr[1] !== process.env.SERVER_PASSWORD) { // remider to fix
        throw forbiddenError("basic details not valid");
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
        if (req.admin === true && req.searchParams.for === "server") {
            basicAuthCheck(req.headers);
        } else {
            if (req.admin === true) {
                throw forbiddenError("cannot access admin paths");
            };
            throw forbiddenError("under construction"); // fix
        };
        next();
    } catch (error) {
        next(error);
    };
};

/**
 * 
 * Checks if the session object is valid for data add paths in the sign in and sign up
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next
 * 
 * @returns {Promise} 
 */
async function sessionValid(req, res, next) {
    try {
        const token = await verify(req.searchParams.session);
        if (await redis.exists(token.owner.id) !== 1) {
            throw forbiddenError("session id invalid or expired");
        };
        req.tokenData = JSON.parse(token);
        next();
    } catch (error) {
        next(serverError(error));
    };
};

module.exports = {
    basicAuthCheck, createSessionPathAccess, sessionValid
};