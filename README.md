JS Delta
==========

JS Delta is a [delta debugger](http://www.st.cs.uni-saarland.de/dd/) for debugging JavaScript-processing tools.  Given a JavaScript program `test.js` that is causing a JS-processing tool to crash or otherwise misbehave, it shrinks `test.js` by deleting statements, functions and sub-expressions, looking for a small sub-program of `test.js` which still causes the problem.  In general, JS Delta can search for a small input satifying some predicate `P` implemented in JavaScript, allowing for arbitrarily complex tests.

For example, `P` could invoke a static analysis like [WALA](http://wala.sf.net) on its input program and check whether it times out.  If `test.js` is very big, it may be hard to see what is causing the timeout.  JS Delta will find a (sometimes very much) smaller program on which the analysis still times out, making it easier to diagnose the root cause of the scalability problem. Special support for debugging WALA-based analyses with JS Delta is provided by the [JS Delta](http://github.com/wala/WALADelta) utility.

JS Delta can also be used to help debug programs taking JSON as input.  For this use case, make sure the input file ends with extension `.json`.  

Prerequisites
--------------
- Node.js
- UglifyJS.  

Run `npm install` in the root directory of your JS Delta checkout to install the dependencies.

__NOTE__: JS Delta does _not_ work with [UglifyJS2](https://github.com/mishoo/UglifyJS2).  To get an appropriate version of UglifyJS, just run `npm install` in the JS Delta directory, or run `npm install uglify-js@1.3.4` in your home directory.

We've tested JS Delta on Linux and Mac OS X.

Usage
-----

JS Delta takes as its input a JavaScript file `f.js` and a predicate `P`. It first copies `f.js` to `<tmp>/delta_js_0.js`, where `<tmp>` is a fresh directory created under the `tmp_dir` specified in `config.js` (`/tmp` by default).

It then evaluates `P` on `<tmp>/delta_js_0.js`. If `P` does not hold for this file, it aborts with an error. Otherwise, it reduces the input file by removing a number of statements or expressions, writing the result to `<tmp>/delta_js_1.js`, and evaluating `P` on this new file. While `P` holds, it keeps reducing the input file in this way until it has found a reduced version `<tmp>/delta_js_n.js` such that `P` holds on it, but not on any further reduced version. At this point, JS Delta stops and copies the smallest reduced version to `<tmp>/delta_js_smallest.js`.

There are several ways for providing a predicate `P`.

At its most general, `P` is an arbitrary Node.js module that exports a function `test`. This function is invoked with the name of the file to test and a continuation `k`. If the predicate holds, `P` should invoke `k` with argument `true`, otherwise with argument `false`.

A slightly more convenient (but less general) way of writing a predicate is to implement a Node.js module exporting a string `cmd` and a function `checkResult`. In this case, JS Delta provides a default implementation of the function `test` that does the following:

  1. It invokes `cmd` as a shell command with the file `fn` to test as its only argument.
  2. It captures the standard output and standard error of the command and writes them into files `fn.stdout` and `fn.stderr`.
  3. It invokes function `checkResult` with four arguments: the `error` code returned from executing `cmd` by the `exec` method [in the Node.js standard library](http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback); a string containing the complete standard output of the command; a string containing the complete standard error of the command; and the time (in milliseconds) it took the command to finish.
  4. The (boolean) return value of `checkResult` is passed to the continuation.

Finally, you can specify the predicate implicitly through command line arguments: invoking JS Delta with arguments

> --cmd CMD --timeout N file-to-reduce.js

has the same effect as defining a predicate module exporting `CMD` as its command, and with a `checkResult` function that returns `true` if the command took longer than `N` milliseconds to complete.  Note that if your tool requires other command-line arguments besides the input JavaScript file, you should write a wrapper shell script that takes one argument (the input JS file) and invokes your tool appropriately, and then use that shell script as the `--cmd` argument.

As an example, if you'd like to see why `file-to-reduce.js` is taking longer than 30 seconds to analyze with your tool `myjstool`, you would run:

> node delta.js --cmd myjstool --timeout 30000 file-to-reduce.js

Invoking JS Delta with arguments

> --cmd CMD --errmsg ERR file-to-reduce.js

again takes `CMD` to be the command to execute; the predicate is deemed to hold if the command outputs an error message containing string `ERR`.

As a special case, instead of using the `--timeout` flag you can run your analysis using the `timeout.sh` script bundled with JS Delta, which will output the error message `TIMEOUT` if the given timeout is exceeded, which can be detected by specifying `--errmsg TIMEOUT`. This is sometimes more reliable than using the `--timeout` flag directly.

Finally, you can just specify a command (without error message or timeout), in which case the predicate is deemed to hold if the command exits with an error.

License
-------

JS Delta is distributed under the Eclipse Public License.  See the LICENSE.txt file in the root directory or <a href="http://www.eclipse.org/legal/epl-v10.html">http://www.eclipse.org/legal/epl-v10.html</a>.  
