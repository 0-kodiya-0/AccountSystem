const fs = require('fs');

class Cert {
    //root
    #filePath;
    // Cert files
    #public;
    #private;
    #cert;
    //fileNames
    #fileName;
    constructor(filePath, fileName) {
        this.#filePath = filePath;
        if (fileName) {
            this.#fileName = fileName;
        } else {
            this.#fileName = "cert";
        }
    }
    import = {
        public: () => {
            this.#public = fs.readFileSync(`${this.#filePath}${this.#fileName}.pub`);
        },
        private: () => {
            this.#private = fs.readFileSync(`${this.#filePath}${this.#fileName}.key`);
        },
        cert: () => {
            this.#cert = fs.readFileSync(`${this.#filePath}${this.#fileName}.crt`);
        },
        all: () => {
            this.import.public();
            this.import.private();
            this.import.cert();
        }
    }
    export = {
        public: () => {
            return this.#public;
        },
        private: () => {
            return this.#private;
        },
        cert: () => {
            return this.#cert;
        },
        all: () => {
            return { pub: this.export.public(), pri: this.export.private(), cert: this.export.cert() };
        }
    }
}

module.exports = { Cert };