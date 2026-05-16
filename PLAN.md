# TMDB 手动辅助匹配元数据方案

## 目标

通过 OpenList 的“全局设置 -> 自定义头部 / 自定义内容”插入 CSS 和 JavaScript，为普通目录页面增加一个“手动辅助匹配 TMDB 元数据”的工具。

用户只需要在当前浏览器中设置一次 TMDB API Key，之后可以在不同存储、不同目录页面中选择一个或多个视频文件，手动搜索并匹配 TMDB 条目，然后按需执行：

- 改名
- 获取封面
- 生成 / 上传 NFO

需要同时覆盖电影和电视剧场景，并支持单条与多条处理。

## 当前结论

注入版 MVP 可行，不需要改 OpenList 后端。

现有后端 API 已覆盖核心文件操作：

- 当前目录列表：`POST /api/fs/list`
- 批量重命名：`POST /api/fs/batch_rename`
- 写入文件：`PUT /api/fs/put`

前端源码显示：

- `customize_head` 插入在 `index.html` 的 `<head>` 顶部。
- `customize_body` 插入在主应用脚本之后。
- 普通站点页面会注入自定义内容，`/@manage` 管理页不会注入。
- 登录 token 存在 `localStorage.token`，请求时作为 `Authorization` 头传给后端。
- 文件选择状态在 Solid store 内部，没有挂到 `window`。目录项 DOM 上有 `.viselect-item.selected` 和 `data-index`，但直接依赖 DOM 选中状态不够稳定。

因此推荐注入脚本自己调用 `/api/fs/list` 读取当前目录文件，并在自己的模态框中管理选择状态。可以额外尝试从当前 DOM 选中项初始化选择，但不能把它作为唯一数据来源。

## UI 入口

按钮放在现有右下角工具栏中，和刷新、新建文件、新建文件夹、批量重命名、上传等按钮在同一组工具栏内。

注入版实现方式：

- 通过 `MutationObserver` 等待右下角工具栏出现。
- 定位 `.left-toolbar-in` 或现有右下角 toolbar 容器。
- 插入一个 TMDB 按钮，视觉上尽量贴近现有 `RightIcon` 风格。
- 点击按钮打开注入脚本自己的模态框。

如果以后改前端源码，入口应放在：

- `src/pages/home/toolbar/Right.tsx`
- `src/pages/home/toolbar/operations.ts`
- `src/pages/home/toolbar/Toolbar.tsx`

新增一个 `TMDBMatch` 模态组件，通过现有 `bus.emit("tool", "...")` 机制打开。

## 注入脚本结构

建议拆成以下逻辑模块，即使最终放在一个 `<script>` 中，也保持内部结构清晰。

1. 配置模块
   - 读取 API base：优先 `window.OPENLIST_CONFIG.api`，否则 `location.origin + base_path`。
   - 读取 base path：`window.OPENLIST_CONFIG.base_path`。
   - 读取 OpenList token：`localStorage.getItem("token")`。
   - 读取 / 保存 TMDB API Key：`localStorage.openlist_tmdb_api_key`。
   - 读取 / 保存偏好：语言、图片尺寸、命名模板、NFO 模式等。

2. OpenList API 模块
   - `fsList(path)`
   - `batchRename(srcDir, renameObjects)`
   - `putFile(path, blobOrText, contentType, overwrite)`
   - `refreshCurrentPage()`，可简单使用 `location.reload()`，后续再优化为触发前端刷新。

3. TMDB API 模块
   - `searchMovie(query, year?)`
   - `searchTv(query, firstAirYear?)`
   - `searchMulti(query)`
   - `getMovieDetails(id)`
   - `getTvDetails(id)`
   - `getTvSeason(id, seasonNumber)`
   - `getTvEpisode(id, seasonNumber, episodeNumber)`
   - `buildImageUrl(filePath, size)`

4. 文件名解析模块
   - 识别视频扩展名：`mkv`, `mp4`, `avi`, `mov`, `wmv`, `flv`, `ts`, `m2ts`, `webm`, `rmvb`, `iso` 等。
   - 提取电影候选名、年份。
   - 提取电视剧季集信息：
     - `S01E02`
     - `s01e02`
     - `1x02`
     - `第02集`
     - `EP02`
   - 保留原扩展名。

5. UI 模块
   - TMDB API Key 设置区。
   - 文件选择区，默认列出当前目录视频文件。
   - 模式选择：电影 / 电视剧。
   - 搜索和结果列表。
   - 匹配预览。
   - 操作勾选：改名、封面、NFO。
   - 执行进度和每个文件的结果。

## 电影流程

适合一条或多条电影文件。

1. 用户打开 TMDB 工具。
2. 脚本拉取当前目录文件列表。
3. 用户选择一个或多个视频文件。
4. 对每个文件从文件名提取标题和年份。
5. 用户可以：
   - 单条手动搜索并选择 TMDB movie。
   - 多条逐条确认。
   - 多条自动搜索后人工修正。
6. 生成预览：
   - 新文件名，例如：`电影名 (年份).ext`
   - NFO 文件名，例如：`电影名 (年份).nfo` 或同 basename 的 `.nfo`
   - 封面文件名，例如：`电影名 (年份)-poster.jpg` 或 `poster.jpg`
7. 用户确认后执行改名、封面、NFO 上传。

