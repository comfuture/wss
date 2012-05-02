//
// Stub out `require` in the browser
//
function require(arg) {
    return window.wss[arg.split('/')[1]];
};

