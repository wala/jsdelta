const file_util = require("./file_util"),
    util = require("util"),
    fs = require("fs");
function makeIndentation(indent) {
    return "  ".repeat(indent);
}
module.exports = {
    log: function () {
        console.log.apply(console, arguments)
    },
    warn: function () {
        console.warn.apply(console, arguments)
    },
    error: function () {
        console.error.apply(console, arguments)
    },
    logTargetChange: function (file, indent, dir) {
        var dirInfo = dir ? util.format(" In %s (%s bytes)", dir, file_util.du_sb(dir)) : "";
        this.log("%sTarget: %s (%s bytes)%s", makeIndentation(indent), file, file_util.du_sb(file), dirInfo);
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
    }

};