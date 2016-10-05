const esprima = require("esprima"),
    fs = require("fs-extra"),
    cp = require("child_process"),
    util = require("util"),
    closure_compiler = require('google-closure-compiler'),
    file_util = require("./file_util"),
    logging = require("./logging");


function makeClosureCompilerTransformation(compilation_level) {
    return function (orig, transformed) {
        cp.execSync(util.format("java -jar %s --jscomp_off '*' --formatting PRETTY_PRINT --compilation_level %s --js %s --js_output_file %s", closure_compiler.compiler.JAR_PATH, compilation_level, orig, transformed));
    }
}


/**
 * Similar to test(), but a custom transformer is applied to the source first.
 *
 * Returns true iff the transformation made the predicate true.
 */
function transformAndTest(transformation, options, state, file) {
    var orig = file_util.writeTempFile(state);
    var testSucceeded = false;

    function getFileCodeSize(sourceFile) {
        // The only reliable way of comparing transformed code sizes is to pretty print them in the same way
        return file_util.pp({ext: "js", ast: esprima.parse(fs.readFileSync(sourceFile))}).length;
    }

    try {
        logging.log("Transforming candidate %s", orig);
        var transformed = file_util.getTempFileName(state);
        try {
            transformation(orig, transformed);
            fs.writeFileSync(transformed, fs.readFileSync(transformed, 'utf-8').trim() + "\n");

            // ensure termination of transformation fixpoint
            var reducedSize = getFileCodeSize(transformed) < getFileCodeSize(orig);
            var res = reducedSize && options.predicate.test(transformed);
            if (res) {
                testSucceeded = true;
                // if the test succeeded, save it
                copy(transformed, file);
            }
        } catch (e) {
            // ignore failures - assume they were a no-op
            return;
        }
    } catch (e) {
        logging.error(e);
    }
    return testSucceeded;
}

/**
 * Applies all the custom transformers.
 *
 * Returns true iff any of the transformations made the predicate true.
 */
function applyTransformers(options, state, file) {
    var transformationSucceededAtLeastOnce = false;
    if (options.transformations && state.ext == "js") {
        options.transformations.forEach(function (transformation) {
            transformationSucceededAtLeastOnce |= transformAndTest(transformation, options, state, file);
        });
    }
    return transformationSucceededAtLeastOnce;
}

function copy(from, to) {
    fs.copySync(from, to);
}

function getOptimizations() {
    return [
        makeClosureCompilerTransformation("ADVANCED_OPTIMIZATIONS"),
        makeClosureCompilerTransformation("SIMPLE_OPTIMIZATIONS")
    ];
}
module.exports.getOptimizations = getOptimizations;
module.exports.applyTransformers = applyTransformers;