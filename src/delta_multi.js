const path = require("path"),
    fs = require("fs-extra"),
    config = require("../config"),
    delta_single = require("./delta_single"),
    hashFiles = require("hash-files"),
    logging = require("./logging"),
    tmp = require("tmp"),
    file_util = require("./file_util");


/**
 * Delta debugger for multiple files, with AST-minimization for individual JavaScript files.
 *
 * Repeatedly deletes files and directories and applies a predicate to the resulting directory structure.
 * Stops when a (locally) minimal directory structure that satisfies the predicate has been found.
 */
function main(options) {
    logging.log("Running in multifile mode");


    checkMultiFileModeOptions(options);

    // setup
    var state = {
        mainFileTmpDir: undefined,
        fileUnderTest: undefined,
        tmpDir: undefined,
        backupDir: undefined,
        backupFile: undefined
    };

    state.tmpDir = tmp.dirSync({template : config.tmp_dir + "/jsdelta-multifile-XXXXXX"}).name;
    fs.copySync(options.dir, state.tmpDir);
    state.mainFileTmpDir = path.resolve(state.tmpDir, options.file);

    var tmpBackupDir = tmp.dirSync({template : config.tmp_dir + "/backup-XXXXXX"}).name;
    state.backupDir = path.resolve(tmpBackupDir, "backupDir");
    state.backupFile = path.resolve(tmpBackupDir, "backup");


    //Repeat delta debugging until no changes are registered
    var count = 1;
    var newSha = computeSha(state.tmpDir);
    var prevSha = "";
    do {
        logging.log("Multifile fixpoint iteration: #" + count);
        deltaDebugFiles(state.tmpDir);
        prevSha = newSha;
        newSha = computeSha(state.tmpDir);
        count++;
    } while (options.findFixpoint && newSha !== prevSha);

    if (options.out !== null) {
        var copyPath = file_util.copyToDir(state.tmpDir, options.out);
        if (copyPath !== undefined) {
            logging.logDone(copyPath);
        } else {
            logging.error("unable to copy result to " + options.out);
            logging.logDone(state.tmpDir);
        }
    } else {
        logging.logDone(state.tmpDir);
    }

    function makeOptionsForSingleFileMode(file) {
        var singleOptions = {};
        for (var p in options) {
            if (options.hasOwnProperty(p)) {
                singleOptions[p] = options[p];
            }
        }
        singleOptions.file = file;
        singleOptions.multifile_mode = true;
        //Predicate wrapper
        singleOptions.predicate = {
            test: function (deltaReducedFile) {
                fs.copySync(state.fileUnderTest, state.backupFile);
                fs.copySync(deltaReducedFile, state.fileUnderTest);
                state.mainFileTmpDir = path.resolve(state.tmpDir, options.file);
                var res = options.predicate.test(state.mainFileTmpDir);

                //Restore backed-up file if new version fails the predicate
                if (!res) {
                    fs.copySync(state.backupFile, state.fileUnderTest);
                }
                return res;
            }
        };
        return singleOptions;
    }

    function checkMultiFileModeOptions() {
        var dir = options.dir;
        var file = options.file;
        if (!path.isAbsolute(dir)) {
            dir = path.resolve(process.cwd(), dir);
        }
        var mainFileFullPath = path.resolve(dir, file);
        try {
            fs.accessSync(mainFileFullPath, fs.F_OK);
        }
        catch (err) {
            logAndExit("Could not find main file " + mainFileFullPath);
        }
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
        const shaOptions = {
            files: subFiles,
            algorithm: "sha1",
            noGlob: true
        };
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

    /**
     * Recursively pass through the file-hierarchy and invoke delta_single.main on all files
     */
    function deltaDebugFiles(file) {
        logging.increaseIndentation();
        logging.logTargetChange(file, state.tmpDir);
        //main file should be the last file to be reduced
        if (file === state.mainFileTmpDir) {
            logging.decreaseIndentation();
            return;
        }
        state.fileUnderTest = file;

        if (fs.statSync(file).isDirectory()) {
            readDirSorted(file).forEach(function (child) {
                if (fs.statSync(child).isDirectory()) {
                    //Try removing directory completely before delta-debugging
                    fs.copySync(child, state.backupDir);
                    fs.removeSync(child);
                    if (!options.predicate.test(state.mainFileTmpDir)) {
                        fs.copySync(state.backupDir, child);
                        deltaDebugFiles(child);
                    }
                } else {
                    deltaDebugFiles(child);
                }
            });
        } else {
            //try removing fileUnderTest completely before delta-debugging
            fs.copySync(state.fileUnderTest, state.backupFile);
            fs.removeSync(state.fileUnderTest);

            //if that fails, then restore the fileUnderTest and try to reduce it
            if (!options.predicate.test(state.mainFileTmpDir)) {
                fs.copySync(state.backupFile, state.fileUnderTest);
                if (isJsOrJsonFile(state.fileUnderTest)) {
                    delta_single.reduce(makeOptionsForSingleFileMode(file));
                }
            }
        }
        logging.decreaseIndentation();
    }

    function isJsOrJsonFile(file) {
        var fileNoCaps = file.toLowerCase();
        return fileNoCaps.endsWith(".js") || fileNoCaps.endsWith(".json");
    }

    function logAndExit(msg) {
        logging.error(msg);
        process.exit(-1);
        //process.exit() does not guarentee immediate termination
        //so an infinite loop is inserted to avoid continuing the uninteded execution.
        while (true) {
        }
    }
}
module.exports.reduce = main;