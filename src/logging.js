const file_util = require("./file_util"),
    util = require("util"),
    fs = require("fs");
var indentation = [];
function formatIndentation() {
    return indentation.join("");
}
function addIndentation(args) {
    args[0] = util.format("%s%s", formatIndentation(), args[0]);
}
module.exports = {

    log: function () {
        addIndentation(arguments);
        console.log.apply(console, arguments)
    },
    warn: function () {
        addIndentation(arguments);
        console.warn.apply(console, arguments)
    },
    error: function () {
        addIndentation(arguments);
        console.error.apply(console, arguments)
    },
    logTargetChange: function (file, dir) {
        var dirInfo = dir ? util.format(" In %s (%s bytes)", dir, file_util.du_sb(dir)) : "";
        this.log("Target: %s (%s bytes)%s", file, file_util.du_sb(file), dirInfo);
    },
    logDone: function (file) {
        var size = file_util.du_sb(file);
        if (!fs.statSync(file).isDirectory() && fs.size < 2000) {
            this.log("Final version content:");
            // small enough to display
            this.log("```");
            this.log(fs.readFileSync(file, 'utf8'));
            this.log("```");
        }
        this.log("Minimisation finished; final version is at %s (%d bytes)", file, size);
    },
    increaseIndentation: function () {
        indentation.push("  ")
    },
    decreaseIndentation: function () {
        indentation.pop();
    },
    getIndentation: function () {
        return formatIndentation();
    }
};