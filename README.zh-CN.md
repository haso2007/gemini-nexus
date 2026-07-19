<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a>
</p>

<div align="center">
  <a href="https://github.com/yeahhe365/Gemini-Nexus">
    <img src="logo.png" width="160" height="160" alt="Gemini Nexus Logo">
  </a>

# Gemini Nexus

### 赋予浏览器原生 AI 灵魂

  <p>
    <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini">
    <img src="https://img.shields.io/badge/Chrome_Extension-MV3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension">
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite">
  </p>

  <p>
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
  </p>

  <p>
    <a href="README.md">English README</a>
  </p>

---

</div>

### 项目简介

**Gemini Nexus** 赋予浏览器原生 AI 灵魂，是一款集成 Gemini Web、Google Gemini API、OpenAI Compatible API 以及多个第三方专门 API 渠道的 Chrome 扩展程序。它不仅仅是一个侧边栏插件，而是通过注入式的**悬浮工具栏**、图像与截图输入、基于 Chrome DevTools Protocol 的**浏览器控制工具**以及可选的**外部 MCP 工具**，将 AI 的触角伸向网页浏览的每一个交互细节。

### 能力概览

Gemini Nexus 当前围绕浏览器内 AI 工作流提供以下能力：

- **Gemini Web**、**Gemini API**、**OpenAI Compatible API**、**OpenAI 官方 API**、**DeepSeek API**、**OpenRouter API**、**通义 / DashScope API**、**Anthropic API** 与 **智谱 API** 多提供方切换，支持按渠道配置 `Base URL`、`API Key` 与 `Model IDs`。
- **Gemini Web 临时对话** 开关，可让 Web 渠道请求不进入 Gemini 近期对话。
- **Gemini API Google Search grounding** 支持，并在回复中展示联网来源。
- **OpenAI Compatible API 联网搜索** 支持，可按当前接口使用 Responses API `web_search` 或 Chat Completions `web_search_options`。
- **侧边栏按标签页显示范围控制**，支持减少在不需要标签页中的干扰。
- **历史用户消息编辑**，支持从历史位置重新编辑并继续对话；该能力仅在 API 渠道启用。
- **上下文管理**，支持摘要压缩和最近 N 轮裁剪，降低长会话超过模型上下文的风险。
- **浏览器控制受控标签组**，会用 Chrome 原生标签组标识当前任务，并让 `list_pages` / `select_page` 等工具聚焦在受控范围内。
- 外部链接统一在浏览器新标签页打开，避免在侧边栏中加载外站失败。
- 扩展身份与本地升级链路会尽量保留设置，提升覆盖安装时的稳定性。

### 多驱动核心对比

项目内置了多种驱动方案，位于 `services/providers`，并通过代码逻辑动态适配不同的使用场景：

| 驱动方案              | 逻辑入口               | 支持模型                 | 核心优势                                                            | 使用前提                |
| :-------------------- | :--------------------- | :----------------------- | :------------------------------------------------------------------ | :---------------------- |
| **Web Client**        | `web.js`               | 当前 Gemini Web 聊天模式 | **免 API Key**，复用 Gemini 网页版会话，支持可选临时对话            | 需保持 Google 账号登录  |
| **Official API**      | `official.js`          | Gemini Flash/Pro 预览版  | **极速响应**，支持 **Thinking** 与 Google Search grounding          | 需 Google AI Studio Key |
| **OpenAI Compatible** | `openai_compatible.js` | GPT/Claude/兼容模型      | **高扩展性**，支持 Chat Completions / Responses API 与可选联网搜索  | 需第三方服务密钥        |
| **OpenAI 官方 API**   | `openai_compatible.js` | GPT 推理/搜索模型        | 专门走 Responses API，支持 reasoning summary 与可选联网搜索         | 需 OpenAI API Key       |
| **DeepSeek API**      | `openai_compatible.js` | DeepSeek 对话/推理模型   | DeepSeek Chat Completions 默认端点，并显示 `reasoning_content`      | 需 DeepSeek API Key     |
| **OpenRouter API**    | `openai_compatible.js` | OpenRouter 模型 ID       | 可拉取 `/models`，支持 provider routing JSON 与原生 `reasoning`     | 需 OpenRouter API Key   |
| **通义 / DashScope**  | `openai_compatible.js` | Qwen 文本与 VL 模型      | 专门 DashScope 兼容端点，发送 `enable_thinking` 并支持 VL 图片输入  | 需 DashScope API Key    |
| **Anthropic API**     | `anthropic.js`         | Claude 模型              | 原生 Messages API，支持图片输入与 extended thinking 流式显示        | 需 Anthropic API Key    |
| **智谱 API**          | `openai_compatible.js` | GLM 模型                 | 专门 GLM Chat Completions profile，并发送原生 thinking 开关 payload | 需智谱 API Key          |

