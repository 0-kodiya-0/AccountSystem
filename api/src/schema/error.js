/**
 * 
 * Minimize the mongoose error string into object with value and reason variables
 * 
 * @param {object} error 
 * @returns 
 */
function getErrorMinimized(error) {
    data = Object.values(error.errors || error);
    const newData = [];
    for (let i = 0; i < data.length; i++) {
        if (typeof data[i] === "object") {
            newData.push({ path: data[i].path, value: data[i].value, message: data[i].message, reason: data[i].reason });
        };
    };
    return newData;
};

module.exports = {
    getErrorMinimized
}