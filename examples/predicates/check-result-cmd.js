#!/usr/bin/env node
const pred = require("./pred.js");

function main () {
    var arg = process.argv[2];
    var res = pred.test(arg);

    if (res) {
        process.exit(0);
    } else {
        process.exit(-1);
    }
}


main();