const transformations = require("./transformations"),
    logging = require("./logging");

/**
 * Crude option parsing (should be replaced by proper library)
 */
function buildOptionsObject(argv) {
    var options = {
        /** only knock out entire statements */
        quick: false,
        /** Repeat until a fixpoint is found */
        findFixpoint: true,
        /** command to invoke to determine success/failure */
        cmd: null,
        /** error message indicating failure of command */
        errmsg: null,
        /** message indicating failure of command, either on stdout or stderr */
        msg: null,
        /** file to minimise */
        file: null,
        /** predicate to use for minimisation */
        predicate: {},
        /** arguments to pass to the predicate */
        predicate_args: [],
        /** file to record predicate results to */
        record: null,
        /** array to read predicate results from */
        replay: null,
        /** apply closure-compiler optimizations */
        optimize: false,
        /** additional transformations to apply to source the code */
        transformations: [],
        /** reduce multiple files */
        multifile_mode: false,
        /** directory to minimize when multifile_mode is enabled*/
        dir: null,
        replay_idx: -1
    };

    // command line option parsing; manual for now
    // TODO: find good npm package to use
    var i = 0;
    for (; i < argv.length; ++i) {
        var arg = argv[i];
        if (arg === '--quick' || arg === '-q') {
            options.quick = true;
        } else if (arg === '--no-fixpoint') {
            options.findFixpoint = false;
        } else if (arg === '--cmd') {
            if (options.cmd === null)
                options.cmd = String(argv[++i]);
            else
                logging.warn("More than one command specified; ignoring.");
        } else if (arg === '--timeout') {
            logging.warn("Timeout ignored.");
        } else if (arg === '--errmsg') {
            if (options.errmsg === null)
                options.errmsg = String(argv[++i]);
            else
                logging.warn("More than one error message specified; ignoring.");
        } else if (arg === '--msg') {
            if (options.msg === null) {
                options.msg = String(argv[++i]);
            } else {
                logging.warn("More than one message specified; ignoring.");
            }
        } else if (arg === '--record') {
            options.record = argv[++i];
            if (fs.existsSync(options.record))
                fs.unlinkSync(options.record);
        } else if (arg === '--replay') {
            if (options.cmd) {
                logging.warn("--replay after --cmd ignored");
            } else {
                options.replay = fs.readFileSync(argv[++i], 'utf-8').split('\n');
                replay_idx = 0;
            }
        } else if (arg === "--optimize") {
            options.optimize = true;
        } else if (arg === '--dir') {
            options.multifile_mode = true;
            options.dir = argv[++i];
        } else if (arg === '--') {
            options.file = argv[i + 1];
            i += 2;
            break;
        } else if (arg[0] === '-') {
            usage();
        } else {
            options.file = argv[i++];
            break;
        }
    }

    // check whether a predicate module was specified
    if (i < argv.length) {
        options.predicate = require(argv[i++]);
    }

    // the remaining arguments will be passed to the predicate
    options.predicate_args = argv.slice(i);


    if (options.optimize) {
        options.transformations = transformations.getOptimizations();
    }

    synthesizePredicate(options);
    var origPredicate = options.predicate.test;
    options.predicate.test = function (fn) {
        return origPredicate(fn, logging.getIndentation());
    };

    // check that we have something to minimise
    if (!options.file)
        usage();

    return options;
}


function execSync(cmd) {
    try {
        require('cp').execSync(cmd);
        return false;
    } catch (e) {
        return true;
    }
}

function synthesizePredicate(options) {
    var predicate = options.predicate;
    var errmsg = options.errmsg;
    var msg = options.msg;
    var replay_idx = options.replay_idx;

    if (typeof predicate.init === 'function')
        predicate.init(predicate_args);

    // if no predicate module was specified, synthesise one from the other options
    if (!predicate.test) {
        predicate.cmd = predicate.cmd || options.cmd;


        if (options.replay) {
            predicate.test = function (fn) {
                var stats = fs.statSync(fn);
                logging.log("Testing candidate " + fn +
                    " (" + stats.size + " bytes)");
                var res = options.replay[replay_idx++] === 'true';
                if (res)
                    logging.log("    aborted with relevant error (recorded)");
                else
                    logging.log("    completed successfully (recorded)");
                return res;
            };
        } else {
            if (!predicate.cmd) {
                logging.error("No test command specified.");
                process.exit(-1);
            }

            if (typeof predicate.checkResult !== 'function') {
                if (errmsg || msg) {
                    predicate.checkResult = function (error, stdout, stderr) {
                        if ((errmsg && stderr && stderr.indexOf(errmsg) !== -1) ||
                            (msg && ((stderr && stderr.indexOf(msg) !== -1) ||
                            (stdout && stdout.indexOf(msg) !== -1)))) {
                            logging.log("    aborted with relevant error");
                            return true;
                        } else if (error) {
                            logging.log("    aborted with other error");
                            return false;
                        } else {
                            logging.log("    completed successfully");
                            return false;
                        }
                    };
                } else {
                    predicate.checkResult = function (error) {
                        if (error) {
                            logging.log("    aborted with error");
                            return true;
                        } else {
                            logging.log("    completed successfully");
                            return false;
                        }
                    };
                }
            }

            predicate.test = function (fn) {
                var stats = fs.statSync(fn);
                logging.log("Testing candidate " + fn +
                    " (" + stats.size + " bytes)");
                var start = new Date();
                var stdout_file = fn + ".stdout",
                    stderr_file = fn + ".stderr";
                var error = execSync(predicate.cmd + " '" + fn + "'" +
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

function usage() {
    logging.error("Usage: " + process.argv[0] + " " + process.argv[1] +
        " [-q|--quick] [--no-fixpoint] [--cmd COMMAND]" +
        " [--record FILE | --replay FILE]" +
        " [--errmsg ERRMSG] [--msg MSG] [--dir DIR] [--optimize] FILE [PREDICATE] OPTIONS...");
    //process.exit(-1);
}
module.exports.parseOptions = function (options) {
    try {
        return buildOptionsObject(options);
    } catch (e) {
        usage();
        throw e;
    }
};
