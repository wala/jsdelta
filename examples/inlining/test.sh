#!/usr/bin/env bash
MAIN_FILE_FOLDER="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
source "${MAIN_FILE_FOLDER}/../../util/example_setup.sh";
PREDICATE="${ROOT}/examples/predicates/pred.js";

#Run delta.js
INLINED=${TMP_OUT}/inlined.js
${ROOT}/delta.js --optimize --out ${INLINED} ${MAIN_FILE_FOLDER}/inlining.js ${PREDICATE} >/dev/null

# Compare with unoptimized
NOT_INLINED=${TMP_OUT}/not-inlined.js
${ROOT}/delta.js --out ${NOT_INLINED} ${MAIN_FILE_FOLDER}/inlining.js ${PREDICATE} >/dev/null

set +e;
${ROOT}/util/cmp-size.js ${INLINED} ${NOT_INLINED};
EXIT_CODE=$?;
set -e;

# Fail if optimized output is not smaller than unoptimized output
if [[ ${EXIT_CODE} -ne 0 ]]; then
    echo "TEST FAIL: minimized (optimized) program is not smaller than the minimized (unoptimized) output";
    exit -1;
fi

source "${MAIN_FILE_FOLDER}/../../util/example_teardown.sh";

