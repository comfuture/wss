// amd.js
//
// Define Less as an AMD module.
if (typeof define === "function" && define.amd) {
    define("wss", [], function () { return wss; } );
}
