#!/usr/bin/env node 
/* args[dir, mainfile, pred]
 * 1. Create tmp dir, and move dir to tmp dir
 * 2. invoke jsdelta on all files (and recursively visit sub directories) 
 *    - when minimized move to tmp dir and overwrite original
 * 3. invoke jsdelta on main file
 * 4. output result
 */
const path = require("path"),
      fs = require("fs"),
      copydir = require("copy-dir"),
      config = require(__dirname + "/config.js");

var dir, mainFile, predicate;

function createAndInstantiateDeltaDir() {
    var tmpDir = fs.mkdtempSync(config.tmp_dir + "/jsdelta-multifile");
    copydir.sync(dir, tmpDir);
    return tmpDir;
}

function main () {
    parseOptions();
    checkOptions();
    var tmpDeltaDir = createAndInstantiateDeltaDir();
}
main();


function parseOptions() {
    var args = process.argv;
    if (args.length < 5) {
        usage();
    }
    dir = args[2];
    mainFile = args[3];
    predicate = args[4];
}

function checkOptions() {
   if (!path.isAbsolute(dir)) {
       logAndExit("Directory " + dir + " must be absolute");
   }
   var mainFilePath = path.resolve(dir, mainFile);
   try {
       fs.accessSync(mainFilePath, fs.F_OK); 
   }
   catch (err) {
       logAndExit("Could not find main file " + mainFilePath);
   }
}

function logAndExit(msg) {
    console.error(msg);
    process.exit(-1);
}

function usage() {
    console.error("Usage: node jsdelta-multifile.js DIR MAIN_FILE PREDICATE");
    process.exit(-1);
}
