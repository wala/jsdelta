#!/usr/bin/env node
const fs = require("fs-extra"),
    path = require("path");

function main () {
    if (process.argv.length < 4) {
        console.error("Usage: $ ./cmp-size /path/nr/1 /path/nr/2");
        process.exit(-1);
    }
    var path1 = process.argv[2];
    var path2 = process.argv[3];

    validatePath(path1);
    validatePath(path2);

    var sizePath1 = du_sb(path1);
    var sizePath2 = du_sb(path2);

    if (sizePath1 > sizePath2) {
        process.exit(2);
    } else if (sizePath1 === sizePath2) {
        process.exit(1);
    } else {
        process.exit(0);
    }

    function validatePath(thePath) {
        try {
            fs.statSync(thePath);
        } catch (err) {
            console.error("not a valid path " + thePath);
            process.exit(-1);
        }
    }

    function du_sb (file) {
        var size = 0;
        var fileStat = fs.statSync(file);
        if (fileStat.isDirectory()) {
            fs.readdirSync(file).forEach(function (child) {
                size += du_sb(path.resolve(file, child));
            });
        }
        size += fileStat.size;
        return size;
    }
}
main();