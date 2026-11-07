'use strict';
const vscode = require('vscode');
const { defaults, buildEdits } = require('./cleaner');

function activate(context) {
  const log = vscode.window.createOutputChannel('Notebook Save Cleaner');
  const runningCells = new Set();
  const isNotebook = nb => nb?.notebookType === 'jupyter-notebook' && !nb.isClosed;
  const optionsFor = nb => {
    const config = vscode.workspace.getConfiguration('notebookSaveCleaner', nb.uri);
    return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, config.get(key, value)]));
  };

  context.subscriptions.push(log, vscode.workspace.onDidChangeNotebookDocument(event => {
    for (const change of event.cellChanges) {
      if (change.executionSummary === undefined) continue;
      const key = change.cell.document.uri.toString();
      const summary = change.executionSummary;
      if (summary.timing || typeof summary.success === 'boolean') runningCells.delete(key);
      else runningCells.add(key);
    }
    for (const change of event.contentChanges) {
      for (const cell of change.removedCells) runningCells.delete(cell.document.uri.toString());
    }
  }), vscode.workspace.onDidCloseNotebookDocument(nb => {
    for (const cell of nb.getCells()) runningCells.delete(cell.document.uri.toString());
  }));

  async function prepare(nb, token) {
    const options = optionsFor(nb);
    const version = nb.version;
    if (options.skipWhileRunning) {
      if (nb.getCells().some(cell => runningCells.has(cell.document.uri.toString()))) return { skipped: 'Notebook 正在执行，请完成后再保存。' };
      const jupyter = vscode.extensions.getExtension('ms-toolsai.jupyter');
      if (jupyter?.isActive && jupyter.exports?.kernels?.getKernel) {
        try {
          const kernel = await jupyter.exports.kernels.getKernel(nb.uri);
          if (kernel && !['idle', 'dead'].includes(kernel.status)) return { skipped: `内核状态为 ${kernel.status}，本次跳过清理。` };
        } catch (error) {
          log.appendLine(`无法读取内核状态，本次跳过：${error.message}`);
          return { skipped: '无法确认内核空闲，本次跳过清理。' };
        }
      }
    }
    if (token?.isCancellationRequested || nb.isClosed || nb.version !== version) return { skipped: 'Notebook 已变化，本次跳过清理。' };
    return buildEdits(vscode, nb, options);
  }

  context.subscriptions.push(vscode.workspace.onWillSaveNotebookDocument(event => {
    if (!isNotebook(event.notebook) || !vscode.workspace.isTrusted) return;
    const options = optionsFor(event.notebook);
    if (!options.enabled || options.trigger !== 'onSave') return;
    event.waitUntil(prepare(event.notebook, event.token).then(result => {
      if (result.skipped) log.appendLine(result.skipped);
      return result.edit || new vscode.WorkspaceEdit();
    }).catch(error => {
      log.appendLine(`清理失败：${error.stack || error}`);
      return new vscode.WorkspaceEdit();
    }));
  }));

  context.subscriptions.push(vscode.commands.registerCommand('notebookSaveCleaner.clean', async () => {
    const nb = vscode.window.activeNotebookEditor?.notebook;
    if (!isNotebook(nb)) return vscode.window.showInformationMessage('请先打开一个 Jupyter notebook。');
    const result = await prepare(nb);
    if (result.skipped) return vscode.window.showInformationMessage(result.skipped);
    if (!result.count) return vscode.window.showInformationMessage('Notebook 已符合清理规则。');
    if (await vscode.workspace.applyEdit(result.edit)) await nb.save();
  }));
  context.subscriptions.push(vscode.commands.registerCommand('notebookSaveCleaner.enable', async () => {
    if (!vscode.workspace.workspaceFolders?.length) return vscode.window.showInformationMessage('请先打开项目文件夹。');
    const uri = vscode.window.activeNotebookEditor?.notebook.uri || vscode.workspace.workspaceFolders[0].uri;
    await vscode.workspace.getConfiguration('notebookSaveCleaner', uri).update('enabled', true, vscode.ConfigurationTarget.WorkspaceFolder);
    vscode.window.showInformationMessage('当前项目已启用 notebook 保存前清理。');
  }));
}
module.exports = { activate };
