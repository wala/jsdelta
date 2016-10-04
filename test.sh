#!/usr/bin/env bash
set -e

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
EXAMPLES="${ROOT}/examples";

function runTest(){
    ${ROOT}/delta.js $1 $2 $3 $4 $5 $6 ${EXAMPLES}/pred.js
}

function runTests(){
    runTest $1 $2 $3 ${EXAMPLES}/simple/main.js
    runTest $1 $2 $3 ${EXAMPLES}/inlining/inlining.js
    runTest $1 $2 $3 --dir ${EXAMPLES}/multi-json main.js
    runTest $1 $2 $3 --dir ${EXAMPLES}/multi-simple to_minimize.js
    runTest $1 $2 $3 --dir ${EXAMPLES}/multi-advanced main-file-folder/main.js
    runTest $1 $2 $3 --dir ${EXAMPLES}/multi-html main.html
    runTest $1 $2 $3 --dir ${EXAMPLES}/multi-fixed-point main.js
}

runTests

runTests --quick
runTests --no-fixpoint
runTests --optimize

runTests --quick --no-fixpoint
runTests --quick --optimize

runTests --no-fixpoint --optimize

runTests --quick --no-fixpoint --optimize
