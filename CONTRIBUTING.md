# 贡献指南

感谢你愿意为「计件工资记账 · 移动端 PWA」贡献力量。本文档说明参与本项目的推荐流程与基本约定。

## 一、可以参与的方式

- 提交 Bug 报告：使用 [Bug 报告模板](.github/ISSUE_TEMPLATE/bug_report.md) 描述问题。
- 提交功能建议：使用 [功能建议模板](.github/ISSUE_TEMPLATE/feature_request.md) 描述需求与使用场景。
- 提交代码：修复缺陷、优化体验、改进文档、补充测试等。
- 完善文档：修正错别字、补充使用说明与部署说明。

## 二、开发环境准备

要求 Node.js 18 及以上（项目在 Node 24 / npm 11 下验证通过）。

```powershell
git clone https://github.com/wdre9/jijian-pwa.git
cd jijian-pwa
npm install
npm run dev          # 开发模式 http://localhost:5173
npm run type-check   # TypeScript 类型检查
npm run build        # 类型检查 + 生产构建，产物在 dist/
npm run preview      # 本地预览构建产物 http://localhost:4173
```

提交代码前请确保 `npm run build` 能够通过，避免引入类型错误。

## 三、分支与提交约定

- 分支命名：
  - 功能：`feat/简要说明`
  - 修复：`fix/简要说明`
  - 文档：`docs/简要说明`
- 提交信息建议采用 `类型: 简要说明` 的形式，类型可取 `feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`chore`。
  示例：`fix: 修复统计页区间切换后图表未刷新`
- 一次提交只做一件事，避免把无关改动混在一起。

## 四、代码规范

- 使用 Vue 3 `<script setup>` 与 TypeScript，保持类型完整，不使用 `any` 规避类型检查。
- 组件、工具函数沿用 `src/` 下已有的目录划分与命名风格。
- 样式优先使用 `src/styles/` 中的主题变量，保证浅色与深色主题下均正常显示。
- 界面文案使用简体中文，不添加表情符号。
- 新增功能若涉及数据存储结构变更，请同步更新 `src/db/` 中的默认值，并在 Pull Request 中说明兼容性影响。

## 五、Pull Request 流程

1. 从 `main` 分支切出特性分支进行开发。
2. 本地执行 `npm run build` 确认通过。
3. 提交 Pull Request，并按模板填写变更说明、关联 Issue 与验证方式。
4. 若界面有可见变化，请在 Pull Request 中附上截图。
5. 维护者审阅通过后合并。

## 六、Issue 提交建议

- 先检索已有 Issue，避免重复。
- 提供尽可能明确的信息：浏览器与版本、操作系统、复现步骤、期望结果与实际结果。
- 涉及数据问题时，请勿粘贴真实工资数据，可使用演示数据复现。

## 七、行为准则

参与本项目即表示你同意遵守 [行为准则](CODE_OF_CONDUCT.md)。

## 八、许可

向本项目提交的代码与文档，视为同意以 [MIT 许可证](LICENSE) 授权发布。
