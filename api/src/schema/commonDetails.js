const { Schema } = require("mongoose");
const schemaNames = require("./names");

const userNameValidateRegex = {
    simpleLetters: /^(?=.*[a-z])/,
    capitalLetters: /^(?=.*[A-Z])/,
    length: /^(?=.{5,30})/,
    containsSpaces: /^((?![/ /]).)*$/,
    all: /^(?=.*[a-z])(?=.*[A-Z])(?=.{5,30})((?![/ /]).)*$/
};

const CommonDetailsSchema = new Schema({
    userName: {
        type: String,
        cast: false,
        minlength: [5, "Username length didn't reached min length"],
        maxlength: [30, "Username length reached max length"],
        validate: validateUserName,
        unique: true,
        index: true,
        match: userNameValidateRegex.all,
        required: true
    },
    email: {
        type: String,
        cast: false,
        minlength: [5, "Email length didn't reached min length"],
        maxlength: [30, "Email length reached max length"],
        validate: async function (data) {
            if (await CommonDetailsModel.exists({ email: data })) {
                throw "Email exists";
            };
        },
        unique: true,
        index: true,
        match: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        required: true
    },
    firstName: {
        type: String,
        cast: false,
        minlength: [2, "Firstname length didn't reached min length"],
        maxlength: [30, "Firstname length reached max length"],
        match: /^((?![/ /]).)*$/,
        lowercase: true,
        required: true
    },
    lastName: {
        type: String,
        cast: false,
        minlength: [2, "Lastname length didn't reached min length"],
        maxlength: [30, "Lastname length reached max length"],
        match: /^((?![/ /]).)*$/,
        lowercase: true,
        required: true
    },
    age: {
        type: Number,
        cast: false,
        required: true
    },
    birth: {
        type: String,
        cast: false,
        validate: validateBirthDay,
        required: true
    },
    gender: {
        type: String,
        cast: false,
        enum: {
            values: ["male", "female", "other", "rathernotsay"],
            message: "Gender not valid"
        },
        required: true
    },
    display: {
        type: Boolean,
        cast: false,
        default: true
    }
}, { timestamps: true, writeConcern: { w: "majority", j: true, wtimeout: 5000 }, strict: true, strictQuery: true });

const CommonDetailsModel = global.mongooseClient.model(schemaNames.commonDetails, CommonDetailsSchema, schemaNames.commonDetails);

// Schema functions

/**
 * 
 * Validates if the birthday is valid date
 * 
 * @param {String} birth - need to in DD-MM-YYYY format
 * @returns {Null}
 */
function validateBirthDay(birthday) {
    const date = moment(birthday, "DD-MM-YYYY");
    if (date.isValid()) {
        const now = new Date();
        if (date.year() <= now.getFullYear()) {
            if (date.year() === now.getFullYear()) {
                if (date.month() <= now.getMonth() + 1) {
                    if (date.month() === now.getMonth()) {
                        if (date.date() < now.getDate()) {
                            return;
                        } else {
                            throw "Birth date";
                        };
                    } else {
                        return true;
                    };
                } else {
                    throw "Birth month";
                };
            } else {
                return true;
            };
        } else {
            throw "Birth year";
        };
    } else {
        throw "Birth";
    };
};

/**
 * 
 * Extract the age from the birthday
 * 
 * @param {String} birthday - Date need to be in DD-MM-YYYY format 
 * @returns {Number}
 */
function getAge(birthday) {
    const today = new Date(); // Calculates the age
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    };
    return age;
};

/**
 * 
 * Validates the age for the given account type
 * 
 * @param {String} aType 
 * @param {String} birthday
 */
function validateAge(age, aType) {
    if (aType === "organization" || aType === "server") { // Validates the age
        return;
    };
    if (aType !== "student") { // Validates the age
        if (age < 18 && age > 120) {
            throw "Age need to be between 18 and 120";
        };
    };
    if (aType === "student") {
        if (age < 6 && age > 15) {
            throw "Age need to be between 6 and 15";
        };
    };
};

/**
 * 
 * @param {String} userName 
 */ 
async function validateUserName(userName) {
    if (userNameValidateRegex.all.test(userName) === false) {
        if (userNameValidateRegex.length.test(userName) === false) {
            throw "Characters length need to be in between 5 and 30";
        };
        if (userNameValidateRegex.simpleLetters.test(userName) === false) {
            throw "Need to have one simple character";
        };
        if (userNameValidateRegex.capitalLetters.test(userName) === false) {
            throw "Need to have one capital character";
        };
        if (userNameValidateRegex.containsSpaces.test(userName) === false) {
            throw "Cannot contain any spaces";
        };
    };
    if (await CommonDetailsModel.exists({ userName: userName })) {
        throw "Username exists";
    };
};

/**
 * 
 * Inserts data into CommonDetails collection
 * 
 * @param {Object} inputData
 * @param {string} aType - Account Type
 * @param {Object|undefined} options
 * @returns {Promise} 
 */
async function insertInfo(aType, inputData, options) {
    validateUserName(inputData.userName);
    const age = getAge(inputData.birth);
    validateAge(age, aType);
    const dataObject = new CommonDetailsModel(inputData);
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

module.exports = {
    CommonDetailsSchema, CommonDetailsModel,
    insertInfo, validateAge, validateBirthDay, validateUserName, getAge
}