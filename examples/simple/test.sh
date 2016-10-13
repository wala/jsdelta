#!/usr/bin/env bash

MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
ROOT="${MAIN_FILE_FOLDER}/../..";
PREDICATE="${ROOT}/examples/predicates/pred.js";

BASENAME=${MAIN_FILE_FOLDER##*/};
TMP_FOLDER="${ROOT}/examples/tmp";
TMP_OUT="${TMP_FOLDER}/${BASENAME}";

#Run delta.js
${ROOT}/delta.js --out ${TMP_OUT} ${MAIN_FILE_FOLDER}/main.js ${PREDICATE} >/dev/null;

#Check that output is smaller than input
${ROOT}/util/cmp-size.js ${MAIN_FILE_FOLDER} ${TMP_OUT};
EXIT_CODE=$?;

#Fail if output is not smaller than input
if [[ ${EXIT_CODE} == 0 ]]; then
    echo "TEST FAIL: minimized program is larger than the input";
    exit -1;
else
    echo "TEST OK: reduced program is smaller than the input";
fi
