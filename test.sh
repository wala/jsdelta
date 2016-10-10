#!/usr/bin/env bash
set -e

ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )";
EXAMPLES="${ROOT}/examples";

# Execute all shell scripts in the example subfolder

find ${EXAMPLES} -name '*.sh' | while read line; do
    #chmod +x ${line}
    echo "minimizing: ${line}"
    ${line}
done

