# Piece-Rate Wage Bookkeeping · Mobile PWA

中文版请见 [README.md](README.md)。

A **mobile bookkeeping web app (PWA)** for piece-rate work in workshops and factories: open it in a
phone browser and it is ready to use. **No installation, no login, and all data is kept in the local
browser (IndexedDB)** — it keeps working offline.

> Scope: quick entry, filterable records, multi-dimensional charts and statistics, one-click
> Excel/CSV export, local backup and restore, light and dark themes.
>
> **Name notice**: this project is an independently developed, open-source third-party tool and has
> **no affiliation of any kind** with Shanghai Huixian Network Technology Co., Ltd. or its
> "Anxin Jijian" product; there is no cooperation, licensing, corporate or other relationship between
> them. The name "Anxin Jijian" is mentioned here only as a functional reference point alongside
> similar mobile piece-rate bookkeeping tools, and implies no comparison or judgement about the
> merits of either product.

> **Before you start**: this app is a PWA. Once it is added to the home screen (installed on the
> desktop), you get a standalone window, offline availability and a desktop launch icon — an
> experience close to a native app. The entry point differs by platform:
> on Android use **Chrome** (top-right "⋮" → Add to Home screen), on iPhone / iPad use **Safari**
> (Share button at the bottom → Add to Home Screen), on a computer use **Chrome / Edge** (install
> icon in the address bar, or "Install page as app" in the menu); in-app browsers such as WeChat and
> QQ cannot add it, so open the site in a system browser instead.
> Data is stored only in the local browser, and **clearing the cache or site data may cause data
> loss** — export a backup regularly.
> Detailed steps for each platform are in the "[Add to Home Screen](#add-to-home-screen)" section below.

## Screenshots

The screenshots below are taken from the actual running interface of this project.

| Home | Quick Entry |
| --- | --- |
| <img src="docs/screenshots/home.png" width="260" alt="Home"> | <img src="docs/screenshots/quickadd.png" width="260" alt="Quick Entry"> |
| Today / this week / this month totals and recent records | Product, process, quantity and the unit price filled in automatically |

| Records | Statistics |
| --- | --- |
| <img src="docs/screenshots/records.png" width="260" alt="Records"> | <img src="docs/screenshots/stats.png" width="260" alt="Statistics"> |
| Multi-condition filtering and batch export | Income trend, product share and income ranking |

| Products and Processes | Data and Export |
| --- | --- |
| <img src="docs/screenshots/products.png" width="260" alt="Products and Processes"> | <img src="docs/screenshots/data.png" width="260" alt="Data and Export"> |
| Maintain products, processes and unit prices | Import and export of Excel / CSV / backup JSON |

| Profile |
| --- |
| <img src="docs/screenshots/settings.png" width="260" alt="Profile"> |
| Theme switching, default worker and personal preferences |

---

## 1. Tech Stack

| Category | Choice |
| --- | --- |
| Build | Vite 5 |
| Framework | Vue 3 (`<script setup>` + TypeScript) |
| Routing | Vue Router 4 (hash mode, no configuration needed for static hosting) |
| UI | Vant 4 (mobile component library) |
| State | Pinia |
| Local storage | localForage (IndexedDB, with fallback) |
| Charts | ECharts 5 + vue-echarts (registered on demand) |
| Export | xlsx (Excel), native Blob (CSV/JSON), html2canvas (long statistics image) |
| PWA | vite-plugin-pwa (auto-updating Service Worker, offline precache, add to home screen; installation guide in the "Add to Home Screen" section) |

---

## 2. Project Structure

