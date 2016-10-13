#!/usr/bin/env node
var pred = require("./pred.js");

function main() {
   var arg = process.argv[2];
   console.log(arg);
   if (pred.test(arg)) {
       system.exit(-1);
   } else {
      system.exit(0);
   }
}

main();

