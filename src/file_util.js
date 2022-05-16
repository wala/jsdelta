const fs = require("fs-extra"),
    path = require("path"),
    tmp = require("tmp"),
    escodegen = require("escodegen"),
    config = require("../config"),
    esprima = require("espree");
// get name of current test case
function getTempFileName(state) {
    var fn = state.tmp_dir + "/delta_js_" + state.round + "." + state.ext;
    state.round++;
    return fn;
}

// write the current test case out to disk
function writeTempFile(state) {
    var fn = getTempFileName(state);
    persistAST(fn, state);
    return fn;
}

function persistAST(file, state) {
    fs.writeFileSync(file, pp(state).trim() + "\n");
}

function pp(state) {
    var ast = state.ast;
    if (!ast) {
        throw new Error();
    }
    // we pass the 'parse' option here to avoid converting 0.0 to 0, etc.;
    // for JSON files, we skip the top-level `Program` and `ExpressionStatement`
    // nodes to prevent escodegen from inserting spurious parentheses
    return escodegen.generate(state.ext === 'json' && ast.body[0] ? ast.body[0].expression : ast, {
        format: {
            json: state.ext === 'json'
        },
        parse: parse
    });
}

function parse(input) {
    try {
        return esprima.parse(input, {ecmaVersion:'latest'});
    } catch (e) {
        throw e;
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

//Return path to file if copy was successful. Return undefined otherwise.
function copyToOut(src, out, multiFileMode) {
    try {
        fs.copySync(src, out);
        fs.statSync(out)
        return out;
    } catch (err) {
    }
}

/**
 * Create a fresh temporary directory. Returns the name of the directory.
 */
function makeTempDir(){
    return tmp.dirSync({prefix: "jsdelta-", dir: config.tmp_dir}).name;
}

module.exports.du_sb = du_sb;
module.exports.getTempFileName = getTempFileName;
module.exports.writeTempFile = writeTempFile;
module.exports.persistAST = persistAST;
module.exports.pp = pp;
module.exports.parse = parse;
module.exports.copyToDir = copyToOut
module.exports.makeTempDir = makeTempDir;