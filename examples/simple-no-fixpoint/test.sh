#!/usr/bin/env bash

MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
source "${MAIN_FILE_FOLDER}/../../util/example_setup.sh";
PREDICATE="${ROOT}/examples/predicates/pred.js";

#Run delta.js
${ROOT}/delta.js --no-fixpoint --out ${TMP_OUT} ${MAIN_FILE_FOLDER}/main.js ${PREDICATE} >/dev/null;

source "${MAIN_FILE_FOLDER}/../../util/example_teardown.sh";

