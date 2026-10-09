# 计件工资记账 · 移动端 PWA

Looking for the English version? Click [here](README.en.md).

一个面向车间/工厂计件场景的**移动端记账 Web App（PWA）**：手机浏览器打开即可使用，
**无需安装、无需登录、数据全部保存在本机浏览器（IndexedDB）**，断网也能继续用。

> 功能范围：快速记账、明细筛选、多维度统计图表、一键导出 Excel/CSV、本地备份与还原、深浅色主题。
>
> **名称声明**：本项目为独立开发并开源的第三方工具，与上海慧贤网络科技有限公司及其「安心计件」产品
> **无任何关联**，双方不存在合作、授权、隶属或其他关系；此处提及「安心计件」仅作为同类手机计件
> 记账工具的功能对照说明，不含任何对比评价或优劣指向。

> **使用前请先看**：本应用是 PWA，把它「添加到主屏幕」（安装到桌面）后即可获得独立窗口、
> 离线可用、桌面启动图标等接近原生 App 的体验，各平台入口不同：
> Android 用 **Chrome**（右上角「⋮」→ 添加到主屏幕），iPhone / iPad 用 **Safari**
> （底部分享按钮 → 添加到主屏幕），电脑用 **Chrome / Edge**（地址栏安装图标，或菜单里的
> 「安装页面为应用」）；微信、QQ 等应用的内置浏览器无法添加，请改用系统浏览器打开。
> 本应用数据只保存在本机浏览器中，**清理缓存或站点数据可能导致数据丢失**，请定期导出备份。
> 各平台的详细步骤见下方「[添加到主屏幕](#添加到主屏幕)」章节。

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
| 构建 | Vite 5 |
| 框架 | Vue 3（`<script setup>` + TypeScript） |
| 路由 | Vue Router 4（Hash 模式，静态托管免配置） |
| UI | Vant 4（移动端组件库） |
| 状态 | Pinia |
| 本地存储 | localForage（IndexedDB，带降级） |
| 图表 | ECharts 5 + vue-echarts（按需注册） |
| 导出 | xlsx（Excel）、原生 Blob（CSV/JSON）、html2canvas（统计长图） |
| PWA | vite-plugin-pwa（自动更新 Service Worker、离线预缓存、可添加到主屏幕，安装说明见「添加到主屏幕」章节） |

---

## 二、目录结构

```
jijian-pwa/
├─ index.html                 # 入口 HTML（含启动闪屏）
├─ vite.config.ts             # Vite 配置：base './'、PWA 清单、分包、别名 '@'
├─ tsconfig.json / tsconfig.node.json
├─ package.json
├─ .github/workflows/deploy.yml   # GitHub Pages 自动构建部署工作流
├─ public/                    # PWA 图标、favicon
└─ src/
   ├─ main.ts                 # 应用挂载、Vant 注册、移除闪屏
   ├─ App.vue                 # 根壳：主题、TabBar 显隐、路由出口
   ├─ router/index.ts         # 路由表（4 个 Tab + 记录/产品/工人/数据/关于等子页）
   ├─ stores/app.ts           # Pinia：记录、产品、工序、工人、设置的增删改查与备份还原
   ├─ db/index.ts             # localForage 持久层、默认设置、导入导出
   ├─ types/index.ts          # 领域模型类型定义
   ├─ utils/
   │  ├─ date.ts              # 本地时区日期工具（今日/区间/周月/偏移）
   │  ├─ format.ts            # 金额、数量、日期格式化
   │  ├─ stats.ts             # 聚合统计：按产品/工序/工人/班次/日期、日均、最佳日、分桶
   │  ├─ exporter.ts          # Excel / CSV / JSON 导出
   │  ├─ platform.ts          # 运行环境识别（平台 / 浏览器 / 应用内置浏览器 / 独立窗口模式）
   │  └─ install.ts           # 「添加到主屏幕」引导内容、显示偏好与最近备份时间
   ├─ components/             # TabBar、分段控件、空状态、统计块、日期选择、记录项、快速记账弹层、
   │                          # 安装引导弹层（InstallGuideSheet）与首页安装提示卡片（InstallTipCard）
   ├─ views/                  # 首页、明细、统计、我的、记录编辑/详情、产品、产品详情、工人、数据、关于
   ├─ plugins/echarts.ts      # ECharts 按需注册
   └─ styles/                 # 主题变量（浅色/深色）与全局样式
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

**我的**
- 产品与工序管理（增删改、单价设置、规格）
- 工人管理（从记录中维护常用工人名单）
- 数据与导出：Excel / CSV / 汇总报表 / 备份 JSON / 导入还原 / 演示数据 / 清空
- 主题切换（跟随系统 / 浅色 / 深色）、默认工人、记住上次选择
- 添加到手机主屏幕：按当前设备与浏览器给出对应入口的分步引导，支持一键复制应用网址、
  直接调用浏览器原生安装；已处于独立窗口模式时自动隐藏
- 关于页展示当前环境的添加步骤与数据备份说明

---

## 四、开发与构建

```powershell
npm install          # 安装依赖
npm run dev          # 开发模式 http://localhost:5173（已开启 host，手机同局域网可访问）
npm run type-check   # TypeScript 类型检查
npm run build        # 类型检查 + 生产构建，产物在 dist/
npm run preview      # 本地预览构建产物 http://localhost:4173
```

要求 Node.js 18+（本项目在 Node 24 / npm 11 下验证通过）。

---

## 五、部署

部署到 GitHub Pages 的完整步骤见项目外层交付的 **《GitHub-Pages-部署说明.md》**。
线上地址：https://wdre9.github.io/jijian-pwa/

简要说明：

- 仓库的 Pages 来源为 **`gh-pages` 分支**（Settings → Pages → Deploy from a branch），
  把 `dist/` 内的文件提交到该分支根目录即完成发布；
- 也可改用 `.github/workflows/deploy.yml`（GitHub Actions 方案）：推到 `main` 后，
  在 Settings → Pages 选择 **GitHub Actions** 即可自动构建部署，两种方式选其一即可；
- 构建配置为 `base: './'`，部署在仓库子路径下也能正常访问；
- `dist/.nojekyll` 用于关闭 GitHub Pages 的 Jekyll 处理。

---

## 六、数据说明

- 所有数据仅保存在当前浏览器的 IndexedDB 中，**不上传任何服务器**；
- 更换设备、更换浏览器或清理浏览器数据会造成数据丢失，请定期
  「我的 → 数据与导出 → 导出备份」保存 `.json` 备份文件；
- 备份文件包含全部记录、产品、工序、工人与设置，导入即可完整恢复。

## 添加到主屏幕

本项目是 PWA（渐进式 Web 应用）。添加到主屏幕（安装到桌面）后，它会以独立窗口运行、
支持离线使用，并在桌面生成启动图标，体验接近原生 App；不添加也能使用，但始终只是
浏览器里的一个普通网页。

**为什么建议添加**

- 独立窗口：没有地址栏与浏览器菜单，界面更像一个 App；
- 离线可用：Service Worker 预缓存页面资源，断网也能记账、查看数据；
- 启动更快：从桌面图标一键进入；
- 数据归属不变：仍保存在当前浏览器的 IndexedDB 中，用同一个浏览器打开才能看到原有数据。

应用内已内置安装引导：首页会显示一条提示卡片，也可以随时打开「我的 → 添加到手机主屏幕」，
引导会按当前设备与浏览器给出对应的入口路径；已经处于独立窗口模式时不再显示该引导。

### 一、Android 手机

**Chrome 浏览器（推荐）**

1. 用 Chrome 打开站点：https://wdre9.github.io/jijian-pwa/
2. 点击右上角的「⋮」菜单。
3. 向下滑动，选择「添加到主屏幕」（部分版本显示为「安装应用」）。
4. 按提示确认后，桌面出现应用图标，之后从该图标启动即可。

页面顶部出现「安装应用」提示条时，直接点「安装」效果相同。若菜单里没有该选项，
先下拉刷新并等页面完全加载，再打开菜单重试。

**微信 / QQ / 钉钉 / 飞书等内置浏览器（无法添加）**

内置浏览器没有独立窗口，也不能生成桌面图标。请点右上角「…」菜单，选择「在浏览器打开」；
若没有这一项，先「复制链接」，再用 Chrome 打开并粘贴网址访问，然后按上面的 Chrome 步骤添加。

**其它浏览器（UC / 夸克 / 小米 / 华为 / 三星等）**

可在浏览器菜单里找「添加到主屏幕 / 添加到桌面 / 安装应用」，名称因浏览器而异；
找不到该选项，或添加后离线不可用时，请改用 Chrome 打开本页重新添加。

### 二、iPhone / iPad

**Safari（iOS 上唯一支持添加的浏览器）**

1. 用 Safari 打开站点：https://wdre9.github.io/jijian-pwa/
2. 点击底部工具栏中间的「分享」按钮（iPad 在顶部）。
3. 在分享面板中向下滑动，选择「添加到主屏幕」。
4. 点右上角「添加」，桌面出现图标。

**非 Safari 浏览器（Chrome、Edge、微信等）**

iOS 上的浏览器都基于 WebKit，但只有 Safari 支持「添加到主屏幕」。请先复制网址，
再用 Safari 打开并粘贴访问，然后按上面的步骤添加。

### 三、电脑（Windows / macOS）

**Chrome / Edge（适合查看报表与导出数据）**

1. 用 Chrome 或 Edge 打开站点：https://wdre9.github.io/jijian-pwa/
2. 点地址栏右侧的安装图标（Edge 显示为「应用可用」小方块），或从菜单安装：
   Chrome「⋮」→「投放、保存和分享」→「安装页面为应用」；
   Edge「…」→「应用」→「将此站点安装为应用」。
3. 点「安装」，之后可从桌面或开始菜单启动本应用。

其它桌面浏览器（Firefox、Safari 等）不支持安装为应用，请改用 Chrome 或 Edge。
日常记账建议在手机上添加到主屏幕，电脑端主要用于查看统计与导出数据。

### 四、数据安全提示

- 本应用运行在浏览器中，数据保存在当前浏览器的 IndexedDB 里，不上传任何服务器；
- 浏览器或系统清理缓存、清理站点数据（含存储空间不足时的自动清理）时，可能一并清除
  这些数据，且无法恢复；
- 请定期通过「我的 → 数据与导出 → 导出备份」保存 `.json` 备份文件，并另存到手机以外的地方
  （电脑、云盘）；「数据与导出」页会显示最近一次备份时间，超过 7 天或从未备份时会醒目提醒；
- 在清除浏览器缓存、卸载浏览器、更换设备或更换浏览器之前，请先导出备份；
- 更换浏览器（例如从微信内置浏览器改用 Chrome）相当于换了存储空间，原数据不会自动带过去，
  请先在原环境导出备份，再到新环境用「导入还原」恢复。

---

## 七、贡献

欢迎参与本项目。提交 Issue 或 Pull Request 之前，建议先阅读：

- [贡献指南](CONTRIBUTING.md)：开发环境、分支与提交约定、Pull Request 流程
- [行为准则](CODE_OF_CONDUCT.md)：社区交流的基本约定
- [安全政策](SECURITY.md)：漏洞上报方式与处理时限

问题反馈请使用 Issue 模板：https://github.com/wdre9/jijian-pwa/issues/new/choose
代码变更请按 Pull Request 模板填写变更说明与验证方式。

---

## 八、许可证

本项目基于 [MIT 许可证](LICENSE) 开源，版权归 wdre9 所有（2026）。

---

## 九、更新日志

版本变更记录见 [CHANGELOG.md](CHANGELOG.md)。
