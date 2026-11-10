'use strict';
const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildEdits, defaults } = require('../src/cleaner');

async function run() {
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const resultPath = path.join(root, 'result.json');
  try {
    await vscode.extensions.getExtension('morty6688.notebook-save-cleaner').activate();
    const config = vscode.workspace.getConfiguration('notebookSaveCleaner');
    await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
    await config.update('skipWhileRunning', true, vscode.ConfigurationTarget.Workspace);
    const original = {
      nbformat: 4, nbformat_minor: 5,
      metadata: { kernelspec: { name: 'python3', display_name: 'Python 3', language: 'python' }, language_info: { name: 'python', version: '3.12', file_extension: '.py' }, widgets: { state: {} }, noise: 42 },
      cells: [
        { cell_type: 'code', id: 'stable-code', metadata: { tags: ['keep'], noise: 1, execution: { 'iopub.execute_input': 'now' }, ExecuteTime: { start_time: 'now' } }, source: ['print(2)'], execution_count: 9, outputs: [
          { output_type: 'execute_result', execution_count: 9, data: { 'text/plain': ['2'], 'text/html': ['<b>2</b>'] }, metadata: { noise: true } },
          { output_type: 'stream', name: 'stdout', text: ['hello\n'] },
          { output_type: 'display_data', data: { 'image/png': 'aGVsbG8=' }, metadata: { width: 1 } },
          { output_type: 'error', ename: 'ValueError', evalue: 'test', traceback: ['trace'] }
        ] },
        { cell_type: 'markdown', id: 'stable-md', source: ['![x](attachment:x.png)'], metadata: { tags: ['md'], noise: 2 }, attachments: { 'x.png': { 'image/png': 'aGVsbG8=' } } },
        { cell_type: 'raw', id: 'stable-raw', source: ['raw content'], metadata: { noise: 3 } }
      ]
    };
    const uri = vscode.Uri.file(path.join(root, 'test.ipynb'));
    await fs.writeFile(uri.fsPath, JSON.stringify(original));
    const nb = await vscode.workspace.openNotebookDocument(uri);
    await vscode.window.showNotebookDocument(nb);
    const dirty = new vscode.WorkspaceEdit();
    dirty.set(uri, [vscode.NotebookEdit.updateNotebookMetadata({ ...nb.metadata, metadata: { ...nb.metadata.metadata, extra: 'dirty' } })]);
    await vscode.workspace.applyEdit(dirty);
    assert.equal(await nb.save(), true);
    const saved = JSON.parse(await fs.readFile(uri.fsPath, 'utf8'));
    assert.equal(saved.cells[0].execution_count, null);
    assert.equal(saved.cells[0].outputs[0].execution_count, null);
    assert.deepEqual(saved.cells[0].outputs[0].metadata, { noise: true });
    assert.deepEqual(saved.cells[0].outputs[2].metadata, { width: 1 });
    assert.deepEqual(saved.cells[0].outputs[0].data, original.cells[0].outputs[0].data);
    assert.deepEqual(saved.cells[0].outputs[1], original.cells[0].outputs[1]);
    assert.deepEqual(saved.cells[0].outputs[2].data, original.cells[0].outputs[2].data);
    assert.deepEqual(saved.cells[0].outputs[3], original.cells[0].outputs[3]);
    assert.deepEqual(saved.cells[1].attachments, original.cells[1].attachments);
    assert.equal(saved.cells[2].cell_type, 'raw');
    assert.deepEqual(saved.metadata.kernelspec, original.metadata.kernelspec);
    assert.deepEqual(saved.metadata.widgets, original.metadata.widgets);
    assert.deepEqual(saved.cells[0].metadata, { tags: ['keep'], noise: 1 });
    assert.equal(saved.metadata.noise, 42);
    assert.equal(buildEdits(vscode, nb, defaults).count, 0, 'cleaning should be idempotent');

    assert.deepEqual(saved.metadata.language_info, { name: 'python' }, 'default keeps only language name');
    await config.update('languageInfoMode', 'preserve', vscode.ConfigurationTarget.Workspace);
    const restoreLanguage = new vscode.WorkspaceEdit();
    restoreLanguage.set(uri, [vscode.NotebookEdit.updateNotebookMetadata({ ...nb.metadata, metadata: { ...nb.metadata.metadata, language_info: original.metadata.language_info } })]);
    await vscode.workspace.applyEdit(restoreLanguage); await nb.save();
    assert.deepEqual(JSON.parse(await fs.readFile(uri.fsPath, 'utf8')).metadata.language_info, original.metadata.language_info, 'explicit preserve retains details');
    await config.update('languageInfoMode', 'nameOnly', vscode.ConfigurationTarget.Workspace);
    await vscode.commands.executeCommand('notebookSaveCleaner.clean');
    const nameOnly = JSON.parse(await fs.readFile(uri.fsPath, 'utf8'));
    assert.deepEqual(nameOnly.metadata.language_info, { name: 'python' });
    assert.deepEqual(nameOnly.metadata.kernelspec, saved.metadata.kernelspec);
    assert.deepEqual(nameOnly.cells, saved.cells, 'language cleanup must not change cells or outputs');

    const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    git('init', '-q'); git('config', 'user.name', 'Cleaner Test'); git('config', 'user.email', 'test@example.invalid');
    git('add', 'test.ipynb'); git('commit', '-qm', 'baseline');
    const cell = nb.cellAt(0);
    const replacement = new vscode.NotebookCellData(cell.kind, cell.document.getText(), cell.document.languageId);
    replacement.metadata = { ...cell.metadata, execution_count: 123, metadata: { ...cell.metadata.metadata, execution: { 'iopub.execute_input': 'later' }, ExecuteTime: { start_time: 'later' } } };
    replacement.outputs = cell.outputs.map((o, i) => new vscode.NotebookCellOutput(o.items, { ...o.metadata, ...(i === 0 ? { executionCount: 123 } : {}) }));
    const rerun = new vscode.WorkspaceEdit();
    rerun.set(uri, [
      vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(0, 1), [replacement]),
      vscode.NotebookEdit.updateNotebookMetadata({ ...nb.metadata, metadata: { ...nb.metadata.metadata, language_info: { name: 'python', version: '3.13', codemirror_mode: { name: 'ipython', version: 3 }, mimetype: 'text/x-python' } } })
    ]);
    await vscode.workspace.applyEdit(rerun);
    await nb.save();
    assert.equal(git('status', '--porcelain', '--', 'test.ipynb'), '', 'same outputs rerun should be Git-clean WITHOUT git add or filters');

    // Real source changes must remain detectable.
    const source = new vscode.WorkspaceEdit();
    const doc = nb.cellAt(0).document;
    source.insert(doc.uri, new vscode.Position(0, 0), '# real change\n');
    await vscode.workspace.applyEdit(source); await nb.save();
    assert.match(git('status', '--porcelain', '--', 'test.ipynb'), /M/);
    git('add', 'test.ipynb'); git('commit', '-qm', 'source baseline');
    const changedCell = nb.cellAt(0);
    const changedOutput = new vscode.NotebookCellData(changedCell.kind, changedCell.document.getText(), changedCell.document.languageId);
    changedOutput.metadata = { ...changedCell.metadata, execution_count: 456 };
    changedOutput.outputs = [new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text('different result')], { outputType: 'execute_result', executionCount: 456, metadata: {} })];
    const outputEdit = new vscode.WorkspaceEdit();
    outputEdit.set(uri, [vscode.NotebookEdit.replaceCells(new vscode.NotebookRange(0, 1), [changedOutput])]);
    await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);
    await vscode.workspace.applyEdit(outputEdit); await nb.save();
    assert.equal(JSON.parse(await fs.readFile(uri.fsPath, 'utf8')).cells[0].execution_count, 456, 'disabled must not clean');
    await vscode.commands.executeCommand('notebookSaveCleaner.clean');
    const manualSaved = JSON.parse(await fs.readFile(uri.fsPath, 'utf8'));
    assert.equal(manualSaved.cells[0].execution_count, null);
    assert.deepEqual(manualSaved.cells[0].outputs[0].data['text/plain'], ['different result']);
    assert.match(git('status', '--porcelain', '--', 'test.ipynb'), /M/, 'real output changes remain visible');

    await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
    const controller = vscode.notebooks.createNotebookController('cleaner-test', 'jupyter-notebook', 'Cleaner Test');
    controller.supportedLanguages = ['python'];
    controller.supportsExecutionOrder = true;
    await vscode.commands.executeCommand('notebook.selectKernel', { id: controller.id, extension: 'morty6688.notebook-save-cleaner' });
    const execution = controller.createNotebookCellExecution(nb.cellAt(0));
    execution.start(Date.now()); execution.executionOrder = 789;
    await execution.replaceOutput([new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text('running')], { outputType: 'execute_result', executionCount: 789, metadata: {} })]);
    // Let extension-host notebook change notifications arrive before saving.
    await new Promise(resolve => setTimeout(resolve, 150));
    await nb.save();
    const duringRun = JSON.parse(await fs.readFile(uri.fsPath, 'utf8'));
    assert.equal(duringRun.cells[0].outputs[0].execution_count, 789, 'running cell must not be replaced/cleaned');
    execution.end(true, Date.now());
    await new Promise(resolve => setTimeout(resolve, 150));
    await nb.save();
    assert.equal(JSON.parse(await fs.readFile(uri.fsPath, 'utf8')).cells[0].outputs[0].execution_count, null, 'clean after execution ends');
    controller.dispose();
    await fs.writeFile(resultPath, JSON.stringify({ passed: true, checks: ['real save hook', 'cell/output counts', 'output bytes and types', 'attachments/raw cells', 'kernel/tags/widgets', 'idempotence', 'Git clean after simulated rerun without add', 'real source and output changes visible', 'disabled and manual command', 'skip active execution and clean after completion'] }, null, 2));
  } catch (error) {
    await fs.writeFile(resultPath, JSON.stringify({ passed: false, error: error.stack }, null, 2));
    throw error;
  }
}
module.exports = { run };
