# 计件工资记账 · Android APP

Looking for the English version? Click [here](README.en.md).

一个面向车间/工厂计件场景的**本地记账 Android 应用**：拿到 APK 安装即可用，
**无需联网、无需登录、数据全部保存在手机本地**（应用内 IndexedDB），断网也能继续记账。

> 功能范围：快速记账、明细筛选、多维度统计图表、一键导出 Excel/CSV、本地备份与还原、深浅色主题。
>
> **名称声明**：本项目为独立开发并开源的第三方工具，与上海慧贤网络科技有限公司及其「安心计件」产品
> **无任何关联**，双方不存在合作、授权、隶属或其他关系；此处提及「安心计件」仅作为同类手机计件
> 记账工具的功能对照说明，不含任何对比评价或优劣指向。

> **使用前请先看**：本应用数据只保存在本机应用沙盒中，**卸载应用或清除应用数据会导致数据丢失**，
> 请定期在「我的 → 数据与导出 → 导出备份」中保存 `.json` 备份文件。备份格式与网页版（PWA）
> 互通，可在任意一端导出、另一端导入。

## 安装方式

在 [Releases](https://github.com/wdre9/jijian-app/releases) 页面下载最新的 `app-debug.apk` 安装包，
传到手机后点击安装即可。Android 默认会拦截「未知来源应用」，按提示允许本次安装即可
（各品牌手机位置不同：设置 → 安全 / 更多设置 → 允许安装未知应用）。

## 截图预览

以下截图取自本项目实际运行界面。

| 首页 | 快速记账 |
| --- | --- |
| <img src="docs/screenshots/home.png" width="260" alt="首页"> | <img src="docs/screenshots/quickadd.png" width="260" alt="快速记账"> |
| 今日 / 本周 / 本月金额概览与最近记录 | 产品、工序、数量与自动带出的单价 |

| 明细 | 统计 |
| --- | --- |
| <img src="docs/screenshots/records.png" width="260" alt="明细"> | <img src="docs/screenshots/stats.png" width="260" alt="统计"> |
| 多条件筛选与批量导出 | 收入趋势、产品占比与收入排行 |

| 产品与工序 | 数据与导出 |
| --- | --- |
| <img src="docs/screenshots/products.png" width="260" alt="产品与工序"> | <img src="docs/screenshots/data.png" width="260" alt="数据与导出"> |
| 产品、工序与单价维护 | Excel / CSV / 备份 JSON 导入导出 |

| 我的 |
| --- |
| <img src="docs/screenshots/settings.png" width="260" alt="我的"> |
| 主题切换、默认工人与个人偏好 |

---

## 一、技术栈

| 类别 | 选型 |
| --- | --- |
| 应用壳 | Capacitor 6（Android WebView，`appId=com.wdre9.jijian`） |
| 构建 | Vite 5 |
| 框架 | Vue 3（`<script setup>` + TypeScript） |
| 路由 | Vue Router 4（Hash 模式，静态托管免配置） |
| UI | Vant 4（移动端组件库） |
| 状态 | Pinia |
| 本地存储 | localForage（IndexedDB，带降级） |
| 图表 | ECharts 5 + vue-echarts（按需注册） |
| 导出 | xlsx（Excel）、原生 Blob（CSV/JSON）、html2canvas（统计长图） |
| OCR 导入 | tesseract.js（本地识别，图片文字不出设备） |
| 打包 | Android Gradle Plugin 8.2.1 / Gradle 8.2.1，minSdk 22 / compileSdk 34 |

---

## 二、目录结构

```
jijian-app/
├─ android/                    # Capacitor 生成的 Android 工程
│  ├─ app/                     # 应用模块（build.gradle、AndroidManifest、MainActivity）
│  ├─ gradle/wrapper/          # Gradle Wrapper
│  ├─ gradlew / gradlew.bat    # Linux / Windows 构建脚本
│  ├─ build.gradle / settings.gradle / variables.gradle
│  └─ capacitor.settings.gradle
├─ .github/workflows/build-android.yml  # 自动构建 APK 并发布 Release 的工作流
├─ capacitor.config.ts         # Capacitor 配置（appId / appName / webDir）
├─ index.html                  # 入口 HTML（含启动闪屏）
├─ vite.config.ts              # Vite 配置：base './'、分包、别名 '@'
├─ tsconfig.json / tsconfig.node.json
├─ package.json
├─ public/                     # 应用图标、favicon
└─ src/
   ├─ main.ts                  # 应用挂载、Vant 注册、移除闪屏
   ├─ App.vue                  # 根壳：主题、TabBar 显隐、路由出口
   ├─ router/index.ts          # 路由表（4 个 Tab + 记录/产品/工人/数据/关于等子页）
   ├─ stores/app.ts            # Pinia：记录、产品、工序、工人、设置的增删改查与备份还原
   ├─ db/index.ts              # localForage 持久层、默认设置、导入导出
   ├─ types/index.ts           # 领域模型类型定义
   ├─ utils/
   │  ├─ date.ts               # 本地时区日期工具（今日/区间/周月/偏移）
   │  ├─ format.ts             # 金额、数量、日期格式化
   │  ├─ stats.ts              # 聚合统计：按产品/工序/工人/班次/日期、日均、最佳日、分桶
   │  ├─ exporter.ts           # Excel / CSV / JSON 导出
   │  ├─ importer.ts           # 批量导入：文本解析 + 图片 OCR
   │  └─ platform.ts           # 运行环境识别
   ├─ components/              # TabBar、分段控件、空状态、统计块、日期选择、记录项、快速记账弹层
   ├─ views/                   # 首页、明细、统计、我的、记录编辑/详情、产品、产品详情、工人、数据、关于、批量导入
   ├─ plugins/echarts.ts       # ECharts 按需注册
   └─ styles/                  # 主题变量（浅色/深色）与全局样式
```

---

## 三、功能一览

**记账（首页）**
- 顶部今日/本周/本月金额概览，最近记录列表
- 底部“＋”唤起快速记账弹层：产品 → 工序 → 数量步进 → 自动带出单价 → 班次/工人/备注
- 记住上次使用的产品与工序，连续记账更快

**明细**
- 按日期区间 / 产品 / 工人 / 班次筛选，按日期分组展示
- 长按或勾选进入多选，批量导出选中记录
- 单条记录查看详情、编辑、删除

**统计**
- 区间：本周 / 本月 / 上月 / 近 30 天 / 近 90 天 / 年度 / 自定义
- 合计金额、件数、笔数、日均、平均单价、最高单日
- 每日（区间 >62 天自动按月）收入趋势图、产品占比饼图、工序收入排行、工人收入排行
- 一键导出统计长图（PNG）与统计 Excel（明细 + 5 张汇总表）

**批量导入**
- 粘贴文本解析：识别「日期 / 货号 / 工序 / ×数量×单价=金额」格式，逐行校对后一键入库
- 图片 OCR：拍照或选择截图，本地识别文字后转成记录，可逐行修改

**我的**
- 产品与工序管理（增删改、单价设置、规格）
- 工人管理（从记录中维护常用工人名单）
- 数据与导出：Excel / CSV / 汇总报表 / 备份 JSON / 导入还原 / 演示数据 / 清空
- 主题切换（跟随系统 / 浅色 / 深色）、默认工人、记住上次选择

---

## 四、开发与构建

### 环境要求

| 依赖 | 说明 |
| --- | --- |
| Node.js 18+ | 前端构建（本项目在 Node 24 / npm 11 下验证通过） |
| JDK 17 | Android Gradle Plugin 8.x 要求 |
| Android SDK | `platforms;android-34`、`build-tools;34.0.0`，配置 `ANDROID_HOME` |

### 本地构建 APK

```powershell
npm install          # 安装依赖（含 Capacitor）
npm run build        # 类型检查 + 生产构建，产物在 dist/
npx cap sync android # 将 dist 同步进 Android 工程
cd android
.\gradlew.bat assembleDebug   # Windows 构建
# Linux/macOS: ./gradlew assembleDebug
```

产物路径：`android/app/build/outputs/apk/debug/app-debug.apk`

### 常用命令

```powershell
npm run dev          # 开发模式 http://localhost:5173（手机同局域网可访问）
npm run type-check   # TypeScript 类型检查
npx cap open android # 用 Android Studio 打开工程（调试、真机运行）
```

---

## 五、自动构建与发布

仓库已配置 GitHub Actions 工作流（`.github/workflows/build-android.yml`）：

- 推送 `main` 分支：自动构建 debug APK（不上传 Release）
- 推送 `v*` 标签：自动构建 debug APK 并创建 GitHub Release、上传安装包

发布新版本的流程：

```powershell
git tag -a v1.1.0 -m "描述"
git push origin v1.1.0
```

构建完成后到 [Releases](https://github.com/wdre9/jijian-app/releases) 页面即可下载 APK。

---

## 六、数据说明

- 所有数据仅保存在本机应用沙盒内的 IndexedDB 中，**不上传任何服务器**；
- 卸载应用、清除应用数据会造成数据丢失，请定期
  「我的 → 数据与导出 → 导出备份」保存 `.json` 备份文件；
- 备份文件包含全部记录、产品、工序、工人与设置，导入即可完整恢复；
- 备份格式与网页版（[jijian-pwa](https://github.com/wdre9/jijian-pwa)）**完全互通**：
  在 App 中导出的备份可在 PWA 中导入，反之亦然；
- 两版数据各自独立存储：App 数据在应用沙盒，PWA 数据在浏览器 IndexedDB，
  互不干扰，需通过备份文件互通。

---

## 七、贡献

欢迎参与本项目。提交 Issue 或 Pull Request 之前，建议先阅读：

- [贡献指南](CONTRIBUTING.md)：开发环境、分支与提交约定、Pull Request 流程
- [行为准则](CODE_OF_CONDUCT.md)：社区交流的基本约定
- [安全政策](SECURITY.md)：漏洞上报方式与处理时限

问题反馈请使用 Issue 模板：https://github.com/wdre9/jijian-app/issues/new/choose
代码变更请按 Pull Request 模板填写变更说明与验证方式。

---

## 八、许可证

本项目基于 [MIT 许可证](LICENSE) 开源，版权归 wdre9 所有（2026）。

---

## 九、更新日志

版本变更记录见 [CHANGELOG.md](CHANGELOG.md)。
