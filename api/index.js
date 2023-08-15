const server = require("./local_modules/MyExpressServer").Server

server.listen(3000, () =>{
    console.log("server up")
})