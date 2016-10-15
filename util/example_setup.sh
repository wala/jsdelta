#!/usr/bin/env bash

#
# This file is included as source by examples/XYZ/test.sh
#

set -e

ROOT="${MAIN_FILE_FOLDER}/../..";

BASENAME=${MAIN_FILE_FOLDER##*/};
TMP_FOLDER="${ROOT}/examples/tmp";
TMP_OUT="${TMP_FOLDER}/${BASENAME}";