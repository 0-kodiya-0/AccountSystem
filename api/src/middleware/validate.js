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
        req.tokenData = await verify(req.searchParams.session);
        if (await redis.exists(req.tokenData.owner.id) !== 1) {
            throw forbiddenError("Session id invalid or expired");
        };
        next();
    } catch (error) {
        next(serverError(error));
    };
};

/**
 * 
 * Checks session is issued for the sign in path 
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function isSessionSignIn(req, res, next) {
    if (req.tokenData.for === "signin") {
        next();
    } else {
        next(forbiddenError("Invalid session object"));
    };
};

/**
 * 
 * Checks session is issued for the sign up path 
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function isSessionSignUp(req, res, next) {
    if (req.tokenData.for === "signup") {
        next();
    } else {
        next(forbiddenError("Invalid session object"));
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
            throw forbiddenError(`Account type ${req.tokenData.owner.type} cannot access this path`);
        };
        next();
    } catch (error) {
        next(error);
    };
};

module.exports = {
    sessionValid, isServerAccountType, isSessionSignIn, isSessionSignUp
};