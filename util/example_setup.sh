#!/usr/bin/env bash

#
# This file is included as source by examples/XYZ/test.sh
#

ROOT="${MAIN_FILE_FOLDER}/../..";
PREDICATE="${ROOT}/examples/predicates/pred.js";

BASENAME=${MAIN_FILE_FOLDER##*/};
TMP_FOLDER="${ROOT}/examples/tmp";
TMP_OUT="${TMP_FOLDER}/${BASENAME}";