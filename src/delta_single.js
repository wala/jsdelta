var fs = require("fs-extra"),
    util = require("util"),
    esprima = require("espree"),
    escodegen = require("escodegen"),
    estraverse = require("estraverse"),
    tmp = require("tmp"),
    file_util = require("./file_util"),
    transformations = require("./transformations"),
    logging = require("./logging");
/**
 * The "Original" JSDelta AST-mininizer.
 *
 * Repeatedly eliminates parts of an AST and applies a predicate to the resulting source code.
 * Stops when a (locally) minimal source that satisfies the predicate has been found.
 *
 * @return boolean true if at least one reduction was performed successfully.
 */
function main(options) {

    function invalidInput() {
        if (!options.multifile_mode) {
            process.exit(1);
        }
        return false;
    }

    var DEBUG = false;

    function log_debug(msg) {
        if (DEBUG)
            logging.log(msg);
    }

    var state = {
        // keep track of the number of attempts so far
        round: 0,
        ast: undefined,
        testSucceededAtLeastOnce: false,
        tmp_dir: undefined,
        ext: undefined
    };

    var input;
    try {
        input = fs.readFileSync(options.file, 'utf-8');
    } catch (e) {
        logging.error("Could not read original file: %s", e);
        return invalidInput();
    }

    // figure out file extension; default is 'js'
    state.ext = (options.file.match(/\.(\w+)$/) || [, 'js'])[1];

    function isSyntacticallyValid(input) {
        try {
            if (state.ext === 'json') {
                JSON.parse(input);
            } else {
                file_util.parse(input);
            }
        } catch (e) {
            return false;
        }
        return true;
    }

    if (state.ext === 'json') {
        // hack to always generate valid JSON: e.g. empty program is not valid JSON, but it is valid JavaScript!
        var origPredicate = options.predicate.test;
        options.predicate.test = function (fn) {
            var input = fs.readFileSync(fn, 'utf-8');
            if (!isSyntacticallyValid(input)) {
                return false;
            }
            return origPredicate(fn);
        };
    }
    state.tmp_dir = file_util.makeTempDir();

    // the smallest test case so far is kept here
    var smallest = state.tmp_dir + "/delta_js_smallest." + state.ext;


    // save a copy of the original input
    var orig = file_util.getTempFileName(state);

    fs.writeFileSync(orig, input);
    fs.writeFileSync(smallest, input);

    if (!isSyntacticallyValid(input)) {
        logging.error("Original file is not syntactically valid.");
        return invalidInput();
    }

    // get started
    var res = options.predicate.test(orig);
    if (!res) {
        logging.error("Original file doesn't satisfy predicate.");
        return invalidInput();
    }

    if (options.record)
        fs.appendFileSync(options.record, !!res + "\n");

    var done = false;
    var iterations = 0;
    var performedAtLeastOneReduction = false;
    while (!done) {
        logging.log("Starting iteration #%d", iterations);
        state.testSucceededAtLeastOnce = false;
        iterations++;
        done = true;

        rebuildAST();
        minimise(state.ast, null, -1);

        state.testSucceededAtLeastOnce |= transformations.applyTransformers(options, state, smallest);

        if (options.findFixpoint && state.testSucceededAtLeastOnce) {
            done = false;
        }
        performedAtLeastOneReduction |= state.testSucceededAtLeastOnce;
    }
    if (!options.multifile_mode) {
        if (options.out !== null) {
            var copyPath = file_util.copyToDir(smallest, options.out);
            if (copyPath !== undefined) {
                logging.logDone(copyPath);
            } else {
                logging.error("unable to copy result to " + options.out);
                logging.logDone(smallest);
            }
        } else {
            logging.logDone(smallest);
        }
    }
    return performedAtLeastOneReduction;

    function minimise_array(array, nonempty) {
        log_debug("minimising array " + util.inspect(array, false, 1));
        if (!nonempty && array.length === 1) {
            // special case: if there is only one element, try removing it
            var elt = array[0];
            array.length = 0;
            if (!test())
            // didn't work, need to put it back
                array[0] = elt;
        } else {
            // try removing as many chunks of size sz from array as possible
            // once we're done, switch to size sz/2; if size drops to zero,
            // recursively invoke minimise on the individual elements
            // of the array
            for (var sz = array.length >>> 1; sz > 0; sz >>>= 1) {
                log_debug("  chunk size " + sz);
                var nchunks = Math.floor(array.length / sz);
                for (var i = nchunks - 1; i >= 0; --i) {
                    // try removing chunk i
                    log_debug("    chunk #" + i);
                    var lo = i * sz,
                        hi = i === nchunks - 1 ? array.length : (i + 1) * sz;

                    // avoid creating empty array if nonempty is set
                    if (!nonempty || lo > 0 || hi < array.length) {
                        var removed = array.splice(lo, hi - lo);
                        if (!test()) {
                            // didn't work, need to put it back
                            Array.prototype.splice.apply(array,
                                [lo, 0].concat(removed));
                        }
                    }
                }
            }
        }

        // now minimise each element in turn
        for (var j = 0; j < array.length; ++j)
            minimise(array[j], array, j);
    }

// the main minimisation function
    function minimise(nd, parent, idx) {
        if (typeof parent === 'string') {
            idx = parent;
            parent = nd;
            nd = parent[idx];
        }

        if (!nd || typeof nd !== 'object')
            return;

        log_debug("minimising " + util.inspect(nd));
        switch (nd.type) {
            case 'Program':
                minimise_array(nd.body);
                break;
            case 'BlockStatement':
                // knock out as many statements in the block as possible
                // if we end up with a single statement, replace the block with
                // that statement
                minimise_array(nd.body);
                if (!options.quick && nd.body.length === 1) {
                    if (parent.type !== 'TryStatement' && parent.type !== 'CatchClause') {
                        // skip block containers that have mandatory blocks
                        Replace(parent, idx).With(nd.body[0]);
                    }
                }
                break;
            case 'FunctionDeclaration':
            case 'FunctionExpression':
                if (!options.quick) {
                    if (nd.type === 'FunctionExpression') {
                        if (Replace(parent, idx).With({type: "ObjectExpression", "properties": []})){
                            break;
                        }
                        Replace(nd, 'name').With(null);
                    }
                    minimise_array(nd.params);
                }
                minimise_array(nd.body.body);
                break;
            case 'ObjectExpression':
                minimise_array(nd.properties);
                break;
            case 'VariableDeclaration':
                minimise_array(nd.declarations, true);
                break;
            default:
                // match other node types only if we're not doing options.quick minimisation
                // if options.quick is set, !options.quick && ndtp will be undefined, so the
                // default branch is taken
                switch (!options.quick && nd.type) {
                    case 'Literal':
                        return;
                    case 'UnaryExpression':
                    case 'UpdateExpression':
                        // try replacing with operand
                        if (Replace(parent, idx).With(nd.argument))
                            minimise(parent, idx);
                        else
                            minimise(nd, 'argument');
                        break;
                    case 'AssignmentExpression':
                    case 'BinaryExpression':
                    case 'LogicalExpression':
                        if (Replace(parent, idx).With(nd.left))
                            minimise(parent, idx);
                        else if (Replace(parent, idx).With(nd.right))
                            minimise(parent, idx);
                        else {
                            minimise(nd, 'left');
                            minimise(nd, 'right');
                        }
                        break;
                    case 'ReturnStatement':
                        if (nd.argument && !Replace(nd, 'argument').With(null))
                            minimise(nd, 'argument');
                        break;
                    case 'NewExpression':
                        Replace(parent, idx).With({type: "CallExpression", callee: nd.callee, arguments: nd.arguments});
                        // fallthrough
                    case 'CallExpression':
                        minimise(nd, 'callee');
                        minimise_array(nd['arguments']);
                        break;
                    case 'ArrayExpression':
                        if (Replace(parent, idx).With({type: "ObjectExpression", "properties": []})){
                            break;
                        }
                        minimise_array(nd.elements);
                        break;
                    case 'IfStatement':
                    case 'ConditionalExpression':
                        if (Replace(parent, idx).With(nd.consequent))
                            minimise(parent, idx);
                        else if (nd.alternate && Replace(parent, idx).With(nd.alternate))
                            minimise(parent, idx);
                        else if (Replace(parent, idx).With(nd.test))
                            minimise(parent, idx);
                        else {
                            minimise(nd, 'test');
                            minimise(nd, 'consequent');
                            minimise(nd, 'alternate');
                        }
                        break;
                    case 'SwitchStatement':
                        minimise(nd, 'discriminant');
                        minimise_array(nd.cases);
                        break;
                    case 'WhileStatement':
                        if (Replace(parent, idx).With(nd.body))
                            minimise(parent, idx);
                        else if (Replace(parent, idx).With(nd.test))
                            minimise(parent, idx);
                        else {
                            minimise(nd, 'test');
                            minimise(nd, 'body');
                        }
                        break;
                    case 'ForStatement':
                        Replace(nd, 'test').With(null);
                        Replace(nd, 'update').With(null);
                        if (Replace(parent, idx).With(nd.body))
                            minimise(parent, idx);
                        else if (nd.test && Replace(parent, idx).With(nd.test))
                            minimise(parent, idx);
                        else {
                            minimise(nd, 'init');
                            minimise(nd, 'test');
                            minimise(nd, 'update');
                            minimise(nd, 'body');
                        }
                        break;
                    default:
                        if (Array.isArray(nd)) {
                            minimise_array(nd);
                        } else {
                            estraverse.VisitorKeys[nd.type].forEach(function (ch) {
                                if (!options.quick || ch !== 'arguments') {
                                    minimise(nd, ch);
                                }
                            });
                        }
                }
        }
    }

    function Replace(nd, idx) {
        var oldval = nd[idx];
        return {
            With: function (newval) {
                if (oldval === newval) {
                    return true;
                } else if ((oldval === undefined || oldval === null) && (newval === undefined || newval === null)) {
                    // avoids no-op transformation that makes us fail to reach a fix-point due to `testSucceededAtLeastOnce` changing without an actual source-change
                    return true;
                } else {
                    nd[idx] = newval;
                    if (test()) {
                        return true;
                    } else {
                        nd[idx] = oldval;
                        return false;
                    }
                }
            }
        };
    }

    function rebuildAST() {
        var input = fs.readFileSync(smallest);
        // hack to make JSON work
        if (state.ext === 'json')
            input = '(' + input + ')';
        state.ast = file_util.parse(input);
    }

    function test() {
        var fn = file_util.writeTempFile(state);
        logging.logTargetChange(fn);
        var res = options.predicate.test(fn);
        if (options.record)
            fs.appendFileSync(options.record, !!res + "\n");
        if (res) {
            state.testSucceededAtLeastOnce = true;
            // if the test succeeded, save it to file 'smallest'
            file_util.persistAST(smallest, state);
            return true;
        } else {
            return false;
        }
    }

}
module.exports.reduce = main;
