#!/usr/bin/env bash

TEST_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
ROOT="${TEST_FOLDER}/../..";
PREDICATE="${ROOT}/examples/pred.js";

${ROOT}/delta.js --quick --dir ${TEST_FOLDER} main-file-folder/main.js ${PREDICATE}
