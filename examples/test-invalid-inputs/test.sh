#!/usr/bin/env bash

MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
source "${MAIN_FILE_FOLDER}/../../util/example_setup.sh";

set +e

#Run delta.js
echo '{' > ${TMP_FOLDER}/test.json;
${ROOT}/delta.js --out ${TMP_OUT} --cmd false ${TMP_FOLDER}/test.json &>/dev/null;
STATUS=$?;
if [ $STATUS -ne 1 ]; then
    echo "TEST FAILED: expected jsdelta exit code -1, got ${STATUS}";
    exit -1;
fi

#Run delta.js
echo '{' > ${TMP_FOLDER}/test.js;
${ROOT}/delta.js --out ${TMP_OUT} --cmd false ${TMP_FOLDER}/test.js &>/dev/null;
STATUS=$?;
if [ $STATUS -ne 1 ]; then
    echo "TEST FAILED: expected jsdelta exit code -1, got ${STATUS}";
    exit -1;
fi

echo "TEST OK: jsdelta crashed in controlled manner";