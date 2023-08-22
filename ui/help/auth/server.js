import sessionFunc from "@/help/session";

let signInDataAddUrl = [["POST", 'http://127.0.0.1:4000/signin/add/username'], ["POST", "http://127.0.0.1:4000/signin/add/password"], ["GET", "http://127.0.0.1:4000/signin/submit"]];

/**
 * Access the api server and creates a server access token. So that server can access other api paths
 */
async function serverLogin() {
    try {
        const sessionToken =  await sessionFunc.getServerSignInSession(); // Getting the session token in the body
        let accessToken;
        for (let i = 0; i < signInDataAddUrl.length; i++) {
            const formBody = new FormData();
            if (signInDataAddUrl[i][1].includes("add/username")) {
                formBody.append("username", process.env.SERVER_USERNAME);
            } else if (signInDataAddUrl[i][1].includes("add/password")) {
                formBody.append("password", process.env.SERVER_PASSWORD);
            };
            const options = { method: signInDataAddUrl[i][0] };
            if (signInDataAddUrl[i][0] === "POST") { // Only in a POST request can have a body
                options.body = formBody;
            };
            accessToken = await fetch(`${signInDataAddUrl[i][1]}?session=${sessionToken}`, options);
        };
        process.env.ACCESS_TOKEN = await accessToken.text();
    } catch (error) {
        throw error;
    };
};

module.exports = {
    serverLogin
}