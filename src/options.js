const transformations = require("./transformations"),
    logging = require("./logging"),
    path = require("path"),
    fs = require("fs");

function buildOptionsObject() {
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
        /** output directory of the minimized program */
        out : null,
        replay_idx: -1
    };

    var argparse = require('argparse');
    var parser = new argparse.ArgumentParser({
        addHelp: true,
        description: "Command-line interface to JSDelta"
    });
    parser.addArgument(['--quick', '-q'], {help: "disable reductions of individual expressions.", action: 'storeTrue'});
    parser.addArgument(['--no-fixpoint'], {
        help: "disable fixpoint algorithm (faster, but sub-optimal)",
        action: 'storeTrue'
    });
    parser.addArgument(['--optimize'], {
        help: "enable inlining and constant folding (slower, but more optimal)",
        action: 'storeTrue'
    });
    parser.addArgument(['--cmd'], {help: "command to execute on each iteration"});
    parser.addArgument(['--record'], {help: "file to store recording in"});
    parser.addArgument(['--replay'], {help: "file to replay recording from"});
    parser.addArgument(['--errmsg'], {help: "substring in stderr to look for"});
    parser.addArgument(['--msg'], {help: "substring in stdout to look for"});
    parser.addArgument(['--dir'], {help: "directory to reduce (should contain the main file!)"});
    parser.addArgument(['--out'], {help: "directory to move the minimized output to"});
    parser.addArgument(['main-file_and_predicate_and_predicate-args'], {
        help: "main file to reduce, followed by arguments to the predicate",
        nargs: argparse.Const.REMAINDER
    });
    var args = parser.parseArgs();

    var tail = args['main-file_and_predicate_and_predicate-args'];
    var file = tail[0];
    if (!file) {
        parser.printHelp();
        process.exit(-1);
        return;
    }
    var predicate = tail[1];
    var predicateArgs = tail.slice(2);

    options.quick = args.quick;
    options.optimize = args.quick;
    options.findFixpoint = !options['no-fixpoint'];
    options.cmd = args.cmd || options.cmd;
    options.errmsg = args.errmsg || options.errmsg;
    options.msg = args.msg || options.msg;
    if (args.record) {
        options.record = args.record;
        if (fs.existsSync(options.record))
            fs.unlinkSync(options.record);
    }
    if (args.replay) {
        options.replay = fs.readFileSync(args.replay, 'utf-8').split('\n');
        options.replay_idx = 0;
    }
    if (args.dir) {
        options.multifile_mode = true;
        options.dir = args.dir;
    }
    if (args.out) {
        //var hasExtension = path.extname(args.out) !== '';
        //if (hasExtension && options.multifile_mode) {
        //    logging.error("the out path must be a folder in multi file mode");
        //    process.exit(-1);
        //    return;
        //}
        //if (!hasExtension && !options.multifile_mode)  {
        //    logging.error("the out path must be a file in single file mode");
        //    process.exit(-1);
        //    return;
        //}
        options.out = args.out;
    }

    options.file = file;
    if (predicate) {
        options.predicate = require(predicate);
    }
    options.predicate_args = predicateArgs;


    if (options.optimize) {
        options.transformations = transformations.getOptimizations();
    }

    synthesizePredicate(options);
    var origPredicate = options.predicate.test;
    options.predicate.test = function (fn) {
        // wrap to add indentation argument
        return origPredicate(fn, logging.getIndentation());
    };

    return options;
}


function execSync(cmd) {
    try {
        require('child_process').execSync(cmd);
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

module.exports.parseOptions = function () {
    return buildOptionsObject();
};
