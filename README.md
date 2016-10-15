JS Delta
==========

JS Delta is a [delta debugger](http://www.st.cs.uni-saarland.de/dd/) for debugging JavaScript-processing tools.  Given a JavaScript program `test.js` that is causing a JS-processing tool to crash or otherwise misbehave, it shrinks `test.js` by deleting statements, functions and sub-expressions, looking for a small sub-program of `test.js` which still causes the problem.  In general, JS Delta can search for a small input satisfying some predicate `P` implemented in JavaScript, allowing for arbitrarily complex tests.

For example, `P` could invoke a static analysis like [WALA](http://wala.sf.net) on its input program and check whether it times out.  If `test.js` is very big, it may be hard to see what is causing the timeout.  JS Delta will find a (sometimes very much) smaller program on which the analysis still times out, making it easier to diagnose the root cause of the scalability problem. Special support for debugging WALA-based analyses with JS Delta is provided by the [WALADelta](http://github.com/wala/WALADelta) utility.

JS Delta can also be used to help debug programs taking JSON as input.  For this use case, make sure the input file ends with extension `.json`.  

Installation
------------
From npm:

```
npm install [-g] jsdelta
```

This places the `jsdelta` script in your `$PATH` if run with `-g`,
otherwise in `node_modules/.bin`.  The script is a symlink to the
`delta.js` source file.

We've tested JS Delta on Linux and Mac OS X.

Usage
-----

JS Delta takes as its input a JavaScript file `f.js` and a predicate `P`. It first copies `f.js` to `<tmp>/delta_js_0.js`, where `<tmp>` is a fresh directory created under the `tmp_dir` specified in `config.js` (`/tmp` by default).

It then evaluates `P` on `<tmp>/delta_js_0.js`. If `P` does not hold for this file, it aborts with an error. Otherwise, it reduces the input file by removing a number of statements or expressions, writing the result to `<tmp>/delta_js_1.js`, and evaluating `P` on this new file. While `P` holds, it keeps reducing the input file in this way until it has found a reduced version `<tmp>/delta_js_n.js` such that `P` holds on it, but not on any further reduced version. At this point, JS Delta stops and copies the smallest reduced version to `<tmp>/delta_js_smallest.js`.

There are several ways for providing a predicate `P`.

At its most general, `P` is an arbitrary Node.js module that exports a function `test`. This function is invoked with the name of the file to test; if the predicate holds, `P` should return `true`, otherwise `false`.

A slightly more convenient (but less general) way of writing a predicate is to implement a Node.js module exporting a string `cmd` and a function `checkResult`. In this case, JS Delta provides a default implementation of the function `test` that does the following:

  1. It invokes `cmd` as a shell command with the file `fn` to test as its only argument.
  2. It captures the standard output and standard error of the command and writes them into files `fn.stdout` and `fn.stderr`.
  3. It invokes function `checkResult` with four arguments: the `error` code returned from executing `cmd` by the `exec` method [in the Node.js standard library](http://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback); a string containing the complete standard output of the command; a string containing the complete standard error of the command; and the time (in milliseconds) it took the command to finish.
  4. The (boolean) return value of `checkResult` is returned as the value of the predicate.

Finally, you can specify the predicate implicitly through command line arguments: invoking JS Delta with arguments

```
$ jsdelta --cmd CMD --errmsg ERR file-to-reduce.js
```

takes `CMD` to be the command to execute; the predicate is deemed to hold if the command outputs an error message (i.e., on stderr) containing string `ERR`. To check for a message on either stderr or stdout, use the `--msg` option instead.  Note that `CMD` is run with the minimized version of the input file as its only argument. If your command needs other arguments, you may need to write a wrapper script that invokes it with the right arguments.

As a special case, you can run your analysis using the `timeout.sh` script bundled with JS Delta, which will output the error message `TIMEOUT` if the given timeout is exceeded; this can be detected by specifying `--errmsg TIMEOUT`.

Finally, you can just specify a command (without providing the `--errmsg` or `--msg` flags), in which case the predicate is deemed to hold if the command exits with an error.

All the usages of JS Delta can be shown by running the command line tool without arguments:

```
$ ./delta.js
usage: delta.js [-h] [--quick] [--no-fixpoint] [--optimize] [--cmd CMD]
                [--record RECORD] [--replay REPLAY] [--errmsg ERRMSG]
                [--msg MSG] [--dir DIR] [--out OUT]
                ...

Command-line interface to JSDelta

Positional arguments:
  main-file_and_predicate_and_predicate-args
                        main file to reduce, followed by arguments to the 
                        predicate

Optional arguments:
  -h, --help            Show this help message and exit.
  --quick, -q           disable reductions of individual expressions.
  --no-fixpoint         disable fixpoint algorithm (faster, but sub-optimal)
  --optimize            enable inlining and constant folding (slower, but 
                        more optimal)
  --cmd CMD             command to execute on each iteration
  --record RECORD       file to store recording in
  --replay REPLAY       file to replay recording from
  --errmsg ERRMSG       substring in stderr to look for
  --msg MSG             substring in stdout to look for
  --dir DIR             directory to reduce (should contain the main file!)
  --out OUT             directory to move the minimized output to
```

Examples
--------

Example usages of all options can be found in [examples](examples)/xyz/test.sh. 
The examples contain some extra code to facitilate testing, the line of interest is the one that invokes jsdelta. 

A concrete example (seen in full in [test.sh](examples/simple-cmd-stderr/test.sh)) of the abstract command above can be seen below:
```
$ ./delta.js --cmd examples/predicates/cmd-stderr.js --errmsg fail examples/simple-cmd-stderr/main.js
```

Tests
-----

[test.sh](test.sh) runs the tests for this project. 
It attempts to run all test.sh file in the [examples](examples)-directory, failing if any of them fail.
Besides testing that the examples do not crash, each test also check that the reduced output is smaller than the input.


New'ish features
-----------------

- `--dir DIR`: the content of the `DIR` directory will be reduced: files/directories will be deleted and .js-files will be reduced as usual. Note that .js files are not required to be present at all, so JS Delta is capable of finding an abitrary subset of files that satisfy a predicate.
- `--optimize`: the closure compiler will perform its optimizations on the reduced JavaScript files. This can lead to significantly smaller files than otherwise, especially if it is able to inline function calls.
- `--out FILE`: the reduced file (or directory) will be copied to `DIR`

License
-------

JS Delta is distributed under the Eclipse Public License.  See the LICENSE.txt file in the root directory or <a href="http://www.eclipse.org/legal/epl-v10.html">http://www.eclipse.org/legal/epl-v10.html</a>.
