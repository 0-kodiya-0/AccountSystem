const { notFoundError } = require("../../local_modules/MyExpressServer/src/response");

/**
 * 
 * Checks if account type exists in the request url ex :- url/?for=accountType
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function accountTypeEx(req, res, next) {
    try {
        if (typeof req.searchParams.for !== "string") {
            throw notFoundError("Account type not found");
        };
        next()  
    } catch (error) {
        next(error);
    };
};

/**
 * 
 * Checks if the session object exists for the data adding path in sign in and sign up
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function sessionObjectEx(req, res, next) {
    try {
        if (typeof req.searchParams.session !== "string") {
            throw notFoundError("Session object not found")  
        };
        next();      
    } catch (error) {
        next(error);
    };
};

/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function bodyPasswordEx(req, res, next) {
    try {
        if (typeof req.body.password !== "string") {
            throw notFoundError("Password not found");
        };
        next();
    } catch (error) {
        next(error);
    };  
};

/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function bodyCommentEx(req, res, next) {
    try {
        if (typeof req.body.comment !== "string") {
            throw notFoundError("Comment not found");
        };
        next();
    } catch (error) {
        next(error);
    };  
};

/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function bodyUsernameEx(req, res, next) {
    try {
        if (typeof req.body.username !== "string") {
            throw notFoundError("Username not found");
        };
        next();
    } catch (error) {
        next(error);
    };  
};

/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function bodyEmailEx(req, res, next) {
    try {
        if (typeof req.body.email !== "string") {
            throw notFoundError("Email not found");
        };
        next();
    } catch (error) {
        next(error);
    };  
};

/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function bodyNameEx(req, res, next) {
    try {
        if (typeof req.body.firstname !== "string") {
            throw notFoundError("Firstname not found");
        };
        if (typeof req.body.lastname !== "string") {
            throw notFoundError("Lastname not found");
        };
        next();
    } catch (error) {
        next(error);
    };  
};

/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function bodyBasicEx(req, res, next) {
    try {
        if (typeof req.body.birth !== "string") {
            throw notFoundError("Birth not found");
        };
        if (typeof req.body.gender !== "string") {
            throw notFoundError("Gender not found");
        };
        next();
    } catch (error) {
        next(error);
    };  
};

/**
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function sParaUsernameEx(req, res, next) {
    try {
        if (typeof req.searchParams.username !== "string") {
            throw notFoundError("Username not found");
        };
        next();
    } catch (error) {
        next(error);
    };  
};

module.exports = {
    accountTypeEx, sessionObjectEx, bodyPasswordEx, bodyCommentEx, bodyUsernameEx, sParaUsernameEx,
    bodyEmailEx, bodyNameEx, bodyBasicEx 
}