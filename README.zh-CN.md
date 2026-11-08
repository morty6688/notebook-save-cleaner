# Notebook Save Cleaner

[English](README.md) | **简体中文**

在 VS Code 保存 Jupyter notebook 时清理执行计数和执行时间，保留代码、Markdown 与运行结果，减少重复运行产生的 Git 差异。

扩展直接清理本地保存的 `.ipynb` 文件，不需要 Python、nbstripout 或 Git 过滤器，也不会自动暂存或提交文件。当前版本为早期测试版本。

## 默认行为

自动清理默认关闭，需要按项目启用。启用后的默认规则如下：

| 内容 | 默认行为 |
| --- | --- |
| 单元格与输出中的 `execution_count` | 设为 `null` |
| 单元格 metadata 的 `execution`、`ExecuteTime` | 删除这两个字段及其内容 |
| 代码、Markdown、raw cell | 保留 |
| 文本、表格、图片、HTML、报错等输出数据 | 保留 |
| 内核、语言、tags、widgets、图片尺寸等 metadata | 保留 |
| 未知工具的其他 metadata | 保留 |
| 附件、单元格 ID 和顺序 | 保留 |

如需保存执行时间，可关闭 `clearExecutionTiming`。清理不会恢复此前已经被其他工具删除的信息。

## 安装与启用

目前提供本地 VSIX 安装方式；本文不表示扩展已经上架 Marketplace。

1. 在 VS Code 扩展视图的 `…` 菜单中选择 **Install from VSIX…**，选择安装包。
2. 安装或升级后执行 **Developer: Reload Window**。
3. 打开项目文件夹与其中的 `.ipynb`，使用 Jupyter notebook 编辑器。
4. 从命令面板执行 **Notebook Save Cleaner: Enable for This Workspace**。
5. 等待单元格运行结束，再按 `Ctrl+S` 保存。

需要受信任的工作区。将 `.ipynb` 作为普通 JSON 文本打开并保存，不会触发 notebook 保存前清理。

也可在项目 `.vscode/settings.json` 中添加：

```json
{
  "notebookSaveCleaner.enabled": true
}
```

启用命令修改当前 notebook 所属工作区文件夹的设置；没有活动 notebook 时使用第一个工作区文件夹。其他项目不会因此自动启用。

## 命令

| 命令面板名称 | 作用 |
| --- | --- |
| `Notebook Save Cleaner: Enable for This Workspace` | 为当前项目启用保存前清理 |
| `Notebook Save Cleaner: Clean Current Notebook` | 按当前设置清理活动 notebook；有清理修改时保存 |

手动清理不要求 `enabled` 为 `true`，但仍遵循清理选项和运行状态检查。要暂停自动清理，将 `enabled` 设为 `false`，或将 `trigger` 设为 `manual`。

## 配置

在 VS Code 设置中搜索 `notebookSaveCleaner`。所有选项均支持工作区文件夹级别配置。

下表中的键都以 `notebookSaveCleaner.` 开头：

| 配置键 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | 是否启用自动清理 |
| `trigger` | `"onSave"` | `onSave` 或 `manual`；保存触发包括手动保存和自动保存 |
| `clearExecutionCounts` | `true` | 清理单元格及输出执行计数 |
| `clearExecutionTiming` | `true` | 删除 cell metadata 中的 `execution` 和 `ExecuteTime` |
| `languageInfoMode` | `"preserve"` | `preserve` 保留完整语言信息；`nameOnly` 仅保留 `language_info.name` |
| `clearNotebookMetadata` | `false` | 开启后，仅保留 notebook metadata 白名单中的键 |
| `preserveNotebookMetadata` | `["kernelspec", "language_info", "widgets"]` | notebook metadata 白名单 |
| `clearCellMetadata` | `false` | 开启后，仅保留 cell metadata 白名单中的键 |
| `preserveCellMetadata` | `["tags", "vscode"]` | cell metadata 白名单 |
| `clearOutputMetadata` | `false` | 开启后，仅保留 output metadata 白名单中的键；不删除输出数据 |
| `preserveOutputMetadata` | `[]` | output metadata 白名单 |
| `skipWhileRunning` | `true` | 检测到执行中或内核非空闲时跳过清理 |

