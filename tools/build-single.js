#!/usr/bin/env node
/* Builds single-file versions of WYK by inlining the CSS and JS.
 *   dist/wyk-standalone.html  – a complete page you can open from disk or email
 *   dist/artifact.html        – the same page body without the html/head/body wrapper
 * Usage: node tools/build-single.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let html = read('index.html');
const css = read('css/style.css');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace(/<script src="(js\/[\w.-]+)"><\/script>/g, (m, src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'wyk-standalone.html'), html);

const head = html.slice(html.indexOf('<head>') + 6, html.indexOf('</head>'))
  .replace(/<meta charset="utf-8">\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('built dist/wyk-standalone.html (' + Math.round(html.length / 1024) + ' KB) and dist/artifact.html');
