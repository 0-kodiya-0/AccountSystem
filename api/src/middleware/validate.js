const { forbiddenError, notAccptedError } = require("../../local_modules/MyExpressServer/src/response");
const { redis, cacheKeyIdentifyNames } = require("../config/db/cache");
const { verify } = require("../config/jwt");
const { compare } = require('bcrypt');
const { MongooseError } = require("mongoose");

const serverColl = require("../schema/server");
const commonDetailsColl = require("../schema/commonDetails");
const securityColl = require("../schema/security");

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
async function signinUpSessionValid(req, res, next) {
    try {
        try {
            req.tokenData = await verify(req.searchParams.session);
        } catch (error) {
            throw forbiddenError(error);
        };
        if (await redis.exists(cacheKeyIdentifyNames.signInUpsession + req.tokenData.tid) !== 1) {
            throw forbiddenError("Session id invalid or expired");
        };
        next();
    } catch (error) {
        next(error);
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
async function isServerAType(req, res, next) {
    try {
        if (req.tokenData.aType !== "server") {
            throw forbiddenError(`Account type ${req.tokenData.aType} cannot access this path`);
        };
        next();
    } catch (error) {
        next(error);
    };
};

/**
 * 
 * Checks if the sign in, sign up session or access token has the type != server
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
async function isNotServerAType(req, res, next) {
    try {
        if (req.tokenData.aType === "server") {
            throw forbiddenError("Account type server cannot access this path");
        };
        next();
    } catch (error) {
        next(error);
    };
};

/**
* Validate the input value for the given schema path in collection which the model is linked to (model equal to aType) 
* 
* @async
* 
* @param {string} aType - The type of the account
* @param {string} path - Schema path
* @param {string} value - Value which need to be validated
* 
* @callback cb 
*/
function schemaPathValidate(aType, path, value) {
    return new Promise((resolve, reject) => {
        const cb = (err) => {
            if (err) {
                reject(notAccptedError(err)); // fix json stringnify
            } else {
                resolve();
            };
        };
        switch (aType) {
            case "server":
                serverColl.ServerSchema.path(path).doValidate(value, cb);
                break;
            case "notserver":
                commonDetailsColl.CommonDetailsSchema.path(path).doValidate(value, cb);
                break;
            default:
                throw forbiddenError("Account type not valid");
        };
    });
};

/**
 * Checks if the given username exists with the given collection which the model is linked to (model equal to aType) 
 * 
 * @async
 * 
 * @param {string} aType - The type of account
 * @param {string} userName - Account username
 * 
 * @throws - userName invalid (406)
 */
async function userNameEx(aType, userName) {
    const fillter = { userName: userName, display: true };
    let account;
    try {
        switch (aType) {
            case "server":
                account = await serverColl.ServerModel.findOne({ _id: userName, display: true }, { _id: 1 });
                break;
            default:
                throw forbiddenError("Account type not valid");
        };
    } catch (error) {
        if (error instanceof MongooseError) {
            throw notAccptedError("Username invalid");
        } else {
            throw error;
        };
    };
    if (typeof account !== "object") {
        throw notAccptedError("Username invalid");
    };
    return account._id;
};

/**
 * Checks if the given password exists with the given collection which the model is linked to (model equal to aType) 
 * 
 * @async
 * 
 * @param {string} accountId - Account Id
 * @param {string} password 
 * 
 * @throws - password invalid (406)
 */
async function passwordEx(accountId, password) {
    const fData = await securityColl.SecurityModel.findOne({ accountId: accountId }, { password: 1 });
    if (await compare(password, fData.password) === false) {
        throw notAccptedError("Password invalid");
    };
};

module.exports = {
    signinUpSessionValid, isServerAType, isNotServerAType, isSessionSignIn, isSessionSignUp, schemaPathValidate, userNameEx, passwordEx
};