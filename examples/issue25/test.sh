#!/usr/bin/env bash

MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
source "${MAIN_FILE_FOLDER}/../../util/example_setup.sh";

#Run delta.js
echo '{"foo": 3}' > ${TMP_FOLDER}/test.json;
${ROOT}/delta.js --cmd false ${TMP_FOLDER}/test.json >/dev/null;

echo "TEST OK: jsdelta did not crash";
