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

var fs = require("fs"),
    jsp = require("uglify-js").parser,
    pro = require("uglify-js").uglify,
    util = require("util"),
    config = require(__dirname + "/config.js"),
    combinators = require(__dirname + "/combinators.js"),
    exec = require("child_process").exec,
    If = combinators.If,
    Foreach = combinators.Foreach;

function usage() {
    console.error("Usage: " + process.argv[0] + " " + process.argv[1] +
		  " [-q|--quick] [--cmd COMMAND] [--timeout TIMEOUT]" +
		  " [--errmsg ERRMSG] FILE [PREDICATE] OPTIONS...");
    process.exit(-1);
}

function log_debug(msg) {
    // console.log(msg);
}

// check whether the given file exists
// TODO: this is a bit rough; surely someone has written a module to do this?
function exists(f) {
    try {
	fs.statSync(f);
	return true;
    } catch(e) {
	return false;
    }
}

var /** only knock out entire statements */
    quick = false,

    /** command to invoke to determine success/failure */
    cmd = null,

    /** error message indicating failure of command */
    errmsg = null,

    /** time budget to allow for the command to run */
    timeout = null,

    /** file to minimise */
    file = null,

    /** predicate to use for minimisation */
    predicate = {},

    /** arguments to pass to the predicate */
    predicate_args = [];

// command line option parsing; manual for now
// TODO: find good npm package to use
for(var i=2;i<process.argv.length;++i) {
    var arg = process.argv[i];
    if(arg === '--quick' || arg === '-q') {
	quick = true;
    } else if(arg === '--cmd') {
	if(cmd === null)
	    cmd = String(process.argv[++i]);
	else
	    console.warn("More than one command specified; ignoring.");
    } else if(arg === '--timeout') {
	if(timeout === null)
	    timeout = Number(process.argv[++i]);
	else
	    console.warn("More than one timeout specified; ignoring.");
    } else if(arg === '--errmsg') {
	if(errmsg === null)
	    errmsg = String(process.argv[++i]);
	else
	    console.warn("More than one error message specified; ignoring.");
    } else if(arg === '--') {
	file = process.argv[i+1];
	i += 2;
	break;
    } else if(arg[0] === '-') {
	usage();
    } else {
	file = process.argv[i++];
	break;
    }
}

// check that we have something to minimise
if(!file)
    usage();

// check whether a predicate module was specified
if(i < process.argv.length)
    predicate = require(process.argv[i++]);

// the remaining arguments will be passed to the predicate
predicate_args = process.argv.slice(i);

// initialise predicate module
if(typeof predicate.init === 'function')
    predicate.init(predicate_args);

// if no predicate module was specified, synthesise one from the other options
if(!predicate.test) {
    predicate.cmd = predicate.cmd || cmd;
    if(!predicate.cmd) {
	console.error("No test command specified.");
	process.exit(-1);
    }

    if(typeof predicate.checkResult !== 'function') {
	if(errmsg) {
	    predicate.checkResult = function(error, stdout, stderr, time) {
		if(stderr && stderr.indexOf(errmsg) !== -1) {
		    console.log("    aborted with relevant error");
		    return true;
		} else if(error) {
		    console.log("    aborted with other error");
		    return false;
		} else {
		    console.log("    completed successfully");
		    return false;
		}
	    };
	} else if(timeout) {
	    predicate.checkResult = function(error, stdout, stderr, time) {
		if(error && error.signal === 'SIGKILL') {
		    console.log("    killed by SIGKILL");
		    return true;
		} else if(error) {
		    console.log("    aborted with other error");
		    return false;
		} else {
		    console.log("    completed successfully (" + time + "ms)");
		    return false;
		}
	    };
	} else {
	    predicate.checkResult = function(error, stdout, stderr, time) {
		if(error) {
		    console.log("    aborted with error");
		    return true;
		} else {
		    console.log("    completed successfully");
		    return false;
		}
	    };
	}
    }

    predicate.timeout = predicate.timeout || timeout;
    predicate.test = function(fn, k) {
	var stats = fs.statSync(fn);
	console.log("Testing candidate " + fn + " (" + stats.size + " bytes)");
	var start = new Date();
	var options = { maxBuffer : 4*1024*1024,
		        killSignal: 'SIGKILL' };
	if(predicate.timeout)
	    options.timeout = predicate.timeout;
	exec(predicate.cmd + " " + fn, options,
	     function(error, stdout, stderr) {
		 var end = new Date();
		 fs.writeFileSync(fn + ".stdout", stdout);
		 fs.writeFileSync(fn + ".stderr", (error ? "Error: " + error : "") + stderr);
		 k(predicate.checkResult(error, stdout, stderr, end - start));
             });
    };
}

