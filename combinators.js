/*******************************************************************************
 * Copyright (c) 2012 IBM Corporation.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v10.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

Number.prototype.upto = function(hi) {
    var res = [];
    for(var i=this.valueOf();i<=hi;++i)
	res.push(i);
    return res;
};

function If(cond, f) {
    if(typeof f !== 'function')
	throw new TypeError("If needs a function argument");
    return function(k) {
	var t = typeof cond === 'function' ? cond() : cond;
	if(t)
	    f(k);
	else
	    k();
    };
}

function Foreach(array, f) {
    if(typeof f !== 'function')
	throw new TypeError("Foreach needs a function argument");
    function loop(i, k) {
	if(i >= array.length)
	    k();
	else
	    f(array[i])(function() { loop(i+1, k); });
    }
    return function(k) {
	loop(0, k);
    };
}

Function.prototype.AndThen = function(f) {
    if(typeof f !== 'function')
	throw new TypeError("AndThen needs a function argument");
    var self = this;
    return {
	OrElse: function(g) {
	            if(typeof g !== 'function')
			throw new TypeError("OrElse needs a function argument");
	            return function(k) {
			self(function(succ) {
				 (succ ? f : g)(k);
			     });
		    }
	        }
    };
}

Function.prototype.Then = function(f) {
    var self = this;
    return function(k) {
	self(function() { f(k); });
    };
}

Function.prototype.OrElse = function(f) {
    if(typeof f !== 'function')
	throw new TypeError("OrElse needs a function argument");
    var self = this;
    return function(k) {
	self(function(succ) {
		 if(succ)
		     k();
		 else
		     f(k);
	     });
    };
}

// for testing
function Done() { 
    console.log("done");
}

function Print(msg) {
    return function(k) {
	console.log(msg);
	k();
    };
}

exports.If = If;
exports.Foreach = Foreach;