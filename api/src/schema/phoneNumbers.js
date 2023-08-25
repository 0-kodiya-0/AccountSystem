const { Schema, Types } = require("mongoose");
const schemaNames = require("./names");

const phoneNumberValidateRegex = {
    digits: /^(?=.*[0-9])/,
    containsSpaces: /^((?![/ /]).)*$/,
    all: /^(?=.*[0-9])((?![/ /]).)*$/
};

const phoneNumberDetails = {
    sri_lanka: {
        code: 94,
        lengthRegex: /^(?=.{10,})/
    }
};

const PhoneNumbersSchema = new Schema({
    accountId: {
        type: Types.ObjectId,
        cast: false,
        index: true,
        required: true
    },
    country: {
        type: String,
        cast: false,
        required: true
    },
    countryCode: {
        type: Number,
        cast: false,
        required: true
    },
    phoneNumber: {
        type: String,
        cast: false,
        unique: true,
        validate: function (data) {
            validatePhoneNumber(this.country, data, this.countryCode);
        },
        lowercase: true,
        required: true
    }
}, { timestamps: true, writeConcern: { w: "majority", j: true, wtimeout: 5000 }, strict: true, strictQuery: true });

const PhoneNumbersModel = global.mongooseClient.model(schemaNames.phoneNumbers, PhoneNumbersSchema, schemaNames.phoneNumbers);

// Schema Functions

/**
 * 
 * @param {String} country 
 * @param {String} phoneNumber 
 * @param {Number} code 
 * @returns 
 */
async function validatePhoneNumber(country, phoneNumber, code) {
    if (phoneNumberValidateRegex.all.test(phoneNumber) === false) {
        if (phoneNumberValidateRegex.digits.test(phoneNumber) === false) {
            throw "Cannot contain any letters";
        };
        if (phoneNumberValidateRegex.containsSpaces.test(phoneNumber) === false) {
            throw "Cannot contain any spaces";
        };
    };
    const countryData = phoneNumberDetails[country];
    const newCode = code || phoneNumber.slice(0, 2);
    phoneNumber = phoneNumber.slice(2, phoneNumber.length);
    if (typeof countryData !== "object") {
        throw "Country not valid";
    };
    if (countryData.code === newCode) {
        throw "Country code not valid";
    };
    if (countryData.lengthRegex.test(phoneNumber) === false) {
        throw "Phone number length not valid";
    };
    return {
        code: newCode,
        phoneNumber: phoneNumber
    };
};

/**
 * 
 * Inserts data into PhoneNumbers collection
 * 
 * @param {Object} inputData
 * @param {Object|undefined} options
 * @returns {Promise} 
 */
async function insertInfo(inputData, options) {
    const dataObject = new PhoneNumbersModel(inputData);
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
    PhoneNumbersSchema, PhoneNumbersModel,
    validatePhoneNumber, insertInfo
}