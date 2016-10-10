#!/usr/bin/env bash

MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
ROOT="${MAIN_FILE_FOLDER}/../..";
PREDICATE="${ROOT}/examples/pred.js";

${ROOT}/delta.js --dir ${MAIN_FILE_FOLDER} main.html ${PREDICATE}
