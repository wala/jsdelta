dep1 = require("../dep1.js");
dep2 = require("../deps/dep2.js");
dep3 = require("../deps/dep3.js");

function main() {
   var value = dep1.getValue();
   value += dep2.getValue();

   if (value === 42) {
        console.log(dep3.getValue());
   }
}

main();

