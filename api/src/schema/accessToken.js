const { Schema, Types } = require("mongoose");
const schemaNames = require("./names");
const { ServerModel } = require("./server");
const { getAccountType } = require("./security");
const { getErrorMinimized } = require("./error");

const AccessTokenSchema = new Schema({
    accountId: {
        type: Types.ObjectId,
        cast: false,
        index: true,
        validate: async function (data) {
            if (await ServerModel.exists({ _id: data, display: true }) === null) {
                throw "Invalid server account id";
            };
        },
        required: true
    },
    tokenId: {
        type: String,
        cast: false,
        index: true,
        required: true
    },
    userAgent: {
        type: String,
        cast: false,
        index: true,
        trim: true,
        required: true
    },
    loged: {
        type: Boolean,
        cast: false,
        index: true,
        default: false
    },
    twoFactorAuth: {
        type: Boolean,
        cast: false,
        index: true,
        default: false
    }
}, { timestamps: true, writeConcern: { w: "majority", j: true, wtimeout: 5000 }, strict: true, strictQuery: true });

const AccessTokenModel = global.mongooseClient.model(schemaNames.accessTokens, AccessTokenSchema, schemaNames.accessTokens);

// Schema functions

/**
 * 
 * Inserts data into accessToken collection
 * 
 * @param {Object} inputData
 * @param {string} aType - Account Type
 * @param {Object|undefined} options
 * @returns {Promise} 
 */
async function insertInfo(inputData, aType, options) {
    if (typeof aType === "undefined") {
        aType = await getAccountType({ _id: inputData.accountId });
    };
    if (aType !== "server") {
        if (await AccessTokenModel.findOne({ accountId: inputData.accountId, loged: true })) {
            inputData.loged = false;
        };
        if (aType === "root") {
            if (await AccessTokenModel.findOne({ accountId: inputData.accountId, loged: true })) {
                throw "Root cannot have multiple access tokens";
            };
        };
    } else {
        await updateInfo({ accountId: inputData.accountId, loged: true }, { $set: { loged: false } });
    };
    const dataObject = new AccessTokenModel(inputData);
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
 * Update data in accessToken collection
 * 
 * @param {Object} fillter 
 * @param {Object} update 
 * @param {Object|undefined} options 
 * @returns {Promise}
 */
async function updateInfo(fillter, update, options) {
    if (typeof fillter !== "object" || typeof update !== "object") {
        throw "Fillter and update and options needs to be object";
    };
    if (typeof update.$set !== "object") {
        throw "Update object invalid. Need to have a $set object";
    };
    if (typeof update.$set.loged === "boolean") {
        update = { $set: { loged: update.$set.loged } };
    } else if (typeof update.$set.twoFactorAuth === "boolean") {
        update = { $set: { twoFactorAuth: update.$set.twoFactorAuth } };
    } else {
        throw "Only loged and twoFactorAuth variables can be updated";
    };
    return AccessTokenModel.updateOne(fillter, update, options);
};

module.exports = {
    AccessTokenSchema,
    AccessTokenModel,
    insertInfo,
    updateInfo
}