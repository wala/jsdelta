exports.cmd = "examples/predicates/check-result-cmd-stderr.js";

exports.checkResult = function (errCode, stdout, stderr, time) {
    return errCode == 0;
}