### 浏览器控制能力集

基于 `background/control/` 模块和 Chrome DevTools Protocol 实现，AI 可以通过本地工具循环执行复杂的 Agent 任务：

| 分类         | 核心指令                                                               | 代码实现逻辑                                                                            |
| :----------- | :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **导航控制** | `navigate_page`, `new_page`, `close_page`, `list_pages`, `select_page` | 调用 `chrome.tabs` 进行页面生命周期管理                                                 |
| **页面交互** | `click`, `hover`, `fill`, `fill_form`, `press_key`, `type_text`        | 基于 **Accessibility Tree** 生成 UID 进行精准操控，支持悬停、批量填表、组合键与聚焦输入 |
| **数据观测** | `take_snapshot`, `wait_for`, `handle_dialog`                           | 提取页面无障碍树并生成可复用 UID，也可等待目标文本出现或处理阻塞弹窗                    |
| **脚本执行** | `evaluate_script`                                                      | 在网页 Context 中运行自定义 JavaScript                                                  |

浏览器控制启用后会锁定一个目标标签页，并用 Chrome 原生标签组展示当前任务标题。`select_page` 默认只在受控标签组内切换；`new_page` 的普通标签页会加入该组，`background: true` 则会打开独立 popup 窗口以减少焦点干扰。

### 外部 MCP 工具

Gemini Nexus 可以选择连接到一个或多个外部 MCP 服务器（通过 **SSE**、**可流式传输的 HTTP** 或 **WebSocket**），并在现有的工具循环（Tool Loop）中执行其工具。

#### 推荐方案：使用本地代理（支持 stdio 服务器）

