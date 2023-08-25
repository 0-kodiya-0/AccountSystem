const { Schema, Types } = require("mongoose");
const schemaNames = require("./names");

const LocationsSchema = new Schema({
    accountId: {
        type: Types.ObjectId,
        cast: false,
        required: true
    },
    type: {
        type: String,
        cast: false,
        enum: {
            values: ["home", "organization", "school", "work"],
            message: "Type not valid"
        },
        required: true
    },
    country: {
        type: String,
        cast: false,
        enum: {
            values: ["sri_lanka"],
            message: "Country not valid"
        },
        required: true
    },
    address: {
        type: String,
        cast: false,
        minlength: [10, "Address length didn't reached min length"],
        maxlength: [10, "Address length reached max length"],
        required: true
    },
    zipCode: {
        type: Number,
        cast: false,
        min: 0,
        max: 99999,
        required: true
    },
}, { timestamps: true, writeConcern: { w: "majority", j: true, wtimeout: 5000 }, strict: true, strictQuery: true });

const LocationsModel = global.mongooseClient.model(schemaNames.locations, LocationsSchema, schemaNames.locations);

// Schema Functions

/**
 * 
 * Inserts data into Locations collection
 * 
 * @param {Object} inputData
 * @param {Object|undefined} options
 * @returns {Promise} 
 */
async function insertInfo(inputData, options) {
    const dataObject = new LocationsModel(inputData);
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
    LocationsSchema, LocationsModel,
    insertInfo
}
