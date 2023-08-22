const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { Cert } = require("./cert");

const cert = new Cert(process.env.CERT_PATH, process.env.CERT_FILE_NAME);
cert.import.private();
cert.import.cert();

const privateKey = cert.export.private();
const certKey = cert.export.cert();

/**
 * Create a jwt token for the given input
 * 
 * @async
 * 
 * @param {object|string} message - jwt body that need to passed
 * @param {string} time - Expiring time for the jwt
 * @param {string|undefined} id - If id supplied this will be the token id (jti)
 * @returns {Promise<object>}
 * 
 */
function sign(message, time, id) {
    return new Promise((resolve, reject) => {
        const ranId = id || randomBytes(20).toString("base64url");
        jwt.sign(message, privateKey, { algorithm: "RS512", expiresIn: time, jwtid: ranId, issuer: process.env.DOMAIN }, (error, data) => {
            if (error) {
                reject(new TypeError(error));
            } else {
                resolve({ tokenId: ranId, token: data });
            };
        });
    });
};

/**
 * Extract jwt token details
 * 
 * @param {string} token - Signed jwt token 
 * @returns {object}
 */
function decode(token) {
    return jwt.decode(token, { complete: true });
};

/**
 * Verifies the token if it is sign by the defined private key 
 * 
 * @async
 * 
 * @param {string} token - Signed jwt token
 * @returns {Promise<string|object>}
 * 
 */
function verify(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, certKey, (error, data) => {
            if (error instanceof jwt.TokenExpiredError) {
                reject(new TypeError("Token expired"));
            } else if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError) {
                reject(new TypeError("Token decode error"));
            } else {
                resolve(data);
            };
        });
    });
};

module.exports = {
    sign, verify, decode
}