// figure out file extension; default is 'js'
var ext = (file.match(/\.(\w+)$/) || [, 'js'])[1];

var src = fs.readFileSync(file, 'utf-8');

// hack to make JSON work
if(ext === 'json')
    src = '(' + src + ')';

// parse given file
var ast = jsp.parse(src);

// determine a suitable temporary directory
var tmp_dir;
for(i=0; exists(tmp_dir=config.tmp_dir+"/tmp"+i); ++i);
    fs.mkdirSync(tmp_dir);

// keep track of the number of attempts so far
var round = 0;

// the smallest test case so far is kept here
var smallest = tmp_dir + "/delta_js_smallest." + ext;

// get name of current test case
function getTempFileName() {
    var fn = tmp_dir + "/delta_js_" + round + "." + ext;
    ++round;
    return fn;
}

// little helper function to deal with Uglify ASTs
function typeOf(nd) {
    if(nd && typeof nd === 'object' && typeof nd[0] === 'string')
	return nd[0];
    return null;
}

// TODO: CPS makes this function horribly convoluted; can we rewrite it using combinators?
function minimise_array(array, k, nonempty, twolevel) {
    // helper function to minimise all elements of the array
    // if 'twolevel' is set, the children of the elements are minimised rather
    // than the elements themselves
    function children_loop(i, k) {
	if(!k)
	    throw new TypeError("no continuation");
	if(i >= array.length) {
	    k();
	} else {
	    if(twolevel) {
		(function grandchildren_loop(j, k) {
		     if(!k)
			 throw new TypeError("no continuation");
		     if(!array[i] || j >= array[i].length) {
			 k();
		     } else {
			 minimise(array[i][j], array[i], j,
				  function() { grandchildren_loop(j+1, k); });
		     }
		 })(0, (function() { children_loop(i+1, k); }));
	    } else {
		minimise(array[i], array, i,
			 function() { children_loop(i+1, k); });
	    }
	}
    }

    log_debug("minimising array " + util.inspect(array, false, 1));
    if(!nonempty && array.length === 1) {
	// special case: if there is only one element, try removing it
	var elt = array[0];
	array.length = 0;
	test(function(succ) {
		 if(!succ)
		     // didn't work, need to put it back
		     array[0] = elt;
		 children_loop(0, k);
	     });
    } else {
	if(!k)
	    throw new TypeError("no continuation");
	// try removing as many chunks of size sz from array as possible
	// once we're done, switch to size sz/2; if size drops to zero,
	// recursively invoke minimise on the individual elements
	// of the array
	(function outer_loop(sz, k) {
	     if(!k)
		 throw new TypeError("no continuation");
	     if(sz <= 0) {
		 k();
	     } else {
		 log_debug("  chunk size " + sz);
		 var nchunks = Math.floor(array.length/sz);
		 (function inner_loop(i, k) {
		      if(!k)
			  throw new TypeError("no continuation");
		      if(i < 0) {
			  k();
		      } else {
			  // try removing chunk i
			  log_debug("    chunk #" + i);
			  var lo = i*sz,
			  hi = i===nchunks-1 ? array.length : (i+1)*sz;
			  var chunk = array.slice(lo, hi);

			  // avoid creating empty array if nonempty is set
			  if(nonempty && lo === 0 && hi === array.length) {
			      inner_loop(i-1, k);
			  } else {
			      array.splice(lo, hi-lo);
			      test(function(succ) {
				       if(!succ) {
					   // didn't work, need to put it back
					   Array.prototype.splice.apply(array,
									[lo,0].concat(chunk));
				       }
				       inner_loop(i-1, k);
				   });
			  }
		      }
		  })(nchunks-1,
		     function() { outer_loop(Math.floor(sz/2), k); });
	     }
	 })(Math.floor(array.length/2),
	    function() { children_loop(0, k); });
    }
}

