const { createClient, ErrorReply } = require("redis");
const crypto = require("crypto");

// Creating the redis client and connecting to redis server
const redis = createClient({
    database: 0,
    url: process.env.REDIS_URL
})
redis.connect();

const retryCount = 10;

/**
 * Checks redis server connection. if not connected it will open a connection
 */
async function checkConnection() {
    if (redis.isOpen) {
        return;
    } else {
        return await redis.connect();
    };
};

/**
 * @async
 * 
 * @param {string|object} value - Data that need to be cache 
 * @param {number|undefined} exp - Expiration if required 
 * @param {object|undefined} options
 * 
 * @returns {Promise<string>}
 */
async function setCode(value, exp, options) {
    let code;
    for (let i = 0; i < retryCount; i++) {
        code = crypto.randomBytes(10).toString("hex");
        if (await redis.get(code) || await redis.json.get(code)) {
            continue;
        } else {
            if (typeof value === "object") {
                await redis.json.set(code, options.path ? options.path : "$", value);
                await redis.expire(code, exp);
                return code;
            };
            if (typeof value === "string") {
                await redis.set(code, value, exp);
                return code;
            };
            throw new TypeError("input value type not valid")
        };
    };
    throw new ErrorReply("Cache saving error. Please try again later");
};

/**
 * Checks if the key exists before saving the key. if key exists throws a error
 * 
 * @async
 * 
 * @param {string} key 
 * @param {string} value 
 * @param {object|undefined} options 
 */
async function uniqueSet(key, value, options) {
    if (await redis.exists(key) > 0) {
        throw new ErrorReply("Key exists");
    } else {
        return await redis.set(key, value, options);
    };
};

/**
 * Checks if the json key exists before saving the key. if json key exists throws a error
 * 
 * @async
 * 
 * @param {string} key 
 * @param {string} path
 * @param {object} object   
 * @param {object|undefined} options 
 */
async function uniqueJsonSet(key, path, object, options) {
    if (await redis.exists(key) > 0) {
        throw new ErrorReply("Key exists");
    } else {
        return await redis.json.set(key, path, object, options);
    };
};

/**
 * 
 * Creates a session with a random id in the redis database
 * 
 * @param {Object} object - Session object that need to saved
 * @param {Number} exp - Expiration time in seconds 
 * @returns {Promise<String>}
 */
async function setSessionObject(object, exp) {
    for (let i = 0; i < 5; i++) {
        try {
            const key = randomBytes(10).toString("base64url");
            await uniqueJsonSet(key, "$", object);
            await redis.expire(key, exp);
            return key;
        } catch (error) {
            continue;
        };
    };
    throw new ErrorReply("Server is out of resources. Please try again later.");
};

module.exports = {
    redis,
    checkConnection,
    setCode,
    uniqueSet,
    uniqueJsonSet,
    setSessionObject
}