#!/usr/bin/env bash
MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
source "${MAIN_FILE_FOLDER}/../../util/example_setup.sh";
PREDICATE="${ROOT}/examples/predicates/pred.js";

#Run delta.js
${ROOT}/delta.js --optimize --out ${TMP_OUT} --dir ${MAIN_FILE_FOLDER} inlining.js ${PREDICATE} >/dev/null

# Compare with unoptimized
TMP_OUT_NO_OPTIMIZATION="${TMP_OUT}_no-opt"
mkdir -p ${TMP_OUT_NO_OPTIMIZATION}
${ROOT}/delta.js --out ${TMP_OUT_NO_OPTIMIZATION} --dir ${MAIN_FILE_FOLDER} inlining.js ${PREDICATE} >/dev/null

set +e;
${ROOT}/util/cmp-size.js ${TMP_OUT} ${TMP_OUT_NO_OPTIMIZATION};
EXIT_CODE=$?;
set -e;

rm -rf ${TMP_OUT_NO_OPTIMIZATION}

# Fail if optimized output is not smaller than unoptimized output
if [[ ${EXIT_CODE} -ne 0 ]]; then
    echo "TEST FAIL: minimized (optimized) program is not smaller than the minimized (unoptimized) output";
    exit -1;
fi

source "${MAIN_FILE_FOLDER}/../../util/example_teardown.sh";

