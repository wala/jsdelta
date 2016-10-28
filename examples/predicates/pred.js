#!/usr/bin/env node
var execSucc = function (filename) {
    var process = require("child_process");
    const options = {
        stdio: "pipe"
    };

    try {
        output = process.execSync('node ' + filename, options);
    } catch (err) {
        return false;
    }

    if (output === null) {
        return false;
    }
    return output.indexOf("success") !== -1;
};
exports.test = execSucc;
