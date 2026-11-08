# 开发与测试

## 环境与安装

需要 Node.js 22 或更新版本、npm、桌面版 VS Code，以及用于集成测试的 Git。运行扩展本身不需要额外安装 Node.js 或 Python。

在仓库根目录执行：

```sh
npm ci
npm test
npm run package
```

`npm test` 运行转换逻辑的单元测试，不会启动 VS Code。`npm run package` 使用项目内的 `@vscode/vsce` 生成 VSIX，不会上传到 Marketplace。

安装生成的包后，通过 **Developer: Reload Window** 加载新版本。安装包名称由 `package.json` 中的版本决定：

```sh
code --install-extension notebook-save-cleaner-0.1.2.vsix --force
```

## 代码结构

| 路径 | 用途 |
| --- | --- |
| `src/cleaner.js` | 默认规则、VS Code notebook 编辑及 nbformat JSON 规范化 |
| `src/extension.js` | 保存事件、命令、设置读取、运行状态检查和日志 |
| `scripts/normalize.js` | 显式指定文件的一次性规范化工具 |
| `test/unit.test.js` | 清理规则、保留字段和幂等性测试 |
| `test/integration.js` | 真实 VS Code 保存事件及序列化测试 |

修改默认值时，请同步更新 `src/cleaner.js`、`package.json`、README 和相关测试。VS Code 的 cell/output metadata 包含序列化器包装字段，不能直接等同于磁盘上的 nbformat metadata。

## VS Code 集成测试

在独立配置和独立工作区运行，避免影响日常编辑窗口。测试会在工作区创建 notebook、Git 仓库及测试提交，因此**不要把实际项目传给测试入口**。

以下 PowerShell 命令从扩展仓库根目录执行；每次创建一个新的测试目录：

```powershell
$extensionRoot = (Get-Location).Path
$runRoot = Join-Path $extensionRoot ('.test-work/run-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force "$runRoot/workspace", "$runRoot/extensions" | Out-Null

code --new-window --disable-extensions --disable-workspace-trust `
  --skip-welcome --skip-release-notes `
  --user-data-dir "$runRoot/profile" `
  --extensions-dir "$runRoot/extensions" `
  --extensionDevelopmentPath "$extensionRoot" `
  --extensionTestsPath "$extensionRoot/test/integration.js" `
  "$runRoot/workspace"
```

测试完成后查看 `$runRoot/workspace/result.json`，`passed` 应为 `true`。这里禁用第三方扩展并使用测试 controller；真实 Jupyter 内核行为仍需手动验证。

测试入口目前通过 `morty-local.notebook-save-cleaner` 激活扩展。正式更改 publisher 或扩展名称时，需要同时更新测试中的扩展 ID。

## 人工验证

- 完整运行、保存并建立 Git 基准后，重复执行相同结果，确认没有运行噪声差异。
- 修改代码或实际输出，确认 Git 仍能检测到变化。
- 保存并重新打开含图片、HTML、报错、附件和 widgets 的 notebook，检查内容及显示。
- 检查手动保存、自动保存、运行中保存及结束后再次保存。
- 检查手动清理、禁用设置、撤销操作和较大 notebook 的表现。

## 发布前检查

- 确定真实 Publisher ID，更新扩展标识及相关测试。
- 提交源码并配置仓库、反馈地址；README 不应链接尚不存在的发布页面。
- 验证声明的最低 VS Code 版本，或据实调整 `engines.vscode`。
- 同步版本号、锁文件与 CHANGELOG，运行单元测试和集成测试。
- 使用 `npx vsce ls` 检查打包文件，再生成 VSIX 并测试安装。
- 检查 `.test-work`、测试 notebook、备份及本地配置没有进入安装包。

当前使用 `--allow-missing-repository --no-rewrite-relative-links` 允许尚无远程仓库时本地打包。设置正式仓库地址后，应移除这两个参数，让发布包中的文档链接指向在线仓库；本地测试包的相对文档链接不能保证在扩展详情页打开。发布身份、图标、Marketplace 页面和上传流程不由测试脚本创建。
