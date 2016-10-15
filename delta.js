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

const delta_single = require("./src/delta_single"),
    delta_multi = require("./src/delta_multi");

var options = require("./src/options").parseOptions();

if (options.multifile_mode) {
    delta_multi.reduce(options);
} else {
    delta_single.reduce(options);
}
