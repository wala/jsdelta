#!/usr/bin/env bash

MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
source "${MAIN_FILE_FOLDER}/../../util/example_setup.sh";

#Run delta.js
echo '{}' > ${TMP_FOLDER}/test.json;
${ROOT}/delta.js --out ${TMP_OUT} --cmd false ${TMP_FOLDER}/test.json >/dev/null;

#Run delta.js
echo '' > ${TMP_FOLDER}/test.js;
${ROOT}/delta.js --out ${TMP_OUT} --cmd false ${TMP_FOLDER}/test.js >/dev/null;

echo "TEST OK: jsdelta did not crash";
