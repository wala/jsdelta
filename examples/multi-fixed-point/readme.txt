## Running this example demonstrates the behavior of the fixed-point iteration.
## On the first run a.js is the first file to be visited, but since main.js depends on a.js , a.js cannot be removed. However the algorithm will remove the require of a.js in main.js, making it possible to delete a.js on the second iteration. 
./delta.js --dir examples/multi-fixed-point main.js ./examples/pred.js
