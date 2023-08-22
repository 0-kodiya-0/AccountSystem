/**
 * 
 * Minimize the mongoose error string into object with value and reason variables
 * 
 * @param {object} error 
 * @returns 
 */
function getErrorMinimized(error) {
    data = Object.values(error.errors)
    for (let i = 0; i < data.length; i++) {
        data[i] = { value: data[i].value, reason: data[i].reason };
    };
    return data;
};

module.exports = {
    getErrorMinimized
}