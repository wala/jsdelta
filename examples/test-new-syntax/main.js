async function bar(a=[1,2,3]) {
    const [x] = a;
    console.log("garbage");
}
async function foo(msg) {
    await bar();
    console.log(msg ?? "success");
}
console.log("garbage");
console.log("garbage");
foo();
console.log("garbage");
