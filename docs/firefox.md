# Firefox 移植说明

同一套源码同时打出 Chrome 版和 Firefox 版。Chrome 版构建流程完全不变；
Firefox 版通过 `npm run package:firefox` 产出（先跑 `npm run build`）。

## 产物

- `artifacts/firefox-extension/`：可直接在 `about:debugging` → "Load Temporary Add-on" 加载调试的未签名包
- `artifacts/gemini-nexus-firefox-<version>.zip`：提交 AMO（addons.mozilla.org）签名的包

`web-ext lint` 结果：0 errors（另有约 80 条 warnings，多为 innerHTML / eval
相关的通用提示，不阻塞提交）。

## 为 Firefox 做的改动

| # | 问题 | 做法 |
|---|------|------|
| 1 | 现代 Firefox 的 `chrome.*` 与 `browser` 是同一纯 Promise 命名空间，会静默忽略 Chrome 风格的尾部回调；而仓库约 20 处仍用回调写法（`storage.get/set`、`tabs.getCurrent/query/get`、`alarms.get`、`contextMenus.create` 等），导致存储读取永不回包、`new Promise` 包裹处永久挂起 | `shared/compat/firefox_shim.js` 把 `browser.*` 包一层：所有异步方法同时支持 Promise 与 Chrome 风格尾部回调（含 `runtime.lastError` 语义），`addListener` 等监听方法除外；Chrome 下无操作 |
| 2 | `chrome.sidePanel` 不存在 | shim 里用 `browser.sidebarAction` 模拟：`setPanelBehavior` → 空操作；`open` → `sidebarAction.open()`；`setOptions({path})` → `sidebarAction.setPanel()`；manifest 加 `sidebar_action` |
| 3 | `chrome.debugger` 不存在（CDP 浏览器控制功能） | `background/control/connection.js` 增加可用性检测，不可用时直接返回失败并给出明确错误信息，该功能在 Firefox 下优雅降级 |
| 4 | `chrome.tabGroups` 不存在 | 代码里已有 `chrome.tabs?.group` / `chrome.tabGroups?.update` 保护，Firefox 下自动跳过 tab 分组指示 |
| 5 | manifest `sandbox` 页面 Firefox 不支持 | `sandbox/index.html` 的内联主题脚本抽成 `sandbox/theme_boot.js`（外链脚本），页面在严格 `extension_pages` CSP 下可正常加载；manifest 去掉 `sandbox` 键 |
| 6 | `background.service_worker` Firefox 不支持 | Firefox 包改用 `background.scripts` + `type: "module"`（FF112+ 支持） |
| 7 | manifest 其它 Chrome 专有项 | 去掉 `key`、`side_panel` 键、`sidePanel/debugger/tabGroups` 权限、`content_scripts` 的 `exclude_globs`；加 `browser_specific_settings.gecko`（id `gemini-nexus-firefox@haso2007`，`strict_min_version` 128.0，因为用了 `content_scripts` 的 `world: "MAIN"`） |
| 8 | content scripts 需要先加载 shim | 打包时在每条 content_scripts（含打包后的 `content/index.js`）前面插入 `shared/compat/firefox_shim.js`；MAIN world 那条不插入 |

改动点汇总：新增 `shared/compat/firefox_shim.js`、`sandbox/theme_boot.js`、
`scripts/package-firefox.mjs`、`docs/firefox.md`；修改
`background/control/connection.js`（debugger 检测）、`background/index.js` /
`sidepanel/index.js` / `sandbox/index.js` / `settings/index.js`（首行导入 shim）、
`sandbox/index.html`（内联脚本外链化）、`vite.config.ts`（输出 theme_boot.js）、
`scripts/package-extension.mjs`（复制 theme_boot.js，不影响 Chrome 行为）、
`package.json`（新增 `package:firefox`）。

## Firefox 下已知降级（有意为之）

- **浏览器控制（Browser Control）不可用**：依赖 CDP，Firefox 没有对应 API，尝试使用时会明确提示不支持。
- **侧边栏按 tab 启用/禁用为尽力而为**：Firefox 没有 `sidePanel.setOptions({enabled})` 的等价物；打开/切换侧边栏正常。
- **受控 tab 的原生 tab 分组指示跳过**：其余控制逻辑不受影响（但如上，CDP 功能本身不可用）。
- `commands` 的 `Alt+G / Alt+Q / Alt+O` 保留，Firefox 支持 `_execute_action`。

## AMO 提交步骤（待 Firefox 开发者账号）

1. 登录 [addons.mozilla.org](https://addons.mozilla.org) 开发者中心，提交
   `artifacts/gemini-nexus-firefox-<version>.zip`（选 "On this site" 公开发布
   或 "On your own" 自行分发）。
2. 首次提交后 AMO 会分配签名；后续版本沿用同一个 `gecko.id`
  （`gemini-nexus-firefox@haso2007`），否则会被视为新扩展。
3. 审核关注点：`host_permissions` 为 `<all_urls>`（内容脚本需要），需在
   上架描述中说明用途；`web-ext lint` 的 warnings 已在上文说明。
4. 也可以用 `web-ext sign --channel listed --source-dir artifacts/firefox-extension`
   走 API 签名，需要账号的 JWT issuer/secret。