```
jijian-pwa/
├─ index.html                 # Entry HTML (with start-up splash)
├─ vite.config.ts             # Vite config: base './', PWA manifest, chunk splitting, alias '@'
├─ tsconfig.json / tsconfig.node.json
├─ package.json
├─ .github/workflows/deploy.yml   # GitHub Pages automatic build and deployment workflow
├─ public/                    # PWA icons, favicon
└─ src/
   ├─ main.ts                 # App mounting, Vant registration, splash removal
   ├─ App.vue                 # Root shell: theme, TabBar visibility, router outlet
   ├─ router/index.ts         # Route table (4 tabs + record / product / worker / data / about sub-pages)
   ├─ stores/app.ts           # Pinia: CRUD and backup/restore for records, products, processes, workers, settings
   ├─ db/index.ts             # localForage persistence layer, default settings, import/export
   ├─ types/index.ts          # Domain model type definitions
   ├─ utils/
   │  ├─ date.ts              # Local time zone date helpers (today / ranges / weeks and months / offsets)
   │  ├─ format.ts            # Amount, quantity and date formatting
   │  ├─ stats.ts             # Aggregated statistics: by product / process / worker / shift / date, daily average, best day, bucketing
   │  ├─ exporter.ts          # Excel / CSV / JSON export
   │  ├─ platform.ts          # Runtime detection (platform / browser / in-app browser / standalone window mode)
   │  └─ install.ts           # "Add to home screen" guide content, display preferences and last backup time
   ├─ components/             # TabBar, segmented control, empty state, stat blocks, date picker, record item,
   │                          # quick entry sheet, install guide sheet (InstallGuideSheet) and
   │                          # home install tip card (InstallTipCard)
   ├─ views/                  # Home, records, statistics, profile, record edit/detail, products, product detail, workers, data, about
   ├─ plugins/echarts.ts      # ECharts on-demand registration
   └─ styles/                 # Theme variables (light/dark) and global styles
```

---

## 3. Features

**Bookkeeping (Home)**
- Today / this week / this month totals at the top, plus a list of recent records
- The "＋" button at the bottom opens the quick entry sheet: product → process → quantity stepper →
  unit price filled in automatically → shift / worker / note
- Remembers the last used product and process for faster consecutive entries

**Records**
- Filter by date range / product / worker / shift, grouped by date
- Long-press or tick to enter multi-select and export the selected records in batch
- View, edit and delete a single record

**Statistics**
- Ranges: this week / this month / last month / last 30 days / last 90 days / yearly / custom
- Total amount, piece count, number of entries, daily average, average unit price, best single day
- Daily income trend chart (automatically monthly when the range exceeds 62 days), product share pie
  chart, process income ranking, worker income ranking
- One-click export of the long statistics image (PNG) and the statistics Excel (details + 5 summary sheets)

**Profile**
- Product and process management (add, edit, delete, unit price, specification)
- Worker management (maintain the list of frequently used workers from records)
- Data and export: Excel / CSV / summary report / backup JSON / import and restore / demo data / clear
- Theme switching (follow system / light / dark), default worker, remember last selection
- Add to phone home screen: step-by-step guidance with the entry point matching the current device
  and browser, one-click copy of the app URL and a direct call to the browser's native install;
  hidden automatically in standalone window mode
- The About page shows the add steps and the data backup notes for the current environment

---

## 4. Development and Build

```powershell
npm install          # Install dependencies
npm run dev          # Dev mode http://localhost:5173 (host enabled, reachable from phones on the same LAN)
npm run type-check   # TypeScript type check
npm run build        # Type check + production build, output in dist/
npm run preview      # Preview the build locally at http://localhost:4173
```

Node.js 18+ is required (this project is verified on Node 24 / npm 11).

---

## 5. Deployment

The complete steps for deploying to GitHub Pages are in the separate delivery document
**《GitHub-Pages-部署说明.md》**.
Live site: https://wdre9.github.io/jijian-pwa/

Brief notes:

- The Pages source of this repository is the **`gh-pages` branch** (Settings → Pages → Deploy from a
  branch); committing the files in `dist/` to the root of that branch publishes the site;
- You can also switch to `.github/workflows/deploy.yml` (the GitHub Actions option): after pushing to
  `main`, select **GitHub Actions** in Settings → Pages and the build and deployment run
  automatically; choose either of the two approaches;
- The build uses `base: './'`, so the site also works when served from a repository sub-path;
- `dist/.nojekyll` disables Jekyll processing on GitHub Pages.

---

## 6. Data Notes

- All data is stored only in the IndexedDB of the current browser and is **never uploaded to any
  server**;
- Changing devices, changing browsers or clearing browser data will cause data loss, so regularly use
  "Profile → Data and Export → Export backup" to save a `.json` backup file;
- The backup file contains all records, products, processes, workers and settings, and importing it
  restores everything completely.

## Add to Home Screen

This project is a PWA (Progressive Web App). After it is added to the home screen (installed on the
desktop) it runs in a standalone window, supports offline use and creates a launch icon on the
desktop, giving an experience close to a native app; it also works without adding it, but then it is
always just an ordinary page in the browser.

**Why adding it is recommended**

- Standalone window: no address bar and no browser menus, so the interface looks more like an app;
- Offline availability: the Service Worker precaches the page resources, so you can still record and
  view data without a network connection;
