# OpenList TMDB 影视元数据助手

OpenList TMDB 影视元数据助手是一组可直接粘贴到 OpenList 自定义头部和自定义内容中的注入片段，用于在 OpenList 目录页面中添加 TMDB 手动匹配工具。它可以帮助个人影视库完成电影、电视剧文件重命名，并生成 Kodi / Jellyfin 兼容的 NFO 元数据文件。

关键词：OpenList TMDB、OpenList 刮削、OpenList 影视元数据、TMDB 元数据匹配、电影重命名、电视剧重命名、NFO 生成、Jellyfin NFO、Kodi NFO、媒体库整理、影视库整理。

## 功能特性

- 在 OpenList 目录页右下角工具栏添加 TMDB 匹配按钮。
- 自动读取当前 OpenList 文件夹中的视频文件。
- 支持电影、电视剧单集，以及同目录多集电视剧的 TMDB 手动确认。
- 支持常见电影年份、电视剧季集信息批量解析。
- 通过 OpenList API 执行视频文件重命名。
- 生成 Kodi / Jellyfin 可识别的基础 movie / episode NFO。
- 电视剧批量处理中可逐集预览新文件名和 NFO，并手动修正季 / 集。
- 在浏览器 `localStorage` 中保存 TMDB API Key，避免重复输入。
- 不需要修改 OpenList 后端源码，适合作为轻量级自定义增强脚本使用。

## 文件说明

- `head.html`：粘贴到 OpenList 的 `customize_head` / 自定义头部字段，主要包含样式。
- `body.html`：粘贴到 OpenList 的 `customize_body` / 自定义内容字段，主要包含交互脚本。
- `PLAN.md`：实现方案、API 调研和设计取舍。
- `TODOs.md`：已完成功能、待办事项和已知限制。

## 使用方法

1. 打开 OpenList 管理后台。
2. 进入全局设置或对应的自定义 HTML 配置区域。
3. 将 `head.html` 的完整内容粘贴到自定义头部。
4. 将 `body.html` 的完整内容粘贴到自定义内容。
5. 保存设置后，回到普通目录页面。
6. 点击右下角工具栏中的 TMDB 按钮，输入 TMDB API Key 后开始匹配。
7. 处理电视剧目录时，可勾选多集文件，选择 TMDB 剧集条目后逐集确认再批量执行。

## 适用场景

- 已经在 OpenList 中管理电影、电视剧资源。
- 希望手动确认 TMDB 匹配结果，避免全自动刮削误匹配。
- 希望为 Jellyfin、Kodi 等媒体库生成基础 NFO 文件。
- 不想维护额外后端服务，只想通过 OpenList 自定义 HTML 增强页面能力。

## 环境要求

- OpenList 已启用自定义头部和自定义内容配置。
- 拥有 TMDB API Key 或 TMDB Bearer Token。
- 浏览器可以从 OpenList 页面访问 TMDB API。

## 当前限制

- 电视剧批量确认限定在当前目录内同一部剧，不处理跨剧批量。
- 批量操作没有事务，部分文件失败时需要按失败项重试。
- 封面下载和更完整的元数据检查仍在规划中。
- TMDB API Key 保存在当前浏览器本地，不是 OpenList 服务端全局配置。
- 注入脚本依赖 OpenList 前端页面结构，OpenList 升级后可能需要适配。
