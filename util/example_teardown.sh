#!/usr/bin/env bash

#
# This file is included as source by examples/XYZ/test.sh
#

set +e

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

rm -r ${TMP_OUT}