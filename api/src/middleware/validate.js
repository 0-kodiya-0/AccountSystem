const { forbiddenError, serverError } = require("../../local_modules/MyExpressServer/src/response");
const { redis } = require("../config/db/cache");
const { verify } = require("../config/jwt");

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

/**
 * 
 * Checks if the sign in, sign up session or access token has the type == server
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
async function isServerAccountType(req, res, next) {
    try {
        if (req.tokenData.owner.type !== "server") {
            throw forbiddenError(`account type ${req.tokenData.owner.type} cannot access this path`);
        };
        next();
    } catch (error) {
        next(error);
    };
};

module.exports = {
    sessionValid, isServerAccountType
};