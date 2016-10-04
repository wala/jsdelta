#!/usr/bin/env node 
/*******************************************************************************
 * Copyright (c) 2012 IBM Corporation.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *     Max Schaefer    - refactoring
 *******************************************************************************/

const path = require("path"),
      fs = require("node-fs-extra"),
      config = require(__dirname + "/config.js"),
      deltalib = require(__dirname + "/deltalib.js"),
      hashFiles = require("hash-files");

var dir, 
    mainFileTmpDir,
    predicate,
    fileUnderTest,
    tmpDir,
    backupDir,
    backupFile;

var options = {
    /** only knock out entire statements */
    quick : false,
    /** Repeat until a fixpoint is found */
    findFixpoint : true,
    /** command to invoke to determine success/failure */
    cmd : null,
    /** error message indicating failure of command */
    errmsg : null,
    /** message indicating failure of command, either on stdout or stderr */
    msg : null,
    /** file to minimise */
    file : null,
    /** predicate to use for minimisation */
    predicate : {},
    /** arguments to pass to the predicate */
    predicate_args : [],
    /** file to record predicate results to */
    record : null,
    /** array to read predicate results from */
    replay : null,
    replay_idx : -1,
    multifile_mode : false
};

// command line option parsing; manual for now
// TODO: find good npm package to use
for (var i = 2; i < process.argv.length; ++i) {
    var arg = process.argv[i];
    if (arg === '--quick' || arg === '-q') {
        options.quick = true;
    } else if (arg === '--no-fixpoint') {
        options.findFixpoint = false;
    } else if (arg === '--cmd') {
        if (options.cmd === null)
            options.cmd = String(process.argv[++i]);
        else
            console.warn("More than one command specified; ignoring.");
    } else if (arg === '--timeout') {
        console.warn("Timeout ignored.");
    } else if (arg === '--errmsg') {
        if (options.errmsg === null)
            options.errmsg = String(process.argv[++i]);
        else
            console.warn("More than one error message specified; ignoring.");
    } else if (arg === '--msg') {
        if (options.msg === null) {
            options.msg = String(process.argv[++i]);
        } else {
            console.warn("More than one message specified; ignoring.");
        }
    } else if (arg === '--record') {
        options.record = process.argv[++i];
        if (fs.existsSync(options.record))
            fs.unlinkSync(options.record);
    } else if (arg === '--replay') {
        if (options.cmd) {
            console.warn("--replay after --cmd ignored");
        } else {
            options.replay = fs.readFileSync(process.argv[++i], 'utf-8').split('\n');
            replay_idx = 0;
        }
    } else if (arg === '--dir') {
        options.multifile_mode = true;
        options.dir = process.argv[++i];
    } else if (arg === '--') {
        options.file = process.argv[i + 1];
        i += 2;
        break;
    } else if (arg[0] === '-') {
        deltalib.usage();
    } else {
        options.file = process.argv[i++];
        break;
    }
}

// check whether a predicate module was specified
if (i < process.argv.length) {
    options.predicate = require(process.argv[i++]);
}

// the remaining arguments will be passed to the predicate
options.predicate_args = process.argv.slice(i);
synthesizePredicate();

//Run in multifile mode
if (options.multifile_mode) {
    console.log("Running in multifile mode");
    checkMultiFileModeOptions();
    createAndInstantiateDeltaDir();
    instantiateBackupPaths();

    //Repeat delta debugging until no changes are registered
    if (options.findFixpoint) {
        var count = 1;
        var newSha = computeSha(tmpDir);
        var prevSha = "";
        while (newSha !== prevSha) {
            console.log("Multifile fixpoint iteration: #" + count);
            deltaDebug(tmpDir);
            deltaDebugMain();
            prevSha = newSha;
            newSha = computeSha(tmpDir);
            count++;
        }
    } else {
        deltaDebug(tmpDir);
        deltaDebugMain();
    }
    console.log("Minimized version available at " + tmpDir);

} else { //Run in singlefile mode
    deltalib.main(options);
}


function instantiateBackupPaths() {
    var tmpBackupDir = fs.mkdtempSync(config.tmp_dir + "/backup");
    backupDir = path.resolve(tmpBackupDir, "backupDir");
    backupFile = path.resolve(tmpBackupDir, "backup");
}

function createAndInstantiateDeltaDir() {
    tmpDir = fs.mkdtempSync(config.tmp_dir + "/jsdelta-multifile");
    fs.copySync(options.dir, tmpDir);
    mainFileTmpDir = path.resolve(tmpDir, options.file);
    return tmpDir;
}

/** 
 * Recursively pass through the file-hierarchy and invoke deltalib.main on all files
 */
function deltaDebug(file) {
    //main file should be the last file to be reduced
    if (file === mainFileTmpDir) {
        return;
    }
    fileUnderTest = file;

    if (fs.statSync(file).isDirectory()) {
        readDirSorted(file).forEach(function (child) {
            if (fs.statSync(child).isDirectory()) {
                //Try removing directory completely before delta-debugging
                fs.copySync(child, backupDir);
                fs.removeSync(child);
                if (!predicate.test(mainFileTmpDir)) {
                    fs.copySync(backupDir, child);
                    deltaDebug(child);
                }
            } else {
                deltaDebug(child);
            }
        });
    } else { 
        var options = new OptionsMultiFileMode(file);

        //try removing fileUnderTest completely before delta-debugging
        fs.copySync(fileUnderTest, backupFile);      	
        fs.removeSync(fileUnderTest);

        //if that fails, then restore the fileUnderTest and try to reduce it
        if (!predicate.test(mainFileTmpDir)) {
            fs.copySync(backupFile, fileUnderTest);      	
            if (isJsOrJsonFile(fileUnderTest)) {
                console.log("Reducing " + path.relative(tmpDir, fileUnderTest));
                deltalib.main(options);
            }
        }
    }
}