- Faster start: one tap from the desktop icon;
- The data stays where it is: it is still stored in the IndexedDB of the current browser, so the
  original data is visible only when the site is opened in the same browser.

The app already includes installation guidance: the home page shows a tip card, and you can open
"Profile → Add to phone home screen" at any time; the guide gives the entry point that matches the
current device and browser, and it is no longer shown when the app already runs in standalone window
mode.

### 1. Android phones

**Chrome (recommended)**

1. Open the site in Chrome: https://wdre9.github.io/jijian-pwa/
2. Tap the "⋮" menu in the top-right corner.
3. Scroll down and choose "Add to Home screen" (shown as "Install app" in some versions).
4. Confirm as prompted; an app icon appears on the home screen and you can launch it from there.

When an "Install app" banner appears at the top of the page, tapping "Install" has the same effect.
If the option is missing from the menu, pull down to refresh, wait until the page has fully loaded
and open the menu again.

**In-app browsers such as WeChat / QQ / DingTalk / Feishu (cannot add)**

In-app browsers have no standalone window and cannot create a home screen icon. Tap the "…" menu in
the top-right corner and choose "Open in browser"; if that item is missing, "Copy link" first, then
open Chrome, paste the URL and follow the Chrome steps above.

**Other browsers (UC / Quark / Xiaomi / Huawei / Samsung, etc.)**

Look for "Add to Home screen / Add to desktop / Install app" in the browser menu; the name differs
between browsers. If the option cannot be found, or offline use does not work after adding, open this
page in Chrome and add it again.

### 2. iPhone / iPad

**Safari (the only browser that supports adding on iOS)**

1. Open the site in Safari: https://wdre9.github.io/jijian-pwa/
2. Tap the "Share" button in the middle of the bottom toolbar (at the top on iPad).
3. Scroll down in the share sheet and choose "Add to Home Screen".
4. Tap "Add" in the top-right corner; an icon appears on the home screen.

**Browsers other than Safari (Chrome, Edge, WeChat, etc.)**

All browsers on iOS are based on WebKit, but only Safari supports "Add to Home Screen". Copy the URL
first, then open it in Safari, paste the address and follow the steps above.

### 3. Computers (Windows / macOS)

**Chrome / Edge (suitable for viewing reports and exporting data)**

1. Open the site in Chrome or Edge: https://wdre9.github.io/jijian-pwa/
2. Tap the install icon on the right of the address bar (Edge shows a small "App available" square),
   or install from the menu:
   Chrome "⋮" → "Cast, save and share" → "Install page as app";
   Edge "…" → "Apps" → "Install this site as an app".
3. Tap "Install"; the app can then be launched from the desktop or the Start menu.

Other desktop browsers (Firefox, Safari, etc.) do not support installation as an app, so use
Chrome or Edge instead. For daily bookkeeping it is recommended to add to the home screen on a
phone; the computer is mainly used for viewing statistics and exporting data.

### 4. Data security notes

- The app runs in the browser and the data is stored in the IndexedDB of the current browser; it is
  not uploaded to any server;
- When the browser or the system clears the cache and site data (including automatic cleanup when
  storage space runs low), this data may be cleared as well and cannot be recovered;
- Regularly save a `.json` backup file via "Profile → Data and Export → Export backup" and keep it
  somewhere other than the phone (computer, cloud drive); the "Data and Export" page shows the last
  backup time and reminds you prominently when it is older than 7 days or when no backup exists;
- Export a backup before clearing the browser cache, uninstalling the browser, changing devices or
  switching browsers;
- Switching browsers (for example from an in-app WeChat browser to Chrome) is equivalent to moving to
  a different storage area, and the original data is not carried over automatically; export a backup
  in the original environment first, then restore it in the new environment with "Import and restore".

---

## 7. Contributing

Contributions are welcome. Before opening an Issue or a Pull Request, please read:

- [Contributing Guide](CONTRIBUTING.md): development environment, branch and commit conventions, Pull Request flow
- [Code of Conduct](CODE_OF_CONDUCT.md): the basic conventions for community communication
- [Security Policy](SECURITY.md): how to report vulnerabilities and the handling time frame

For problem reports, please use the issue template: https://github.com/wdre9/jijian-pwa/issues/new/choose
For code changes, please fill in the change description and verification method following the Pull Request template.

---

## 8. License

This project is released under the [MIT License](LICENSE), and the copyright belongs to wdre9 (2026).

---

## 9. Changelog

See [CHANGELOG.md](CHANGELOG.md) for the version history.
