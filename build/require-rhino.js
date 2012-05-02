//
// Stub out `require` in rhino
//
function require(arg) {
    return wss[arg.split('/')[1]];
};

