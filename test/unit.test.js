'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { defaults, cleanCellMetadata, cleanOutputMetadata, buildEdits } = require('../src/cleaner');

test('language nameOnly preserves other metadata and never mutates input', () => {
  const { cleanNotebookMetadata, normalizeNotebook } = require('../src/cleaner');
  const metadata = { language_info: { name: 'python', version: '3.12', codemirror_mode: { name: 'ipython', version: 3 } }, kernelspec: { name: 'python3' }, custom: { keep: true } };
  const options = { ...defaults, languageInfoMode: 'nameOnly' };
  assert.deepEqual(cleanNotebookMetadata(metadata, defaults), metadata);
  const cleaned = cleanNotebookMetadata(metadata, options);
  assert.deepEqual(cleaned, { ...metadata, language_info: { name: 'python' } });
  assert.equal(metadata.language_info.version, '3.12');
  assert.deepEqual(cleanNotebookMetadata(cleaned, options), cleaned);
  assert.deepEqual(normalizeNotebook({ nbformat: 4, metadata, cells: [] }, options).metadata, cleaned);
  for (const value of [undefined, {}, { language_info: { version: '3.12' } }, { language_info: null }]) {
    assert.deepEqual(cleanNotebookMetadata(value, options), value);
  }
  assert.deepEqual(cleanNotebookMetadata(metadata, { ...options, clearNotebookMetadata: true, preserveNotebookMetadata: ['custom'] }), { custom: { keep: true } });
});

test('default policy removes only execution noise and supports opting out', () => {
  const original = { execution_count: 9, metadata: { execution: { started: 'now' }, ExecuteTime: { end: 'later' }, slideshow: { slide_type: 'slide' }, editable: false, custom: { keep: true }, collapsed: true } };
  const cleaned = cleanCellMetadata(original, defaults);
  assert.deepEqual(cleaned.metadata, { slideshow: { slide_type: 'slide' }, editable: false, custom: { keep: true }, collapsed: true });
  assert.deepEqual(cleanCellMetadata(original, { ...defaults, clearExecutionTiming: false, clearExecutionCounts: false }), original);
  assert.deepEqual(cleanCellMetadata(original, { ...defaults, clearCellMetadata: true }).metadata, {});
});

test('disk normalization shares defaults and preserves outputs and arbitrary metadata', () => {
  const { normalizeNotebook } = require('../src/cleaner');
  const original = { nbformat: 4, nbformat_minor: 5, metadata: { custom: 1 }, cells: [{ cell_type: 'code', id: 'stable', source: ['1'], execution_count: 9, metadata: { tags: ['x'], execution: { start: 1 } }, outputs: [{ output_type: 'execute_result', execution_count: 9, data: { 'image/png': 'abcdef' }, metadata: { 'image/png': { width: 100 } } }] }] };
  const normalized = normalizeNotebook(original);
  assert.equal(normalized.cells[0].execution_count, null);
  assert.equal(normalized.cells[0].outputs[0].execution_count, null);
  assert.deepEqual(normalized.cells[0].outputs[0].metadata, original.cells[0].outputs[0].metadata);
  assert.deepEqual(normalized.cells[0].outputs[0].data, original.cells[0].outputs[0].data);
  assert.deepEqual(normalized.metadata, original.metadata);
  assert.deepEqual(normalizeNotebook(normalized), normalized);
  assert.equal(original.cells[0].execution_count, 9);
});

test('counts cleared, tags/language/attachments/IDs preserved without mutation', () => {
  const original = { id: 'stable', execution_count: 42, metadata: { tags: ['solution'], vscode: { languageId: 'python' }, execution: { time: 1 } }, attachments: { x: { 'image/png': 'abc' } } };
  const clean = cleanCellMetadata(original, defaults);
  assert.equal(clean.execution_count, null);
  assert.deepEqual(clean.metadata, { tags: ['solution'], vscode: { languageId: 'python' } });
  assert.equal(clean.id, 'stable');
  assert.deepEqual(clean.attachments, original.attachments);
  assert.equal(original.execution_count, 42);
  assert.deepEqual(cleanCellMetadata(clean, defaults), clean);
});

test('output wrapper retains output type and live display identity', () => {
  const original = { outputType: 'execute_result', executionCount: 9, metadata: { width: 100 }, transient: { display_id: 'plot' } };
  assert.deepEqual(cleanOutputMetadata(original, defaults), { outputType: 'execute_result', executionCount: null, metadata: { width: 100 }, transient: { display_id: 'plot' } });
  assert.deepEqual(cleanOutputMetadata(original, { ...defaults, clearExecutionCounts: false, clearOutputMetadata: false }), original);
  assert.deepEqual(cleanOutputMetadata(original, { ...defaults, preserveOutputMetadata: ['width'] }).metadata, { width: 100 });
});

test('all disabled produces no edits', () => {
  const vscode = { WorkspaceEdit: class { set() { throw Error('unexpected edit'); } } };
  const nb = { metadata: {}, getCells: () => [{ metadata: {}, outputs: [] }] };
  assert.equal(buildEdits(vscode, nb, { ...defaults, clearNotebookMetadata: false, clearCellMetadata: false, clearExecutionCounts: false, clearOutputMetadata: false }).count, 0);
});
