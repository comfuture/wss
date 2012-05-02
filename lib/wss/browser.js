//
// browser.js - client-side engine
//

var isFileProtocol = (location.protocol === 'file:'    ||
                      location.protocol === 'chrome:'  ||
                      location.protocol === 'chrome-extension:'  ||
                      location.protocol === 'resource:');

wss.env = wss.env || (location.hostname == '127.0.0.1' ||
                        location.hostname == '0.0.0.0'   ||
                        location.hostname == 'localhost' ||
                        location.port.length > 0         ||
                        isFileProtocol                   ? 'development'
                                                         : 'production');

// Load styles asynchronously (default: false)
//
// This is set to `false` by default, so that the body
// doesn't start loading before the stylesheets are parsed.
// Setting this to `true` can result in flickering.
//
wss.async = false;

// Interval between watch polls
wss.poll = wss.poll || (isFileProtocol ? 1000 : 1500);

//
// Watch mode
//
wss.watch   = function () { return this.watchMode = true };
wss.unwatch = function () { return this.watchMode = false };

if (wss.env === 'development') {
    wss.optimization = 0;

    if (/!watch/.test(location.hash)) {
        wss.watch();
    }
    wss.watchTimer = setInterval(function () {
        if (wss.watchMode) {
            loadStyleSheets(function (e, root, _, sheet, env) {
                if (root) {
                    createCSS(root.toCSS(), sheet, env.lastModified);
                }
            });
        }
    }, wss.poll);
} else {
    wss.optimization = 3;
}

var cache;

try {
    cache = (typeof(window.localStorage) === 'undefined') ? null : window.localStorage;
} catch (_) {
    cache = null;
}

//
// Get all <link> tags with the 'rel' attribute set to "stylesheet/wss"
//
var links = document.getElementsByTagName('link');
var typePattern = /^text\/(x-)?wss$/;

wss.sheets = [];

for (var i = 0; i < links.length; i++) {
    if (links[i].rel === 'text/wss' || (links[i].rel.match(/wss/) &&
       (links[i].type.match(typePattern)))) {
        wss.sheets.push(links[i]);
    }
}


wss.refresh = function (reload) {
    var startTime, endTime;
    startTime = endTime = new(Date);

    loadStyleSheets(function (e, root, _, sheet, env) {
        if (env.local) {
            log("loading " + sheet.href + " from cache.");
        } else {
            log("parsed " + sheet.href + " successfully.");
            createCSS(root.toCSS(), sheet, env.lastModified);
        }
        log("css for " + sheet.href + " generated in " + (new(Date) - endTime) + 'ms');
        (env.remaining === 0) && log("css generated in " + (new(Date) - startTime) + 'ms');
        endTime = new(Date);
    }, reload);

    loadStyles();
};
wss.refreshStyles = loadStyles;

wss.refresh(wss.env === 'development');

function loadStyles() {
    var styles = document.getElementsByTagName('style');
    for (var i = 0; i < styles.length; i++) {
        if (styles[i].type.match(typePattern)) {
            new(wss.Parser)().parse(styles[i].innerHTML || '', function (e, tree) {
                var css = tree.toCSS();
                var style = styles[i];
                style.type = 'text/css';
                if (style.styleSheet) {
                    style.styleSheet.cssText = css;
                } else {
                    style.innerHTML = css;
                }
            });
        }
    }
}

function loadStyleSheets(callback, reload) {
    for (var i = 0; i < wss.sheets.length; i++) {
        loadStyleSheet(wss.sheets[i], callback, reload, wss.sheets.length - (i + 1));
    }
}

