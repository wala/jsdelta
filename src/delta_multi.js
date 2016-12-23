const path = require("path"),
    fs = require("fs-extra"),
    delta_single = require("./delta_single"),
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


    checkMultiFileModeOptions();

    // setup
    var state = {
        mainFileTmpDir: undefined,
        fileUnderTest: undefined,
        tmpDir: undefined,
        backupDir: undefined
    };

    var tmpRoot = file_util.makeTempDir();
    state.tmpDir = tmpRoot + "/temp";
    fs.copySync(options.dir, state.tmpDir);
    state.backupDir = tmpRoot + "/backup";
    fs.mkdirSync(state.backupDir);

    state.mainFileTmpDir = path.resolve(state.tmpDir, options.file);

    //Repeat delta debugging until no changes are registered
    var count = 1;
    var performedAtLeastOneReduction = false;
    do {
        logging.log("Multifile fixpoint iteration: #" + count);
        performedAtLeastOneReduction = deltaDebugFiles(state.tmpDir);
        count++;
    } while (options.findFixpoint && performedAtLeastOneReduction);

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
                var backup = makeBackupFileName();
                fs.renameSync(state.fileUnderTest, backup);
                fs.copySync(deltaReducedFile, state.fileUnderTest);
                state.mainFileTmpDir = path.resolve(state.tmpDir, options.file);
                var res = options.predicate.test(state.mainFileTmpDir);

                //Restore backed-up file if new version fails the predicate
                if (!res) {
                    fs.renameSync(backup, state.fileUnderTest);
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
        var files = [];
        fs.readdirSync(directory).forEach(function (child) {
            files.push(path.resolve(directory, child));
        });
        return files.sort();
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
     *
     * @return boolean true if at least one reduction was performed successfully.
     */
    function deltaDebugFiles(file) {
        try {
            logging.increaseIndentation();
            state.fileUnderTest = file;
            logging.logTargetChange(file, state.tmpDir);

            // try removing fileUnderTest completely
            var backup = makeBackupFileName();
            fs.renameSync(file, backup);
            if (options.predicate.test(state.mainFileTmpDir)) {
                return true;
            } else {
                // if that fails, then restore the fileUnderTest
                fs.renameSync(backup, file);
                if (fs.statSync(file).isDirectory()) {
                    var performedAtLeastOneReduction = false;
                    readDirSorted(file).forEach(function (child) {
                        // recurse on all files in the directory
                        performedAtLeastOneReduction |= deltaDebugFiles(child);
                    });
                    return performedAtLeastOneReduction;
                } else {
                    // specialized reductions
                    if (isJsOrJsonFile(file)) {
                        return delta_single.reduce(makeOptionsForSingleFileMode(file));
                    }
                    return false;
                }
            }
        } finally {
            logging.decreaseIndentation();
        }
    }

    function isJsOrJsonFile(file) {
        var fileNoCaps = file.toLowerCase();
        return fileNoCaps.endsWith(".js") || fileNoCaps.endsWith(".json");
    }

    function makeBackupFileName() {
        return tmp.tmpNameSync({dir: state.backupDir});
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