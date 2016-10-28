#!/usr/bin/env node
var pred = require("./pred.js");

function main() {
   var arg = process.argv[2];
   console.log(arg);
   if (pred.test(arg)) {
      console.error("fail");
   } else {
   }
}

main();

