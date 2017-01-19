#!/usr/bin/env node
var execSucc = function (filename) {
    var content = String(require("fs").readFileSync(filename));
    var parsed = JSON.parse(content);
    return parsed.length !== undefined && contains(parsed, 0) &&
        contains(parsed, 4000) &&
        contains(parsed, 6000) &&
        contains(parsed, 8000) &&
        contains(parsed, 10000);
};

function contains(a, n) {
    return a.indexOf(n) !== -1;
}
exports.test = execSucc;
