(function () {
    function f1() {
        f2();
    }

    function f2() {
        f3();
    }

    function f3() {
        f4();
    }

    function f4() {
        console.log(m1());
    }

    function m1() {
        return m2();
    }

    function m2() {
        return m3();
    }

    function m3() {
        return m4();
    }

    function m4() {
        return s1() + s2();
    }

    function s1() {
        return "suc";
    }

    function s2() {
        return "cess";
    }

    f1();
})();