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

var fs = require("fs"),
    deltalib = require(__dirname + "/deltalib.js");
    


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
    replay_idx : -1
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
    } else if (arg === '--') {
		options.file = process.argv[i + 1];
		i += 2;
		break;
    } else if (arg[0] === '-') {
		usage();
    } else {
		options.file = process.argv[i++];
		break;
    }
}

// check whether a predicate module was specified
if (i < process.argv.length)
    options.predicate = require(process.argv[i++]);

// the remaining arguments will be passed to the predicate
options.predicate_args = process.argv.slice(i);

deltalib.main(options);

function usage() {
    console.error("Usage: " + process.argv[0] + " " + process.argv[1] +
		" [-q|--quick] [--no-fixpoint] [--cmd COMMAND]" +
		" [--record FILE | --replay FILE]" +
		" [--errmsg ERRMSG] [--msg MSG] FILE [PREDICATE] OPTIONS...");
    process.exit(-1);
}






