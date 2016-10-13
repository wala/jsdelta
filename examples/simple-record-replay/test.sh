#!/usr/bin/env bash

MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
source "${MAIN_FILE_FOLDER}/../../util/example_setup.sh";
PREDICATE="${ROOT}/examples/predicates/pred.js";

RECORD_FILE="${TMP_FOLDER}/record"

#Run delta.js record
${ROOT}/delta.js --record ${RECORD_FILE} --out ${TMP_OUT} ${MAIN_FILE_FOLDER}/main.js ${PREDICATE} >/dev/null;

#Run delta.js replay
${ROOT}/delta.js --replay ${RECORD_FILE} --out ${TMP_OUT} ${MAIN_FILE_FOLDER}/main.js ${PREDICATE} >/dev/null;

source "${MAIN_FILE_FOLDER}/../../util/example_teardown.sh";

