#!/usr/bin/env node 
/* args[dir, mainfile, pred]
 * 1. Create tmp dir, and move dir to tmp dir
 * 2. invoke jsdelta on all files (and recursively visit sub directories) 
 *    - when minimized move to tmp dir and overwrite original
 * 3. invoke jsdelta on main file
 * 4. output result
 */
const path = require("path"),
      fs = require("node-fs-extra"),
      config = require(__dirname + "/config.js")
      deltalib = require(__dirname + "/deltalib.js");

var dir, 
    mainFile, 
    mainFileTmpDir,
    predicate,
    fileUnderTest,
    tmpDir,
    backupFile;

/** 
  * Recursively pass through the file-hierarchy and invoke deltalib.main on the files
  */
function deltaDebug(file) {
    //main file should be the last file to be reduced
    if (file === mainFileTmpDir) {
        return;
    }

    var stats = fs.statSync(file);
    fileUnderTest = file;
    if (stats.isDirectory()) {
        fs.readdirSync(file).forEach(function (child) {
            childPath = path.resolve(file, child);
            deltaDebug(childPath);
        });
    } else { //Assume it's non-directory file
        var options = new Options(file);

        //try removing fileUnderTest completely before delta-debugging
        fs.copySync(fileUnderTest, backupFile);      	
        fs.unlink(fileUnderTest);

        //if that fails, then restore the fileUnderTest and try to reduce it
        if (!predicate.test(mainFileTmpDir)) {
            fs.copySync(backupFile, fileUnderTest);      	
            console.log("Reducing " + path.relative(tmpDir, fileUnderTest));
            deltalib.main(options);
        }
    }
}


function deltaDebugMain () {
    options = new Options(mainFileTmpDir);
    fileUnderTest = mainFileTmpDir;
    deltalib.main(options);
}

function Options (file) {
    this.quick = false,
    this.findFixpoint = true,
    this.cmd = null,
    this.errmsg = null,
    this.msg = null,
    this.file = file,
    this.predicate = predicate_wrapper,
    this.predicate_args = [],
    this.record = null,
    this.replay = null,
    this.replay_idx = -1,
    this.multifile_mode = true
}

var predicate_wrapper = {
    test: function (deltaReducedFile) {
        fs.copySync(fileUnderTest, backupFile);
        fs.copySync(deltaReducedFile, fileUnderTest);
        mainFileTmpDir = path.resolve(tmpDir, mainFile);
        var res = predicate.test(mainFileTmpDir);

        //Restore backed-up file if new version fails the predicate
        if (!res) {
            fs.copySync(backupFile, fileUnderTest);
        }
        return res;
    }
};


function main () {
    parseOptions();
    checkOptions();
    createAndInstantiateDeltaDir();
    createTmpBackupFile();

    //Begin
    deltaDebug(tmpDir);
    deltaDebugMain();
    console.log("Minimized version available at " + tmpDir);
}
main();

function parseOptions() {
    var args = process.argv;
    if (args.length < 5) {
        usage();
    }
    dir = args[2];
    mainFile = args[3];
    predicate = require(args[4]); 
}

function checkOptions() {
   if (!path.isAbsolute(dir)) {
       logAndExit("Directory " + dir + " must be absolute");
   }
   var mainFileFullPath = path.resolve(dir, mainFile);
   try {
       fs.accessSync(mainFileFullPath, fs.F_OK); 
   }
   catch (err) {
       logAndExit("Could not find main file " + mainFileFullPath);
   }
}

function createTmpBackupFile() {
    var tmpBackupDir = fs.mkdtempSync(config.tmp_dir + "/backup");
    backupFile = path.resolve(tmpBackupDir, "backup");
    console.log(backupFile);
}

function createAndInstantiateDeltaDir() {
    tmpDir = fs.mkdtempSync(config.tmp_dir + "/jsdelta-multifile");
    fs.copySync(dir, tmpDir);
    mainFileTmpDir = path.resolve(tmpDir, mainFile);
    return tmpDir;
}

function logAndExit(msg) {
    console.error(msg);
    process.exit(-1);
    //process.exit() does not guarentee immediate termination
    //so an infinite loop is inserted to avoid continuing the uninteded execution.
    while(true) {}
}

function usage() {
    console.error("Usage: node delta-multifile.js DIR MAIN_FILE_RELATIVE_TO_DIR PREDICATE");
    process.exit(-1);
}
