#!/usr/bin/env bash

MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
source "${MAIN_FILE_FOLDER}/../../util/example_setup.sh";
PREDICATE="${ROOT}/examples/predicates/specific-numbers.js";

#Run delta.js
${ROOT}/delta.js --out ${TMP_OUT} ${MAIN_FILE_FOLDER}/main.json ${PREDICATE} >/dev/null;

source "${MAIN_FILE_FOLDER}/../../util/example_teardown.sh";
