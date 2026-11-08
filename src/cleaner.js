'use strict';
const { isDeepStrictEqual } = require('node:util');

const defaults = {
  enabled: false, trigger: 'onSave', clearExecutionCounts: true,
  clearExecutionTiming: true, languageInfoMode: 'preserve',
  clearNotebookMetadata: false, preserveNotebookMetadata: ['kernelspec', 'language_info', 'widgets'],
  clearCellMetadata: false, preserveCellMetadata: ['tags', 'vscode'],
  clearOutputMetadata: false, preserveOutputMetadata: [], skipWhileRunning: true
};

function keepKeys(metadata, keys) {
  return Object.fromEntries(Object.entries(metadata || {}).filter(([key]) => keys.includes(key)));
}

function cleanNotebookMetadata(metadata, options) {
  const result = options.clearNotebookMetadata
    ? keepKeys(metadata, options.preserveNotebookMetadata)
    : metadata;
  const language = result?.language_info;
  if (options.languageInfoMode === 'nameOnly' && language &&
      typeof language === 'object' && !Array.isArray(language) &&
      typeof language.name === 'string' && language.name.length > 0) {
    return { ...result, language_info: { name: language.name } };
  }
  return result;
}

// VS Code's ipynb serializer wraps nbformat metadata inside another metadata object.
function cleanCellMetadata(metadata, options) {
  const result = { ...metadata };
  if (options.clearExecutionCounts && Object.hasOwn(result, 'execution_count')) result.execution_count = null;
  if (options.clearCellMetadata) result.metadata = keepKeys(result.metadata, options.preserveCellMetadata);
  if (options.clearExecutionTiming && result.metadata) {
    result.metadata = { ...result.metadata };
    delete result.metadata.execution;
    delete result.metadata.ExecuteTime;
  }
  return result;
}

function cleanOutputMetadata(metadata, options) {
  const result = { ...metadata };
  if (options.clearExecutionCounts && Object.hasOwn(result, 'executionCount')) result.executionCount = null;
  if (options.clearOutputMetadata && Object.hasOwn(result, 'metadata')) {
    result.metadata = keepKeys(result.metadata, options.preserveOutputMetadata);
  }
  return result;
}

function buildEdits(vscode, notebook, options) {
  const edits = [];
  if (options.clearNotebookMetadata || options.languageInfoMode === 'nameOnly') {
    const metadata = { ...notebook.metadata, metadata: cleanNotebookMetadata(notebook.metadata.metadata, options) };
    if (!isDeepStrictEqual(metadata, notebook.metadata)) edits.push(vscode.NotebookEdit.updateNotebookMetadata(metadata));
  }
  for (const cell of notebook.getCells()) {
    const metadata = cleanCellMetadata(cell.metadata, options);
    const outputs = cell.outputs.map(output => ({ output, metadata: cleanOutputMetadata(output.metadata, options) }));
    const outputChanged = outputs.some(item => !isDeepStrictEqual(item.metadata, item.output.metadata || {}));
    if (outputChanged) {
      // Stable NotebookEdit has no output-metadata-only edit. Replace only affected cells,
      // preserving source, language, attachments, output bytes, ordering and summary.
      const data = new vscode.NotebookCellData(cell.kind, cell.document.getText(), cell.document.languageId);
      data.metadata = metadata;
      data.outputs = outputs.map(({ output, metadata }) => new vscode.NotebookCellOutput(output.items, metadata));
      data.executionSummary = cell.executionSummary ? { ...cell.executionSummary } : undefined;
      if (options.clearExecutionCounts && data.executionSummary) delete data.executionSummary.executionOrder;
      edits.push(vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(cell.index, cell.index + 1), [data]));
    } else if (!isDeepStrictEqual(metadata, cell.metadata)) {
      edits.push(vscode.NotebookEdit.updateCellMetadata(cell.index, metadata));
    }
  }
  const edit = new vscode.WorkspaceEdit();
  if (edits.length) edit.set(notebook.uri, edits);
  return { edit, count: edits.length };
}

// Apply the same policy to nbformat JSON for one-time normalization outside VS Code.
function normalizeNotebook(notebook, options = defaults) {
  const result = structuredClone(notebook);
  if (result.nbformat !== 4 || !Array.isArray(result.cells)) throw new Error('Only nbformat 4 notebooks are supported');
  result.metadata = cleanNotebookMetadata(result.metadata, options);
  for (const cell of result.cells) {
    const clean = cleanCellMetadata(cell, options);
    Object.assign(cell, clean);
    for (const output of cell.outputs || []) {
      if (options.clearExecutionCounts && Object.hasOwn(output, 'execution_count')) output.execution_count = null;
      if (options.clearOutputMetadata && Object.hasOwn(output, 'metadata')) output.metadata = keepKeys(output.metadata, options.preserveOutputMetadata);
    }
  }
  return result;
}

module.exports = { defaults, buildEdits, cleanCellMetadata, cleanOutputMetadata, cleanNotebookMetadata, normalizeNotebook };
