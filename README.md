# Notebook Save Cleaner

**English** | [简体中文](README.zh-CN.md)

Clean execution counts and timing metadata when saving Jupyter notebooks in VS Code, while keeping code, Markdown, and outputs. Reduce Git diffs caused by rerunning cells.

This extension changes the notebook saved on disk. It does not require Python, nbstripout, or Git filters, and never stages or commits files. This is an early testing release.

## Default behavior

Automatic cleaning is disabled until you enable it for a project. Once enabled:

| Content | Default behavior |
| --- | --- |
| Cell and output `execution_count` | Set to `null` |
| Cell metadata `execution` and `ExecuteTime` | Remove both fields and their contents |
| Code, Markdown, and raw cells | Preserve |
| Text, tables, images, HTML, and error output data | Preserve |
| Kernel, language, tags, widgets, and image dimensions | Preserve |
| Other metadata, including unknown tool fields | Preserve |
| Attachments, cell IDs, and cell order | Preserve |

Disable `clearExecutionTiming` to keep timing records. Cleaning does not restore information previously removed by other tools.

## Install and enable

Local VSIX installation is currently available. These instructions do not imply that the extension is already published on Marketplace.

1. In the VS Code Extensions view, choose **Install from VSIX…** from the `…` menu and select the package.
2. Run **Developer: Reload Window** after installing or upgrading.
3. Open a project folder and an `.ipynb` file in the Jupyter notebook editor.
4. Run **Notebook Save Cleaner: Enable for This Workspace** from the Command Palette.
5. Wait for execution to finish, then save with `Ctrl+S` (or `Cmd+S` on macOS).

A trusted workspace is required. Saving an `.ipynb` as plain JSON in the text editor does not trigger notebook cleaning.

Alternatively, add this to the project's `.vscode/settings.json`:

```json
{
  "notebookSaveCleaner.enabled": true
}
```

The enable command updates settings for the active notebook's workspace folder, or the first workspace folder when no notebook is active. It does not enable cleaning in other projects.

## Commands

| Command Palette entry | Action |
| --- | --- |
| `Notebook Save Cleaner: Enable for This Workspace` | Enable automatic cleaning for the project |
| `Notebook Save Cleaner: Clean Current Notebook` | Clean the active notebook using its settings; save if cleaning makes changes |

Manual cleaning works even when `enabled` is `false`, but still respects cleaning settings and execution checks. Set `enabled` to `false` or `trigger` to `manual` to stop automatic cleaning.

## Settings

Search for `notebookSaveCleaner` in VS Code settings. All options support workspace-folder configuration. Each key below has the prefix `notebookSaveCleaner.`.

| Key | Default | Description |
| --- | --- | --- |
| `enabled` | `false` | Enable automatic cleaning |
| `trigger` | `"onSave"` | `onSave` or `manual`; on-save cleaning includes explicit saves and Auto Save |
| `clearExecutionCounts` | `true` | Clear cell and output execution counts |
| `clearExecutionTiming` | `true` | Remove cell metadata `execution` and `ExecuteTime` |
| `languageInfoMode` | `"preserve"` | Keep full language information, or use `nameOnly` to keep only `language_info.name` |
| `clearNotebookMetadata` | `false` | Keep only allowed notebook metadata keys when enabled |
| `preserveNotebookMetadata` | `["kernelspec", "language_info", "widgets"]` | Notebook metadata allowlist |
| `clearCellMetadata` | `false` | Keep only allowed cell metadata keys when enabled |
| `preserveCellMetadata` | `["tags", "vscode"]` | Cell metadata allowlist |
| `clearOutputMetadata` | `false` | Keep only allowed output metadata keys when enabled; output data is retained |
| `preserveOutputMetadata` | `[]` | Output metadata allowlist |
| `skipWhileRunning` | `true` | Skip cleaning when execution is detected or the kernel is not idle |

Allowlists apply only when the corresponding `clear*Metadata` option is enabled. They match top-level keys, without wildcard or nested-path support. Timing cleanup is independent: `execution` is still removed when `clearExecutionTiming` is `true`, even if it appears in the cell allowlist.

To avoid diffs from language versions and derived editor fields:

```json
{
  "notebookSaveCleaner.enabled": true,
  "notebookSaveCleaner.languageInfoMode": "nameOnly"
}
```

On save, language information becomes, for example, `{"name":"python"}`. This option does not affect kernel information or other metadata. The default, `preserve`, keeps existing behavior. Missing or invalid language names are not invented. If notebook metadata cleanup removes `language_info` via its allowlist, it takes precedence; the field is not added back. Switching modes can create a one-time diff to review and establish as a new baseline.

To clear only counts while preserving timing and all metadata:

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

## Using Git

Run the notebook, wait for completion, save, review the changes, and commit a baseline. Subsequent reruns should produce no new diff if outputs and other retained fields remain unchanged.

Changes to code, Markdown, random or time-dependent outputs, training results, images, tags, widget state, and other retained metadata remain visible. A kernel may also populate language information on its first run or update environment details later.

The extension does not hide these changes. If you also use a Git clean filter, make sure its policy matches your intended behavior: filters can make staged content differ from local files. This extension does not install, remove, or configure Git filters.

## Saving during execution and known limitations

- When running cells are detected, cleaning is skipped but saving continues. Save again after execution ends; the extension does not schedule another cleanup when the kernel becomes idle.
- Execution detection uses VS Code events and the kernel API of an already-active Jupyter extension. Other kernel providers, or execution started before activation, may not be fully detected.
- Concurrent notebook changes cause cleaning to be skipped. VS Code may also skip save participants during shutdown or when their time budget is exhausted. This extension is not a commit validator.
- Cleaning output counts or metadata replaces affected cells through the VS Code API. Source and output data are preserved, but output views may be rebuilt.
- Large notebooks, interactive widgets, remote development, and different VS Code versions need further real-world testing. Browser-based VS Code support is not currently declared.

If counts remain after saving, check that cleaning is enabled and execution has finished. Open **View → Output → Notebook Save Cleaner** for skip and error messages. Runtime notifications and logs are currently in Chinese.

## Data and privacy

The extension adds no telemetry, uploads no notebook content, and makes no network requests of its own. Cleaning runs in the extension host through VS Code's notebook API. Execution checks may call an active Jupyter extension. The extension does not execute notebook code.

## Development, batch normalization, and feedback

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and testing instructions and [CHANGELOG.md](CHANGELOG.md) for release notes. These supporting documents are currently in Chinese.

The source repository includes a one-time normalization script using the extension's default policy:

```sh
node scripts/normalize.js path/to/notebook.ipynb another/notebook.ipynb
```

The script supports nbformat 4 and writes changes directly to the specified files, potentially changing JSON formatting. It does not read VS Code settings, check execution state, or run Git commands. Use it after saving files and finishing execution, then review the diff.

For bug reports, include VS Code, Jupyter, and extension versions, relevant settings, reproduction steps, and a minimal notebook without sensitive content. For execution-related issues, describe the kernel provider and whether Auto Save is enabled.

## Author

[morty6688](https://github.com/morty6688)

## License

[MIT](LICENSE)