电影 NFO 可优先生成 Jellyfin / Kodi 兼容的基础字段：

- `title`
- `originaltitle`
- `year`
- `plot`
- `runtime`
- `tmdbid`
- `uniqueid type="tmdb"`
- `premiered`
- `rating`
- `genre`
- `studio`
- `thumb`
- `fanart`

## 电视剧流程

第一版建议限制为“当前目录内同一部剧的多集文件”，不要一开始支持跨剧批量匹配。

1. 用户选择多个视频文件。
2. 选择“电视剧”模式。
3. 用户搜索并确认 TMDB TV show。
4. 脚本按文件名解析季、集。
5. 显示每个文件的匹配结果：
   - 原文件名
   - 解析出的季 / 集
   - TMDB episode 标题
   - 新文件名预览
   - NFO / 封面输出路径
6. 对解析失败的文件，要求用户手动填写季 / 集。
7. 确认后执行。

电视剧推荐命名模板：

- 单集文件：`剧名 - S01E02 - 集名.ext`
- 单集 NFO：同 basename 的 `.nfo`
- 单集缩略图：同 basename 的 `.jpg`
- 剧集级 NFO：`tvshow.nfo`
- 剧集封面：`poster.jpg` 或 `folder.jpg`

电视剧 NFO 可生成：

- `tvshow.nfo`
- 每集的 `episodedetails` NFO

第一版可以只生成每集 NFO，后续再补 `tvshow.nfo` 和季封面。

## 单条与多条策略

单条：

- 默认使用当前文件名作为搜索词。
- 用户选择一个 TMDB 条目。
- 可立即展示最终文件名、封面、NFO 预览。

多条电影：

- 不建议完全自动确认。
- 可以自动搜索每条的候选结果，但必须让用户逐条确认或批量确认低风险项。
- 每条保留独立状态：未匹配、已匹配、跳过、失败。

多条电视剧：

- 推荐先选择同一个 TV show，再批量解析季集。
- 对解析成功的集数批量填充 TMDB episode 数据。
- 对解析失败或 TMDB 无结果的项要求手动修正。

## 权限与限制

执行前需要检查：

- 当前不是分享页。
- 当前目录 `write` 为 true。
- 改名需要当前用户有 rename 权限。
- 写封面 / NFO 需要用户有 write_content 权限，或当前目录允许 `write_content_bypass`。

注入版可以通过实际调用 API 的返回结果处理权限错误，也可以先调用 `/api/fs/list` 读取 `write` 和 `write_content_bypass` 做基础提示。

限制：

- TMDB API Key 存在浏览器 `localStorage`，不是服务端全局配置。
- 直接从浏览器访问 TMDB API 和图片可能受到网络环境或 CORS 影响。
- 批量操作没有事务，可能部分成功、部分失败。
- 注入脚本依赖前端 DOM 结构插入按钮，OpenList 前端升级后可能需要调整选择器。

## 错误处理

每个文件都需要独立记录状态：

- 待处理
- 搜索中
- 已匹配
- 改名成功 / 失败
- 封面成功 / 失败
- NFO 成功 / 失败
- 已跳过

批量执行时不要因为单个文件失败中断整个任务，除非失败发生在全局前置条件，例如 TMDB API Key 无效。

常见错误提示：

- TMDB API Key 缺失或无效。
- 当前目录无写权限。
- 当前用户无重命名权限。
- 当前用户无上传权限。
- 文件名解析失败。
- TMDB 无搜索结果。
- 目标文件名已存在。
- 封面下载失败。
- NFO 上传失败。

## 分阶段实现

### Phase 1：注入版 MVP

- 在右下角工具栏插入 TMDB 按钮。
- 支持设置 TMDB API Key。
- 支持当前目录视频文件列表。
- 支持单个电影手动搜索、匹配。
- 支持改名。
- 支持生成并上传电影 NFO。
- 支持下载并上传电影 poster。

### Phase 2：电视剧和批量

- 支持电视剧搜索。
- 支持文件名解析季集。
- 支持多集文件批量匹配同一个 TV show。
- 支持每集 NFO 和每集缩略图。
- 支持多条执行进度和失败重试。

### Phase 3：体验增强

- 多条电影自动搜索候选结果。
- 命名模板配置。
- NFO 模板配置。
- 图片类型选择：poster、backdrop、still。
- 图片语言和尺寸偏好。
- 匹配结果缓存。
- 执行日志导出。

### Phase 4：正式前端 / 后端集成

如果注入版验证效果好，可以改成正式功能：

- 前端新增 toolbar 按钮和 TMDB 模态组件。
- 复用 Solid store 中的 `selectedObjs()`、`objStore.write`、`userCan()`。
- 后端新增 TMDB 代理接口，避免浏览器 CORS 和网络问题。
- 可选：服务端保存 TMDB API Key，避免每个浏览器重复设置。

## 推荐的第一版范围

第一版只做以下能力：

- 右下角工具栏 TMDB 按钮。
- 当前目录视频文件选择。
- TMDB API Key localStorage 保存。
- 电影单条匹配。
- 电影多条逐条匹配。
- 改名。
- 上传同 basename 的 `.nfo`。
- 上传同 basename 的 `-poster.jpg`。

电视剧批量、复杂命名模板、自动跨剧识别放到第二版。
