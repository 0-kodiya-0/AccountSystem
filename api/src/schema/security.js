const { Schema, Types } = require("mongoose");
const { hash, compare } = require("bcrypt");
const schemaNames = require("./names");
const { ServerModel } = require("./server");
const { getErrorMinimized } = require("./error");

const passwordValidateRegex = {
    simpleLetters: /^(?=.*[a-z])/,
    capitalLetters: /^(?=.*[A-Z])/,
    digits: /^(?=.*[0-9])/,
    specialCharacters: /^(?=.*[!@#\$%\^&\*])/,
    length: /^(?=.{8,30})/,
    containsSpaces: /^((?![/ /]).)*$/,
    all: /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,30})((?![/ /]).)*$/
};

const SecuritySchema = new Schema({
    accountId: {
        type: Types.ObjectId,
        cast: false,
        index: true,
        unique: true,
        validate: async function (data) {
            let exists;
            switch (this.type) {
                case "server":
                    exists = await ServerModel.exists({ _id: data });
                    break;
                default:
                    throw "Invalid account type";
            };
            if (exists === null) {
                throw "Invalid server account id";
            };
        },
        required: true
    },
    type: {
        type: String,
        cast: false,
        index: true,
        enum: {
            values: ["personal", "business", "student", "organization", "admin", "root", "server"],
            message: "Type not valid"
        },
        required: true
    },
    password: {
        type: String,
        cast: false,
        index: true,
        unique: true,
        required: true
    },
    parentAccountId: {
        type: String,
        cast: false,
        required: function () {
            if (this.type === "student") {
                return true;
            } else {
                return false;
            };
        }
    },
    linkAccountId: {
        type: String,
        cast: false,
        required: function () {
            if (this.type === "personal" || this.type === "business" || this.type === "student") {
                return true;
            } else {
                return false;
            };
        }
    },
    organizationId: {
        type: String,
        cast: false,
        required: function () {
            if (this.type === "organization") {
                return true;
            } else {
                return false;
            };
        }
    },
    familyId: {
        type: String,
        cast: false,
        required: function () {
            if (this.type === "personal" || this.type === "business" || this.type === "student") {
                return true;
            } else {
                return false;
            };
        }
    }
}, { timestamps: true, writeConcern: { w: "majority", j: true, wtimeout: 5000 }, strict: true, strictQuery: true });

const SecurityModel = global.mongooseClient.model(schemaNames.security, SecuritySchema, schemaNames.security);

// Schema functions

/**
 * 
 * Validates the passed password
 * 
 * @param {String} password
 */
function validatePassword(password) {
    if (passwordValidateRegex.all.test(password) === false) {
        if (passwordValidateRegex.length.test(password) === false) {
            throw "Characters length need to be in between 8 and 30";
        };
        if (passwordValidateRegex.simpleLetters.test(password) === false) {
            throw "Need to have one simple character";
        };
        if (passwordValidateRegex.capitalLetters.test(password) === false) {
            throw "Need to have one capital character";
        };
        if (passwordValidateRegex.digits.test(password) === false) {
            throw "Need to have one number";
        };
        if (passwordValidateRegex.containsSpaces.test(password) === false) {
            throw "Cannot contain any spaces";
        };
        if (passwordValidateRegex.specialCharacters.test(password) === false) {
            throw "Need to have one for these (!,@,#,$,%,^,&,*) characters";
        };
    };
};

/**
 * 
 * Hash the inputed password
 * 
 * @param {String} password 
 */
async function hashPassword(password) {
    for (let i = 0; i < 5; i++) {
        const hashPass = await hash(password, 10);
        if (await compare(password, hashPass)) {
            return hashPass;
        };
    };
    throw "Password hashing error. Try again later";
};

/**
 * 
 * Inserts data into security collection
 * 
 * @param {Object} inputData
 * @param {Object|undefined} options
 * @returns {Promise} 
 */
async function insertInfo(inputData, options) {
    validatePassword(inputData.password);
    inputData.password = await hashPassword(inputData.password);
    const dataObject = new SecurityModel(inputData);
    try {
        await dataObject.validate();
    } catch (error) {
        throw getErrorMinimized(error);
    };
    for (let i = 0; i < 5; i++) {
        setTimeout(() => {
            return;
        }, 2000);
        try {
            return await dataObject.save(options);
        } catch (error) {
            continue;
        };
    };
    throw "Data inserting error";
};

/**
 * 
 * Returns the found account type that match the given fillter 
 * 
 * @param {object} fillter
 * @returns {Promise<String>}
 */
async function getAccountType(fillter) {
    let data;
    try {
        data = await SecurityModel.findOne(fillter, { type: 1 });
        if (typeof data === "object") {
            return data.type;
        } else {
            throw "error";
        };
    } catch (error) {
        throw "Account type not found";
    };
};

/**
 * 
 * Update data in security collection
 * 
 * @param {String} aType - Account type
 * @param {Object} fillter 
 * @param {Object} update 
 * @param {Object|undefined} options 
 * @returns {Promise}
 */
async function updateInfo(fillter, update, aType, options) {
    if (typeof fillter !== "object" || typeof update !== "object") {
        throw "Fillter and update and options needs to be object";
    };
    if (typeof update.$set !== "object") {
        throw "Update object invalid. Need to have a $set object";
    };
    // Checking for the account type. Because account type is needed so that we can identify what are required values and not required values for the
    // specific account type
    if (typeof aType === "undefined") {
        aType = await getAccountType(fillter);
    };
    if (aType === "server" || aType === "admin" || aType === "root") {
        update = { $set: { password: update.$set.password } };
    };
    if (aType !== "organization") {
        if (typeof update.$set.organizationId === "string") {
            throw "Only account type organization can have a organization id";
        };
    };
    if (update.$set) {
        if (typeof update.$set.password === "string") {
            validatePassword(update.$set.password);
            update.$set.password = await hashPassword(update.$set.password);
        };
    };
    return SecurityModel.updateOne(fillter, update, options);
};

module.exports = {
    SecuritySchema,
    SecurityModel,
    validatePassword,
    hashPassword,
    insertInfo,
    updateInfo,
    getAccountType
};