# Changelog

以下记录对应本地测试版本，不表示这些版本已经发布到 Marketplace。

## 0.1.2

### Added

- `languageInfoMode` 设置：默认 `preserve` 保留完整语言信息，可选 `nameOnly` 仅保留 `language_info.name`。
- 保存集成测试覆盖语言字段补齐后再次清理，保持代码、输出和其他 metadata。

### Documentation

- 面向公开用户重写 README，说明默认行为、全部配置、Git 基准、隐私及已知限制。
- 添加开发测试指南和版本记录。
- README 使用英文首页与中文版本互相切换，作者署名统一为 `morty6688`。

## 0.1.1

### Changed

- 默认保留全部 notebook、cell 和 output metadata，仅清理执行计数和明确的执行时间字段。
- 三个 `clear*Metadata` 开关默认关闭；仍可选择开启白名单清理。

### Added

- `clearExecutionTiming` 设置，用于清除 cell metadata 中的 `execution`、`ExecuteTime` 字段。
- 一次性规范化脚本 `scripts/normalize.js`，与扩展共享默认清理逻辑。
- 验证任意 metadata 与图片尺寸保留、清理幂等性及配置开关的测试。

### 升级说明

安装后重新加载 VS Code。没有显式设置的 metadata 清理选项将采用新默认值；已有工作区或用户级配置不会被覆盖。以前被清理掉的信息不会自动恢复。

## 0.1.0

### Added

- Jupyter notebook 保存前清理，支持按工作区启用和手动清理命令。
- 清理 cell 与 output 执行计数，保留代码、输出数据、附件和 cell ID。
- 可配置 notebook、cell、output metadata 保留名单；此版本默认启用白名单清理。
- 运行状态检查、并发编辑检查与 Output 日志。
- 单元测试及隔离 VS Code 扩展宿主中的保存集成测试。

## 验证范围

本地测试环境为 Windows、VS Code 1.145.2、Node.js 24.21.0。集成测试使用内置 ipynb 序列化器和测试 controller，覆盖保存、输出类型与附件保留、手动清理、禁用设置、执行中跳过，以及无 Git 过滤器时重复保存不产生差异。此验证范围不代表所有平台、VS Code 版本或第三方 kernel provider 均已验证。