由于 Chrome 扩展程序无法直接运行基于 stdio 的 MCP 服务器，推荐的设置方案是运行一个本地代理（例如 [MCP SuperAssistant](https://github.com/srbhptl39/MCP-SuperAssistant) Proxy）。在代理中配置您的 MCP 服务器（包括 stdio 服务器），然后将 Gemini Nexus 连接到该代理端点。

常见的代理端点如下：

- **SSE**: `http://127.0.0.1:3006/sse`
- **可流式传输的 HTTP**: `http://127.0.0.1:3006/mcp`
- **WebSocket**: `ws://127.0.0.1:3006/mcp`

#### 设置步骤

1. 启动您的 MCP 代理并在其中配置好 MCP 服务器。
2. 在 **设置 (Settings) -> 连接 (Connection) -> 外部 MCP 工具 (External MCP Tools)** 中：
    - 启用"外部 MCP 工具" (Enable External MCP Tools)。
    - 新增或选择服务器条目；**活动服务器** (Active Server) 表示当前正在编辑的条目，对话时会使用所有已启用的服务器。
    - 选择传输协议并设置服务器 URL（SSE / 可流式传输的 HTTP / WebSocket）。
    - 如需自定义请求头，请使用 SSE 或可流式传输的 HTTP；浏览器扩展环境下 WebSocket 传输不支持自定义 headers。
    - 点击**测试连接** (Test Connection) 和**刷新工具** (Refresh Tools)。
3. 可选（当工具较多时推荐）：将**公开工具** (Expose Tools) 设置为**仅限选定工具** (Selected tools only)，然后仅启用您希望模型查看/使用的工具。
4. 开始正常对话；当模型需要使用工具时，它会输出一个如下所示的 JSON 工具块。多服务器模式下，模型可能会使用 `serverId__toolName` 形式的唯一工具名来路由到具体服务器：

    ```json
    { "tool": "工具名称", "args": { "键": "值" } }
    ```

### 核心功能亮点

- **智能侧边栏**：基于 `sidePanel` API，提供毫秒级唤起的对话空间，支持全文搜索历史记录。
- **划词工具栏**：注入 Content Script，选中文字即刻进行**翻译、总结、解释、语法修正**，支持一键回填表单。
- **图像与截图输入**：
    - **OCR & 截图翻译**：集成 Canvas 裁剪技术，框选图片区域即刻提取文字并翻译。
    - **屏幕/窗口截图**：侧边栏可通过浏览器的 `display-capture` 能力选择其他屏幕或应用窗口作为图像输入。
    - **浮窗探测**：自动识别网页图片并生成悬浮 AI 分析按钮。
    - **生成图像展示**：展示拉取到的 Gemini 原图，不在本地重写图片像素。
    - Gemini Web 逆向驱动当前支持图片附件；PDF、文本、文档类附件请使用 Gemini API 渠道。
- **安全渲染**：所有 Markdown、LaTeX 公式及代码块均在 `sandbox` 隔离环境中渲染，确保主页面安全。

### Gemini Web 维护说明

Gemini Web 依赖逆向协议，可能随网站更新而变化。当前契约记录在 [`docs/gemini-web-reverse.md`](docs/gemini-web-reverse.md)，包含已验证 token、RPC 路径、上传流程、模型 hash、临时对话标记、暂不支持的 image-preview 模型路由，以及手动漂移检查命令。

### 快速开始

#### 仓库结构

本仓库根目录就是可运行的 Chrome 扩展项目根目录。`package.json`、`manifest.json`、Vite 配置、源码、测试和打包脚本都位于根目录。跨运行域共享的工具代码位于 `shared/`，并按能力分组到 `shared/attachments/`、`shared/config/`、`shared/dom/`、`shared/logging/`、`shared/mcp/`、`shared/media/`、`shared/messaging/`、`shared/models/`、`shared/settings/`、`shared/text/`、`shared/ui/` 和 `shared/utils/`；不再保留顶层 `shared/*.js` 兼容入口。模块目录的聚合入口统一使用目录内 `index.js`，避免出现同级 `foo.js` 与 `foo/` 并存；运行域入口保留为各运行域根部的 `index.js`，例如 `background/index.js`、`content/index.js`、`sandbox/index.js`、`sidepanel/index.js`，以及独立设置页 `settings/index.js`。运行时代码文件使用 `snake_case`，仓库工具脚本和工作流文件可使用 `kebab-case`。

#### 安装步骤

1. 从 [Releases](https://github.com/yeahhe365/Gemini-Nexus/releases) 下载最新 ZIP 包并解压。
2. Chrome 访问 `chrome://extensions/`（Edge 访问 `edge://extensions/`），右上角开启 **"开发者模式"**。
3. 点击 **"加载已解压的扩展程序"**，选择解压后的文件夹即可。

#### 从源码构建与打包

```bash
npm install
npm run package:extension
```

> **重要：每次改完源码都要重新打包。**  
> `artifacts/chrome-extension` 是**生成产物**目录，不是源码本身。改了 `manifest.json`、`package.json`、`sidepanel/`、`sandbox/`、`background/` 等源码后，**不会**自动更新这个目录。浏览器里点 **重新加载 (Reload)** 也只是重新读取已经打好的包，所以旧包会继续显示旧版本（例如源码已升到 `9.0.5`，扩展管理里仍显示 `9.0.4`）。  
> 只要你希望浏览器里跑到最新改动，就再执行一次：
>
> ```bash
> npm run package:extension
> ```
>
> 然后再对扩展点 **重新加载**（或移除后重新加载 `artifacts/chrome-extension`）。  
> `npm run package:extension` 会执行 `vite build`，并把完整扩展（含当前 `manifest.json` 版本号）写入 `artifacts/chrome-extension`。

##### 加载打包后的扩展（推荐）

打包完成后，请用 **"加载已解压的扩展程序"**，并且**只选择**下面这个目录：

```text
artifacts/chrome-extension
```

Windows 示例路径：

```text
C:\path\to\gemini-nexus\artifacts\chrome-extension
```

步骤：

1. 打开 `chrome://extensions/`（Chrome）或 `edge://extensions/`（Edge）。
2. 开启 **开发者模式**。
3. 若是覆盖本地旧构建，先**移除旧扩展**。
4. 点击 **加载已解压的扩展程序**，选择 `artifacts/chrome-extension`。
5. 之后每次改完源码：先再跑 `npm run package:extension`，再在扩展卡片上点 **重新加载**（若版本号仍旧，则移除后重新加载）。

**不要**把下面这些路径当作扩展根目录加载：

| 路径 | 为什么不对 |
| :--- | :--------- |
| 仓库根目录 | 源码布局不是发布用的完整运行时布局。 |
| 只跑过 `npm run build` 的 `dist/` | 只有 Vite UI 产物，缺少完整打包（例如 content script 合并等）。半成品 `dist/` 可能导致侧栏空白。 |

`npm run build` 只会在 `dist/` 里生成 Vite 管理的 UI 页面，**不是**可直接安装的完整扩展目录。日常安装 / 重装 / 给别人用的本地包，请始终使用：

`npm run package:extension` → 加载 `artifacts/chrome-extension`。

发布包会把多个 content scripts 按 `manifest.json` 中的顺序合并为单个 `content/index.js`，并重写包内 manifest，避免发布产物依赖一长串手工脚本顺序。

##### 可选：用 `dist/` 做本地快速调试

如果只是本地快速改代码验证，并且有意维护一份完整的 `dist/`：

```bash
npm run build
# Windows：构建后把扩展运行时文件复制进 dist/
./copy-to-dist.bat
```

然后再用 **"加载已解压的扩展程序"** 选择 `dist/`。

> **注意**：`dist/` 仅适合开发调试；正式发布、重新安装或分享本地构建时，请使用 `artifacts/chrome-extension`，不要只加载半成品的 `dist/`。

#### 发布到 Chrome Web Store

Chrome Web Store 发布凭据只保存在本机，不要提交到仓库：

```bash
cp .env.chrome-webstore.example .env.chrome-webstore
```

编辑 `.env.chrome-webstore`，填入 `CHROME_WEBSTORE_PUBLISHER_ID`、`CHROME_WEBSTORE_ITEM_ID` 和具备 `https://www.googleapis.com/auth/chromewebstore` scope 的 `CHROME_WEBSTORE_ACCESS_TOKEN`。准备好 ZIP 后运行：

```bash
npm run publish:chrome-webstore
```

脚本会调用 Chrome Web Store API v2 上传 `CHROME_WEBSTORE_ZIP_PATH` 指向的 ZIP，并提交发布审核。

### 技术栈

- **构建工具**：Vite + TypeScript
- **架构协议**：Chrome MV3 + Chrome DevTools Protocol + 本地/外部 MCP 工具调用
- **核心库**：Marked.js, KaTeX, Highlight.js, Fuse.js

### 许可证

本项目基于 **MIT License** 开源。

### 致谢

本项目已在 [LINUX DO 社区](https://linux.do) 发布，感谢社区的支持与反馈。