function loadStyleSheet(sheet, callback, reload, remaining) {
    var url       = window.location.href.replace(/[#?].*$/, '');
    var href      = sheet.href.replace(/\?.*$/, '');
    var css       = cache && cache.getItem(href);
    var timestamp = cache && cache.getItem(href + ':timestamp');
    var styles    = { css: css, timestamp: timestamp };

    // Stylesheets in IE don't always return the full path
    if (! /^(https?|file):/.test(href)) {
        if (href.charAt(0) == "/") {
            href = window.location.protocol + "//" + window.location.host + href;
        } else {
            href = url.slice(0, url.lastIndexOf('/') + 1) + href;
        }
    }
    var filename = href.match(/([^\/]+)$/)[1];

    xhr(sheet.href, sheet.type, function (data, lastModified) {
        if (!reload && styles && lastModified &&
           (new(Date)(lastModified).valueOf() ===
            new(Date)(styles.timestamp).valueOf())) {
            // Use local copy
            createCSS(styles.css, sheet);
            callback(null, null, data, sheet, { local: true, remaining: remaining });
        } else {
            // Use remote copy (re-parse)
            try {
                new(wss.Parser)({
                    optimization: wss.optimization,
                    paths: [href.replace(/[\w\.-]+$/, '')],
                    mime: sheet.type,
                    filename: filename
                }).parse(data, function (e, root) {
                    if (e) { return error(e, href) }
                    try {
                        callback(e, root, data, sheet, { local: false, lastModified: lastModified, remaining: remaining });
                        removeNode(document.getElementById('wss-error-message:' + extractId(href)));
                    } catch (e) {
                        error(e, href);
                    }
                });
            } catch (e) {
                error(e, href);
            }
        }
    }, function (status, url) {
        throw new(Error)("Couldn't load " + url + " (" + status + ")");
    });
}

function extractId(href) {
    return href.replace(/^[a-z]+:\/\/?[^\/]+/, '' )  // Remove protocol & domain
               .replace(/^\//,                 '' )  // Remove root /
               .replace(/\?.*$/,               '' )  // Remove query
               .replace(/\.[^\.\/]+$/,         '' )  // Remove file extension
               .replace(/[^\.\w-]+/g,          '-')  // Replace illegal characters
               .replace(/\./g,                 ':'); // Replace dots with colons(for valid id)
}

function createCSS(styles, sheet, lastModified) {
    var css;

    // Strip the query-string
    var href = sheet.href ? sheet.href.replace(/\?.*$/, '') : '';

    // If there is no title set, use the filename, minus the extension
    var id = 'wss:' + (sheet.title || extractId(href));

    // If the stylesheet doesn't exist, create a new node
    if ((css = document.getElementById(id)) === null) {
        css = document.createElement('style');
        css.type = 'text/css';
        css.media = sheet.media || 'screen';
        css.id = id;
        document.getElementsByTagName('head')[0].appendChild(css);
    }

    if (css.styleSheet) { // IE
        try {
            css.styleSheet.cssText = styles;
        } catch (e) {
            throw new(Error)("Couldn't reassign styleSheet.cssText.");
        }
    } else {
        (function (node) {
            if (css.childNodes.length > 0) {
                if (css.firstChild.nodeValue !== node.nodeValue) {
                    css.replaceChild(node, css.firstChild);
                }
            } else {
                css.appendChild(node);
            }
        })(document.createTextNode(styles));
    }

    // Don't update the local store if the file wasn't modified
    if (lastModified && cache) {
        log('saving ' + href + ' to cache.');
        cache.setItem(href, styles);
        cache.setItem(href + ':timestamp', lastModified);
    }
}

function xhr(url, type, callback, errback) {
    var xhr = getXMLHttpRequest();
    var async = isFileProtocol ? false : wss.async;

    if (typeof(xhr.overrideMimeType) === 'function') {
        xhr.overrideMimeType('text/css');
    }
    xhr.open('GET', url, async);
    xhr.setRequestHeader('Accept', type || 'text/x-wss, text/css; q=0.9, */*; q=0.5');
    xhr.send(null);

    if (isFileProtocol) {
        if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
            callback(xhr.responseText);
        } else {
            errback(xhr.status, url);
        }
    } else if (async) {
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                handleResponse(xhr, callback, errback);
            }
        };
    } else {
        handleResponse(xhr, callback, errback);
    }

    function handleResponse(xhr, callback, errback) {
        if (xhr.status >= 200 && xhr.status < 300) {
            callback(xhr.responseText,
                     xhr.getResponseHeader("Last-Modified"));
        } else if (typeof(errback) === 'function') {
            errback(xhr.status, url);
        }
    }
}

