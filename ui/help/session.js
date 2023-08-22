let signInUpSession = [["GET", "http://127.0.0.1:4000/signin/createsession"]];

async function getSignUpSession(what) {
    try {
        const session = await fetch(`${signInUpSession[0][1]}?for=${what}`, {
            credentials: "same-origin",
            cache: "no-cache",
            method: "GET"
        });
        return false;
    } catch (error) {
        throw "Server Error";
    };
};

async function getServerSignInSession() {
    try {
        const session = await fetch(`${signInUpSession[0][1]}?for=server`, {
            credentials: "same-origin",
            cache: "no-cache",
            method: "GET",
            headers: {
                Authorization: `Basic ${Buffer.from(`${process.env.API_SERVER_USERNAME}:${process.env.API_SERVER_PASSWORD}`, "utf-8").toString("base64")}`
            }
        });
        return await session.text();
    } catch (error) {
        throw "Server Error";
    };
};

module.exports = {
    getServerSignInSession, getSignUpSession
}