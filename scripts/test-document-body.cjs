// Run with: node scripts/test-document-body.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Check stored document bodies and public rendering without Next.js. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => {
    if (name.startsWith('@/')) return load(path.resolve('src', name.slice(2)) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts');
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}
const { parseDocumentBody, serializeDocumentBody, documentBodyHtml, normalizeDocumentHref, normalizeDocumentColor, normalizeDocumentFontSize } = load('src/lib/data/document-body.ts');
const { DocumentBody } = load('src/components/document-body.tsx');
const legacy = parseDocumentBody('First paragraph.\r\nSecond line.\r\n\r\nName\tRole\t\r\nJuan\tChairperson\t');
assert.deepEqual(legacy, [
  { type: 'paragraph', text: 'First paragraph.\nSecond line.' },
  { type: 'table', header: ['Name', 'Role'], rows: [['Juan', 'Chairperson']] },
]);
assert.deepEqual(parseDocumentBody('One\tline'), [{ type: 'paragraph', text: 'One  line' }]);
assert.deepEqual(parseDocumentBody('   '), []);
const rich = [
  { type: 'text', runs: [{ text: 'Styled text', bold: true, italic: true, underline: true }, { text: '\nPlain text' }] },
  { type: 'bullets', items: [[{ text: 'First item', bold: true }], [{ text: 'Second item', underline: true }]] },
  { type: 'grid', header: [[{ text: 'Name', bold: true }], [{ text: 'Role' }]], rows: [[[{ text: 'Juan', italic: true }], [{ text: 'Chairperson' }]]] },
  { type: 'grid', header: null, rows: [[[{ text: 'No header' }]]] },
];
assert.deepEqual(parseDocumentBody(serializeDocumentBody(rich)), rich, 'Formatting, bullets and tables survive storage');
assert.equal(serializeDocumentBody([]), '');
const divided = [
  { type: 'text', runs: [{ text: 'Before the line' }] },
  { type: 'divider' },
  { type: 'text', runs: [{ text: 'After the line' }] },
];
assert.deepEqual(parseDocumentBody(serializeDocumentBody(divided)), divided, 'Horizontal lines survive saving and reopening');
assert.equal(documentBodyHtml(divided), '<p>Before the line</p><hr class="document-divider"><p>After the line</p>');
assert.match(renderToStaticMarkup(React.createElement(DocumentBody, { blocks: divided })), /Before the line.*<hr class="document-divider"\/>.*After the line/);
assert.deepEqual(parseDocumentBody(serializeDocumentBody([{ type: 'divider' }])), [{ type: 'divider' }], 'A document containing only a line is preserved');
// Exercise pasted/wrapped editor markup without a browser dependency.
const previousElement = global.HTMLElement;
const previousNode = global.Node;
class EditorElement {
  constructor(tagName, children = []) {
    this.tagName = tagName;
    this.childNodes = children;
    this.style = { fontSize: '', color: '', fontWeight: '', fontStyle: '', textDecoration: '', textDecorationLine: '', textAlign: '', marginLeft: '' };
  }
  getAttribute() { return null; }
  querySelector(selector) {
    const tags = selector.split(',').map(tag => tag.trim().toUpperCase());
    for (const child of this.childNodes) {
      if (child instanceof EditorElement) {
        if (tags.includes(child.tagName)) return child;
        const nested = child.querySelector(selector);
        if (nested) return nested;
      }
    }
    return null;
  }
}
try {
  global.HTMLElement = EditorElement;
  global.Node = { TEXT_NODE: 3 };
  const { readDocumentEditor } = load('src/lib/data/document-editor.ts');
  const paragraph = text => new EditorElement('P', [{ nodeType: 3, textContent: text }]);
  const root = new EditorElement('DIV', [new EditorElement('DIV', [paragraph('Before the line'), new EditorElement('HR'), paragraph('After the line')])]);
  assert.deepEqual(readDocumentEditor(root), divided, 'Pasted and wrapped horizontal lines preserve surrounding text');
} finally {
  global.HTMLElement = previousElement;
  global.Node = previousNode;
}
const indented = [{ type: 'text', runs: [{ text: '\tIndented paragraph', bold: true }] }];
assert.deepEqual(parseDocumentBody(serializeDocumentBody(indented)), indented, 'Tab indentation survives storage');
assert.match(documentBodyHtml(indented), /<strong>\tIndented paragraph<\/strong>/);
assert.match(renderToStaticMarkup(React.createElement(DocumentBody, { blocks: indented })), /white-space:pre-wrap;tab-size:4/);
const styled = [
  { type: 'text', runs: [{ text: 'Visit UST', href: 'https://ust.edu.ph/', color: '#cc2244' }], align: 'center', indent: 2 },
  { type: 'numbers', items: [[{ text: 'Third item' }]], start: 3, align: 'right', indent: 1 },
  { type: 'grid', header: null, rows: [[[{ text: 'Aligned cell', color: '#123456' }]]], rowLayouts: [[{ align: 'right', indent: 1 }]] },
];
assert.deepEqual(parseDocumentBody(serializeDocumentBody(styled)), styled, 'Links, colors, list numbering and layout survive storage');
const styledHtml = documentBodyHtml(styled);
assert.match(styledHtml, /<blockquote><blockquote><p style="text-align:center;">/);
assert.match(styledHtml, /href="https:\/\/ust.edu.ph\/"/);
assert.match(styledHtml, /color:#cc2244/);
assert.match(styledHtml, /<ol style="text-align:right;" start="3">/);
const styledPublished = renderToStaticMarkup(React.createElement(DocumentBody, { blocks: styled }));
assert.match(styledPublished, /text-align:center;margin-left:48px/);
assert.match(styledPublished, /<ol start="3" class="document-numbers"/);
assert.match(styledPublished, /text-align:right;padding-left:36px/);
assert.equal(normalizeDocumentHref('ust.edu.ph'), 'https://ust.edu.ph/');
assert.equal(normalizeDocumentHref('comelec@ust.edu.ph'), 'mailto:comelec@ust.edu.ph');
assert.equal(normalizeDocumentHref('javascript:alert(1)'), null);
assert.equal(normalizeDocumentHref('data:text/html,test'), null);
assert.equal(normalizeDocumentColor('rgb(204, 34, 68)'), '#cc2244');
assert.equal(normalizeDocumentColor('#abc'), '#aabbcc');
assert.equal(normalizeDocumentColor('rgb(256, 0, 0)'), null);
const filled = [{ type: 'grid', header: [[{ text: 'Header' }]], rows: [[[], [{ text: 'Merged cell' }]]], headerLayouts: [{ backgroundColor: '#fff2cc' }], rowLayouts: [[{ backgroundColor: '#c9daf8' }, { align: 'right', backgroundColor: '#d9ead3' }]], rowSpans: [[{ rowSpan: 1, colSpan: 1 }, { rowSpan: 1, colSpan: 2 }]] }];
assert.deepEqual(parseDocumentBody(serializeDocumentBody(filled)), filled, 'Header, empty and merged cell fills survive storage');
assert.match(documentBodyHtml(filled), /<th style="background-color:#fff2cc">/);
assert.match(documentBodyHtml(filled), /<td style="background-color:#c9daf8"><br><\/td>/);
assert.match(documentBodyHtml(filled), /text-align:right;background-color:#d9ead3" colspan="2"/);
const filledPublished = renderToStaticMarkup(React.createElement(DocumentBody, { blocks: filled }));
assert.match(filledPublished, /background-color:#fff2cc/);
assert.match(filledPublished, /text-align:right;background-color:#d9ead3/);
assert.doesNotMatch(documentBodyHtml(rich), /background-color:/, 'Unfilled cells keep their default appearance');
assert.equal(parseDocumentBody(serializeDocumentBody([{ ...filled[0], headerLayouts: [{ backgroundColor: 'url(javascript:alert(1))' }] }]))[0].type, 'paragraph', 'Invalid cell fills are rejected');
const unsafeLink = [{ type: 'text', runs: [{ text: 'Unsafe link', href: 'javascript:alert(1)' }] }];
assert.doesNotMatch(documentBodyHtml(unsafeLink), /href=/);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(DocumentBody, { blocks: unsafeLink })), /href=/);
const merged = [
  { type: 'text', runs: [{ text: 'Large linked text', fontSize: 28, bold: true, href: 'https://ust.edu.ph/' }] },
  { type: 'grid', header: [[{ text: 'Merged heading', fontSize: 20 }]], rows: [[[{ text: 'Merged body', fontSize: 24 }]], [], [[{ text: 'Last row' }], [{ text: 'Last cell' }]]], headerSpans: [{ rowSpan: 1, colSpan: 2 }], rowSpans: [[{ rowSpan: 2, colSpan: 2 }], [], [{ rowSpan: 1, colSpan: 1 }, { rowSpan: 1, colSpan: 1 }]] },
];
assert.deepEqual(parseDocumentBody(serializeDocumentBody(merged)), merged, 'Font sizes and merged cells survive storage, including covered rows');
assert.match(documentBodyHtml(merged), /font-size:28px/);
assert.match(documentBodyHtml(merged), /rowspan="2" colspan="2"/);
assert.match(documentBodyHtml(merged), /<tr><\/tr>/, 'Covered rows must not gain extra cells');
const mergedPublished = renderToStaticMarkup(React.createElement(DocumentBody, { blocks: merged }));
assert.match(mergedPublished, /rowSpan="2" colSpan="2"/);
assert.match(mergedPublished, /font-size:24px/);
assert.equal(normalizeDocumentFontSize('18pt'), 24);
assert.equal(normalizeDocumentFontSize('28px'), 28);
assert.equal(normalizeDocumentFontSize('1000px'), null);
assert.equal(normalizeDocumentFontSize('expression(alert(1))'), null);
const { documentTableBounds } = load('src/lib/data/document-table.ts');
const a = {}, b = {}, c = {}, d = {};
const geometry = [
  { cell: a, row: 0, column: 0, rowSpan: 2, colSpan: 1 },
  { cell: b, row: 0, column: 1, rowSpan: 1, colSpan: 2 },
  { cell: c, row: 1, column: 1, rowSpan: 1, colSpan: 1 },
  { cell: d, row: 1, column: 2, rowSpan: 1, colSpan: 1 },
];
assert.deepEqual(documentTableBounds(geometry, [a, c]), { top: 0, left: 0, bottom: 2, right: 3 }, 'A merge rectangle expands to contain existing merged cells completely');
assert.deepEqual(documentTableBounds(geometry, [c, d]), { top: 1, left: 1, bottom: 2, right: 3 });
assert.equal(documentTableBounds(geometry, []), null);
const rendered = renderToStaticMarkup(React.createElement(DocumentBody, { blocks: parseDocumentBody(serializeDocumentBody(rich)) }));
assert.match(rendered, /<u><em><strong>Styled text<\/strong><\/em><\/u>/);
assert.match(rendered, /<ul class="document-bullets"[^>]*><li>/);
assert.equal((rendered.match(/<table /g) || []).length, 2);
assert.equal((rendered.match(/<thead>/g) || []).length, 1, 'Header settings carry through to the published document');
assert.match(rendered, /<em>Juan<\/em>/);
const markup = documentBodyHtml(legacy);
assert.match(markup, /First paragraph\.<br>Second line\./);
assert.match(markup, /<th>Name<\/th>/);
const hostile = [{ type: 'text', runs: [{ text: '<img src=x onerror=alert(1)> & "quote"', bold: true }] }];
const safe = documentBodyHtml(hostile);
assert.doesNotMatch(safe, /<img/);
assert.match(safe, /&lt;img/);
assert.doesNotMatch(renderToStaticMarkup(React.createElement(DocumentBody, { blocks: hostile })), /<img/);
const unsupported = '::document-body:v1::\n' + JSON.stringify([{ type: 'html', html: '<script>bad</script>' }]);
assert.equal(parseDocumentBody(unsupported)[0].type, 'paragraph', 'Unsupported stored markup is displayed literally');
assert.equal(parseDocumentBody('::document-body:v1::\ninvalid JSON')[0].type, 'paragraph');
console.log('Passed: legacy document/table compatibility, formatting and table storage, public rendering, header settings, escaped text, and malformed content fallback.');

assert.match(renderToStaticMarkup(React.createElement(DocumentBody, { blocks: [{ type: "text", runs: [{ text: "Default size" }] }] })), /font-size:12px/);