// the main minimisation function
function minimise(nd, parent, idx, k) {
    log_debug("minimising " + util.inspect(nd));
    if(!k)
	throw new TypeError("no continuation");
    var ndtp = typeOf(nd);
    if(ndtp === "toplevel") {
	MinimiseArray(nd, 1)(k);
    } else if(ndtp === "block") {
	// knock out as many statements in the block as possible
	// if we end up with a single statement, replace the block with
	// that statement
	If(nd[1], MinimiseArray(nd, 1).
	          Then(If(function() { return !quick && nd[1].length === 1; },
		  	  function(k) { Replace(parent, idx).With(nd[1][0])(k); })))(k);
    } else if(ndtp === "defun" || ndtp === "function") {
	// try removing the function name, shrinking the parameter list, and shrinking the body; if the body ends up being a block, inline it
	If(!quick && ndtp === 'function' && !nd[1], Replace(nd, 1).With(null)).
        Then(If(!quick, MinimiseArray(nd, 2))).
	Then(MinimiseArray(nd, 3)).
	Then(If(function() { return !quick && nd[3].length === 1 && nd[3][0][0] === 'block'; },
	        function(k) { Replace(nd, 3).With(nd[3][0][1])(k); }))(k);
    } else if (ndtp === "object") {
        // minimise object literals even in quick mode
        MinimiseArray(nd, 1, false, true)(k);
    } else if(ndtp === "var") {
	// minimise variable declarations even in quick mode, to avoid
	// interpreting variable names in the declarations as object types
	// upon recursing
	MinimiseArray(nd, 1, true, true)(k);
    } else {
	// match other node types only if we're not doing quick minimisation
	// if quick is set, !quick && ndtp will be undefined, so the
	// default branch is taken
	switch(!quick && ndtp) {
	case "string":
	case "num":
	case "regexp":
	    // disable replacing constants.  unclear it helps
            // minimization much, and can mess up semantics when
            // minimizing JSON
	    // Replace(parent, idx).With(["num", 0]).
	    // OrElse(Replace(parent, idx).With(["string", ""]))(k);
            k();
	    break;
	case "unary-postfix":
	case "unary-prefix":
	    // try replacing with operand
	    Replace(parent, idx).With(nd[2]).
	      AndThen(Minimise(parent, idx)).
	      OrElse(Minimise(nd, 2))(k);
	    break;
	case "assign":
	case "binary":
	    Replace(parent, idx).With(nd[2]).
	      AndThen(Minimise(parent, idx)).
	      OrElse(Replace(parent, idx).With(nd[3]).
		       AndThen(Minimise(parent, idx)).
		       OrElse(Minimise(nd, 2).Then(Minimise(nd, 3))))(k);
	    break;
	case "return":
	    Replace(nd, 1).With(null).OrElse(Minimise(nd, 1))(k);
	    break;
	case "call":
	case "new":
	    Minimise(nd, 1).Then(MinimiseArray(nd, 2))(k);
            break;
	case "array":
	    MinimiseArray(nd, 1)(k);
	    break;
	case "if":
	case "conditional":
	    Replace(parent, idx).With(nd[2]).
	      AndThen(Minimise(parent, idx)).
	      OrElse(If(nd[3], Replace(parent, idx).With(nd[3])).
  		       AndThen(Minimise(parent, idx)).
		       OrElse(Minimise(nd, 1).
			      Then(Minimise(nd, 2).
			      Then(Minimise(nd, 3)))))(k);
	    break;
	case "var":
	    MinimiseArray(nd, 1, true, true)(k);
	    break;
	case "switch":
	    // minimise condition, then knock out cases
	    // TODO: simplify cases
	    Minimise(nd, 1).Then(MinimiseArray(nd, 2))(k);
	    break;
	case "for":
	    // try replacing with body, otherwise try removing init/cond/update
	    // and then simplify them
	    // TODO: do we want to be this elaborate?
	    // Replace(parent, idx).With(nd[4]).
	    //     AndThen(Minimise(parent, idx)).
	    //     OrElse(Replace(nd, 1).With(null).
	    //            Then(Replace(nd, 2).With(null)).
	    //            Then(Replace(nd, 3).With(null)).
	    //            Then(Minimise(nd, 1)).
	    //            Then(Minimise(nd, 2)).
	    //            Then(Minimise(nd, 3)).
	    //            Then(Minimise(nd, 4)))(k);
            // MS edited to not replace loop with body and not simplify init,
            // to help preserve some var declarations
		       Replace(nd, 2).With(null).
		       Then(Replace(nd, 3).With(null)).
		       Then(Minimise(nd, 1)).
		       Then(Minimise(nd, 2)).
		       Then(Minimise(nd, 3)).
		       Then(Minimise(nd, 4))(k);
	    break;
	default:
	    if(nd && Array.isArray(nd))
		Foreach((0).upto(nd.length-1),
			function(i) { return Minimise(nd, i); })(k);
	    else
		k();
	}
    }
}