三个 metadata 白名单仅在对应的 `clear*Metadata` 开关开启时生效，匹配顶层键，不支持通配符或嵌套路径。执行时间清理是独立规则：即使将 `execution` 放入白名单，只要 `clearExecutionTiming` 仍为 `true`，它也会被删除。

要避免语言版本及编辑器派生字段造成差异，可设置：

```json
{
  "notebookSaveCleaner.enabled": true,
  "notebookSaveCleaner.languageInfoMode": "nameOnly"
}
```

保存后，`language_info` 会变为例如 `{"name":"python"}`；内核信息与其他 metadata 不受此选项影响。默认 `preserve` 保持原行为。缺少有效 `name` 时不创建或猜测语言信息。如果开启 notebook metadata 白名单清理却未保留 `language_info`，白名单删除优先，不会重新添加该字段。首次切换模式会产生一次清理差异，需要审阅后建立新基准。

例如，只清理执行计数，保留执行时间和全部 metadata：

```json
{
  "notebookSaveCleaner.enabled": true,
  "notebookSaveCleaner.clearExecutionCounts": true,
  "notebookSaveCleaner.clearExecutionTiming": false,
  "notebookSaveCleaner.clearNotebookMetadata": false,
  "notebookSaveCleaner.clearCellMetadata": false,
  "notebookSaveCleaner.clearOutputMetadata": false
}
```

## 配合 Git 使用

建议先完成一次运行，等待结束、保存并审阅差异，再提交作为基准。之后重复运行相同代码，只要输出和其他保留字段不变，保存后通常不会产生新差异。

以下变化仍会正常显示：

- 代码或 Markdown 修改。
- 随机数、当前时间、训练结果、图片等实际输出变化。
- 内核首次补齐 `language_info`，或更换环境后的语言、内核信息变化。
- tags、控件状态或其他保留的 metadata 变化。

扩展不会隐藏这些差异。如果同时使用 Git clean 过滤器，应确认两者规则一致；过滤器可能令暂存区内容与本地文件不同。扩展本身不会安装、卸载或修改 Git 过滤器。

## 运行中保存与已知限制

- 默认在检测到执行中时跳过清理，保存本身仍会继续。结束后请再次保存；不会在内核空闲时主动安排一次清理。
- 运行状态来自 VS Code 执行事件，以及已激活 Jupyter 扩展提供的 kernel API。其他 kernel provider 或扩展激活前已经开始的执行，可能无法被完整识别。
- 清理期间 notebook 发生变化时，会放弃本次清理。VS Code 在关闭或保存事件超时等情况下也可能跳过保存处理，因此本扩展不是提交校验器。
- 清理输出执行计数或输出 metadata 时，会通过 VS Code API 替换受影响的单元格。源代码和输出数据会保留，但输出显示可能重建。
- 大型 notebook、交互式 widgets、远程开发和不同 VS Code 版本仍需更多实际使用验证；目前未声明支持浏览器版 VS Code。

若保存后仍有执行计数，先检查项目是否启用、是否完成运行，并在 **View → Output** 中选择 **Notebook Save Cleaner** 查看跳过或失败原因。

## 数据与隐私

扩展不添加遥测，不上传 notebook 内容，也不自行发起网络请求。清理通过 VS Code 的 notebook API 在扩展宿主内完成；运行状态检查可能调用已激活的 Jupyter 扩展。扩展不执行 notebook 中的代码。

## 开发、批量规范化与反馈

开发和测试方法见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本变化见 [CHANGELOG.md](CHANGELOG.md)。

源码仓库提供一次性规范化脚本，使用与扩展相同的默认清理规则：

```sh
node scripts/normalize.js path/to/notebook.ipynb another/notebook.ipynb
```

该脚本支持 nbformat 4，会直接写回指定文件并可能调整 JSON 排版；不会读取 VS Code 设置、判断内核状态或执行 Git 操作。请在文件保存且运行结束后使用，执行后审阅差异。

报告问题时，请提供 VS Code、Jupyter 扩展和本扩展的版本，相关设置、复现步骤及去除敏感内容的最小 notebook。涉及运行问题时，请说明是否启用了自动保存以及使用的 kernel provider。

## 作者

[morty6688](https://github.com/morty6688)

## License

[MIT](LICENSE)