function getXMLHttpRequest() {
    if (window.XMLHttpRequest) {
        return new(XMLHttpRequest);
    } else {
        try {
            return new(ActiveXObject)("MSXML2.XMLHTTP.3.0");
        } catch (e) {
            log("browser doesn't support AJAX.");
            return null;
        }
    }
}

function removeNode(node) {
    return node && node.parentNode.removeChild(node);
}

function log(str) {
    if (wss.env == 'development' && typeof(console) !== "undefined") { console.log('wss: ' + str) }
}

function error(e, href) {
    var id = 'wss-error-message:' + extractId(href);
    var template = '<li><label>{line}</label><pre class="{class}">{content}</pre></li>';
    var elem = document.createElement('div'), timer, content, error = [];
    var filename = e.filename || href;

    elem.id        = id;
    elem.className = "wss-error-message";

    content = '<h3>'  + (e.message || 'There is an error in your .wss file') +
              '</h3>' + '<p>in <a href="' + filename   + '">' + filename + "</a> ";

    var errorline = function (e, i, classname) {
        if (e.extract[i]) {
            error.push(template.replace(/\{line\}/, parseInt(e.line) + (i - 1))
                               .replace(/\{class\}/, classname)
                               .replace(/\{content\}/, e.extract[i]));
        }
    };

    if (e.stack) {
        content += '<br/>' + e.stack.split('\n').slice(1).join('<br/>');
    } else if (e.extract) {
        errorline(e, 0, '');
        errorline(e, 1, 'line');
        errorline(e, 2, '');
        content += 'on line ' + e.line + ', column ' + (e.column + 1) + ':</p>' +
                    '<ul>' + error.join('') + '</ul>';
    }
    elem.innerHTML = content;

    // CSS for error messages
    createCSS([
        '.wss-error-message ul, .wss-error-message li {',
            'list-style-type: none;',
            'margin-right: 15px;',
            'padding: 4px 0;',
            'margin: 0;',
        '}',
        '.wss-error-message label {',
            'font-size: 12px;',
            'margin-right: 15px;',
            'padding: 4px 0;',
            'color: #cc7777;',
        '}',
        '.wss-error-message pre {',
            'color: #dd6666;',
            'padding: 4px 0;',
            'margin: 0;',
            'display: inline-block;',
        '}',
        '.wss-error-message pre.line {',
            'color: #ff0000;',
        '}',
        '.wss-error-message h3 {',
            'font-size: 20px;',
            'font-weight: bold;',
            'padding: 15px 0 5px 0;',
            'margin: 0;',
        '}',
        '.wss-error-message a {',
            'color: #10a',
        '}',
        '.wss-error-message .error {',
            'color: red;',
            'font-weight: bold;',
            'padding-bottom: 2px;',
            'border-bottom: 1px dashed red;',
        '}'
    ].join('\n'), { title: 'error-message' });

    elem.style.cssText = [
        "font-family: Arial, sans-serif",
        "border: 1px solid #e00",
        "background-color: #eee",
        "border-radius: 5px",
        "-webkit-border-radius: 5px",
        "-moz-border-radius: 5px",
        "color: #e00",
        "padding: 15px",
        "margin-bottom: 15px"
    ].join(';');

    if (wss.env == 'development') {
        timer = setInterval(function () {
            if (document.body) {
                if (document.getElementById(id)) {
                    document.body.replaceChild(elem, document.getElementById(id));
                } else {
                    document.body.insertBefore(elem, document.body.firstChild);
                }
                clearInterval(timer);
            }
        }, 10);
    }
}