// UglifyJS's code generator does not produce valid JSON;
// this function converts an UglifyJS into a plain object (where possible),
// which can then be printed using JSON.stringify
function toJSON(obj) {
    var ndtp = typeOf(obj);
    switch(ndtp) {
    case 'toplevel':
	// not quite right, but better than nothing
	if(obj[1].length === 0)
	    return null;
	return toJSON(obj[1][0]);
    case 'stat':
	return toJSON(obj[1]);
    case 'object':
	var res = {};
	obj[1].forEach(function(prop) {
	    res[prop[0]] = toJSON(prop[1]);
	});
	return res;
    case 'array':
	return obj[1].map(toJSON);
    case 'num':
    case 'string':
	return obj[1];
    case 'name':
	switch(obj[1]) {
	case 'true':
	    return true;
	case 'false':
	    return false;
	case 'null':
	    return null;
	default:
	    throw new Error("unexpected AST node type " + ndtp);
	}
    case 'unary-prefix':
	// special case: negative integer literals are represented as unary prefix by Uglify
	if(obj[1] === '-' && typeOf(obj[2]) === 'num')
	    return -obj[2][1];
    default:
	debugger;
	throw new Error("unexpected AST node type " + ndtp);
    }
}

function pp(ast) {
    if(ext === 'json') {
	try {
	    return JSON.stringify(toJSON(ast));
	} catch(e) {
	    console.error("Unable to convert to JSON: " + pro.gen_code(ast, { beautify: true }));
	    throw e;
	}
    } else {
	return pro.gen_code(ast, { beautify: true });
    }
}

// write the current test case out to disk
function writeTempFile() {
    var fn = getTempFileName();
    fs.writeFileSync(fn, pp(ast));
    return fn;
}

// test the current test case
function test(k) {
    if(!k)
	throw new TypeError("no continuation");
    var fn = writeTempFile();
    predicate.test(fn, function(succ) {
	// if the test succeeded, save it to file 'smallest'
	if(succ)
	    fs.writeFileSync(smallest, pp(ast));
	k(succ);
    });
}

// save a copy of the original input
var orig = getTempFileName(),
    input = fs.readFileSync(file, 'utf-8');
fs.writeFileSync(orig, input);
fs.writeFileSync(smallest, input);

// get started
predicate.test(orig,
    function(succ) {
        if(succ) {
	    minimise(ast, null, -1,
	       function() {
		   console.log("Minimisation finished; "
			     + "final version is in " + smallest);
		   process.exit(0);
	    });
	} else {
	    console.error("Original file doesn't satisfy predicate.");
	    process.exit(-1);
	}
    });

// combinators; eventually we want to write the above using these
function Minimise(nd, idx) {
    return function(k) {
	minimise(nd[idx], nd, idx, k);
    };
}

function MinimiseArray(nd, idx, nonempty, twolevel) {
    return function(k) {
	minimise_array(nd[idx], k, nonempty, twolevel);
    };
}

function Replace(nd, idx) {
    var oldval = nd[idx];
    return {
	With: function(newval) {
	    return function(k) {
		if(oldval === newval) {
		    k(true);
		} else {
		    nd[idx] = newval;
		    test(function(succ) {
			     if(succ) {
				 k(true);
			     } else {
				 nd[idx] = oldval;
				 k(false);
			     }
			 });
		}
	    };
	}
    };
}
