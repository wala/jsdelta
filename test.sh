set -e
./delta.js examples/simple/main.js ./examples/pred.js
./delta.js --dir examples/multi-simple to_minimize.js ./examples/pred.js
./delta.js --dir examples/multi-advanced main-file-folder/main.js ./examples/pred.js
./delta.js --dir examples/multi-html main.html ./examples/pred.js