function deltaDebugMain () {
    options = new OptionsMultiFileMode(mainFileTmpDir);
    fileUnderTest = mainFileTmpDir;
    deltalib.main(options);
}

function OptionsMultiFileMode (file) {
    this.quick = options.quick,
    this.findFixpoint = options.findFixpoint,
    this.file = file,
    //Predicate wrapper
    this.predicate = {
        test: function (deltaReducedFile) {
            fs.copySync(fileUnderTest, backupFile);
            fs.copySync(deltaReducedFile, fileUnderTest);
            mainFileTmpDir = path.resolve(tmpDir, options.file);
            var res = predicate.test(mainFileTmpDir);

            //Restore backed-up file if new version fails the predicate
            if (!res) {
                fs.copySync(backupFile, fileUnderTest);
            }
            return res;
        }
    },
    this.predicate_args = options.predicate_args, 
    this.record = options.record,
    this.multifile_mode = true
}

function isJsOrJsonFile(file) {
    var fileNoCaps = file.toLowerCase();
    return fileNoCaps.endsWith(".js") || fileNoCaps.endsWith(".json");
}

function synthesizePredicate () {
    predicate = options.predicate;
    var cmd = options.cmd;
    var replay = options.replay;
    var errmsg = options.errmsg;
    var msg = options.msg;
    var replay_idx = options.replay_idx;

    if (typeof predicate.init === 'function')
        predicate.init(predicate_args);

    // if no predicate module was specified, synthesise one from the other options
    if (!predicate.test) {
        predicate.cmd = predicate.cmd || cmd;

        if (replay) {
            predicate.test = function (fn) {
                var stats = fs.statSync(fn);
                console.log("Testing candidate " + fn +
                        " (" + stats.size + " bytes)");
                var res = replay[replay_idx++] === 'true';
                if (res)
                    console.log("    aborted with relevant error (recorded)");
                else
                    console.log("    completed successfully (recorded)");
                return res;
            };
        } else {
            if (!predicate.cmd) {
                console.error("No test command specified.");
                process.exit(-1);
            }

            if (typeof predicate.checkResult !== 'function') {
                if (errmsg || msg) {
                    predicate.checkResult = function (error, stdout, stderr) {
                        if ((errmsg && stderr && stderr.indexOf(errmsg) !== -1) ||
                                (msg && ((stderr && stderr.indexOf(msg) !== -1) ||
                                         (stdout && stdout.indexOf(msg) !== -1)))) {
                            console.log("    aborted with relevant error");
                            return true;
                        } else if (error) {
                            console.log("    aborted with other error");
                            return false;
                        } else {
                            console.log("    completed successfully");
                            return false;
                        }
                    };
                } else {
                    predicate.checkResult = function (error, stdout, stderr) {
                        if (error) {
                            console.log("    aborted with error");
                            return true;
                        } else {
                            console.log("    completed successfully");
                            return false;
                        }
                    };
                }
            }

            predicate.test = function (fn) {
                var stats = fs.statSync(fn);
                console.log("Testing candidate " + fn +
                        " (" + stats.size + " bytes)");
                var start = new Date();
                var stdout_file = fn + ".stdout",
                stderr_file = fn + ".stderr";
                var error = deltalib.execSync(predicate.cmd + " '" + fn + "'" +
                        " >'" + stdout_file + "'" +
                        " 2>'" + stderr_file + "'");
                var end = new Date();
                var stdout = fs.readFileSync(stdout_file, "utf-8"),
                stderr = fs.readFileSync(stderr_file, "utf-8");
                return predicate.checkResult(error, stdout, stderr, end - start);
            };
        }
    }
}

function checkMultiFileModeOptions() {
    var dir = options.dir;
    var file = options.file;
    if (!path.isAbsolute(dir)) {
        dir = path.resolve(__dirname, dir);
    }
    var mainFileFullPath = path.resolve(dir, file);
    try {
        fs.accessSync(mainFileFullPath, fs.F_OK); 
    }
    catch (err) {
        logAndExit("Could not find main file " + mainFileFullPath);
    }
}

function logAndExit(msg) {
    console.error(msg);
    process.exit(-1);
    //process.exit() does not guarentee immediate termination
    //so an infinite loop is inserted to avoid continuing the uninteded execution.
    while(true) {}
}

function readDirSorted(directory) {
    files = [];
    fs.readdirSync(directory).forEach(function (child) {
        files.push(path.resolve(directory, child));
    });
    return files.sort();
}

function computeSha(directory) {
    var subFiles = listFilesRecursively(directory);
    const shaOptions = {files : subFiles, 
        algorithm : "sha1", 
        noGlob : true};
    return hashFiles.sync(shaOptions);
}

function listFilesRecursively(file) {
    var subFiles = [];
    fs.readdirSync(file).forEach(function (child) {
        var childFull = path.resolve(file, child);
        if (fs.statSync(childFull).isDirectory()) {
            subFiles = subFiles.concat(listFilesRecursively(childFull));
        } else {
            subFiles.push(childFull);
        }
    });
    return subFiles;
}
