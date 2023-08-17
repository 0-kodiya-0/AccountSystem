const { notAccptedError } = require("../../local_modules/MyExpressServer/src/response");

/**
 * 
 * Valdates the password in the body of the request in sign in and sign up
 * 
 * @param {Object} req 
 * @param {Object} res 
 * @param {Function} next 
 */
function validatePassword(req, res, next) {
    try {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,20})/;
        const valid = regex.test(req.body.password);
        if (valid === false) {
            throw notAccptedError("invalid password enterd");
        };
        next();
    } catch (error) {
        next(error);
    };
};

module.exports = {
    validatePassword
};