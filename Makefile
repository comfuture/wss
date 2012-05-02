#
# Run all tests
#
test: 
	node test/wss-test.js

#
# Run benchmark
#
benchmark:
	node benchmark/wss-benchmark.js

#
# Build less.js
#
SRC = lib/wss
HEADER = build/header.js
VERSION = `cat package.json | grep version \
														| grep -o '[0-9]\.[0-9]\.[0-9]\+'`
DIST = dist/wss-${VERSION}.js
RHINO = dist/wss-rhino-${VERSION}.js
DIST_MIN = dist/wss-${VERSION}.min.js

less:
	@@mkdir -p dist
	@@touch ${DIST}
	@@cat ${HEADER} | sed s/@VERSION/${VERSION}/ > ${DIST}
	@@echo "(function (window, undefined) {" >> ${DIST}
	@@cat build/require.js\
	      build/amd.js\
	      build/ecma-5.js\
	      ${SRC}/parser.js\
	      ${SRC}/functions.js\
	      ${SRC}/colors.js\
	      ${SRC}/tree/*.js\
	      ${SRC}/tree.js\
	      ${SRC}/browser.js >> ${DIST}
	@@echo "})(window);" >> ${DIST}
	@@echo ${DIST} built.

rhino:
	@@mkdir -p dist
	@@touch ${RHINO}
	@@cat build/require-rhino.js\
	      build/ecma-5.js\
	      ${SRC}/parser.js\
	      ${SRC}/functions.js\
	      ${SRC}/tree/*.js\
	      ${SRC}/tree.js\
	      ${SRC}/rhino.js > ${RHINO}
	@@echo ${RHINO} built.

min: wss
	@@echo minifying...
	@@uglifyjs ${DIST} > ${DIST_MIN}
	@@echo ${DIST_MIN} built.

server: wss
	cp dist/wss-${VERSION}.js test/html/
	cd test/html && python -m SimpleHTTPServer

clean:
	git rm dist/*

dist: clean min
	git add dist/*
	git commit -a -m "(dist) build ${VERSION}"
	git archive master --prefix=wss/ -o wss-${VERSION}.tar.gz
	npm publish wss-${VERSION}.tar.gz

stable:
	npm tag wss ${VERSION} stable


.PHONY: test benchmark
