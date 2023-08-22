const { Schema } = require("mongoose");
const schemaNames = require("./names");

const ServerSchema = new Schema({
    comment: {
        type: String,
        cast: false,
        minlength: [2, "comment.length didn't reached min length"],
        maxlength: [30, "comment.length reached max length"],
        lowercase: true,
        required: true
    },
    display: {
        type: Boolean,
        cast: false,
        default: true
    }
}, { timestamps: true, writeConcern: { w: "majority", j: true, wtimeout: 5000 }, strict: true, strictQuery: true });

const ServerModel = global.mongooseClient.model(schemaNames.server, ServerSchema, schemaNames.server);

// Schema functions

/**
 * 
 * Inserts data into security collection
 * 
 * @param {Object} inputData
 * @param {Object|undefined} options
 * @returns {Promise} 
 */
async function insertInfo(inputData, options) {
    const dataObject = new ServerModel(inputData);
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
    ServerSchema,
    ServerModel,
    insertInfo
}