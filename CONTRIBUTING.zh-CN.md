# 参与贡献

[English](CONTRIBUTING.md) · 简体中文

这里的一切改动都走 PR。CI 检查机械部分，其余由 CODEOWNERS 里的负责人审核。

## 新增插件

1. **写好并发布插件。** 用[插件 SDK](https://github.com/sokel-dev/sokel-plugin-sdk)；它的 `sokel-plugin-dev`
   skill 能让本地编程 agent 完成大部分工作。发布一个别人能运行的东西——公开仓库里的镜像，或 release 二进制——
   源码保持公开。
2. **定好 org。** `org` 是发布者：你的 GitHub 用户名或组织名，小写。不能用 `sokel`（那是 Sokel 项目自己维护的插件）。
3. **新增条目。** 创建 `plugins/<org>/<name>/manifest.yml`（`sokel-gen` 可以从插件导出），`plugin.org` 与
   `plugin.name` 要和目录一致，并写上 `plugin.version`。可选：`locales/<lang>.json`、`README.md`。
4. **配一个图标**（可选，建议）：manifest 里写 `plugin.icon`，取值二选一：
   - `icon.svg` / `icon.png`：放在条目目录里的文件；
   - `brand:<id>`：`site/brands.js` 里已有的品牌图标（如 `brand:gitlab`）。

   CI 会检查文件：SVG 不能含脚本、事件属性或外部引用，最大 32 KB；PNG 至少 128×128、最大 64 KB；接近正方形。
   平台自己提供这份文件，不会去别人的服务器加载。不配图标时显示首字母。
5. **新 org 的第一个插件：** 在同一个 PR 里往 `.github/CODEOWNERS` 加一行 `/plugins/<org>/ @你的账号`。
   之后这个 org 下的改动都需要你批准。
6. **本地检查：** `go run ./cmd/build-index -site _site .` 必须通过。
7. **提 PR**，按模板填写。

CI 之外，审核会看：

- org 确实属于你，名字没有冒充别的产品或发布者；
- 它要的凭证是它真需要的，说明里写清楚这些凭证会送到哪里；
- `deployment` 里的镜像或二进制出自你给的源码，且源码公开；
- 容器镜像钉死了：不是 `latest` 的标签，最好带摘要（`image:1.2.0@sha256:…`）。改动的条目 CI 一律拒绝 `latest` 和没标签的镜像；
  `sokel/*` 条目必须带摘要，其他 org 只提醒。摘要是镜像仓库唯一改不了指向的引用，目录的版本和安全通告只有在镜像还是审核时那份的前提下才有意义；
- 使用说明能让一个陌生人把它跑起来。

## 官方条目（`plugins/sokel/`）

`sokel` org 的条目和其他人的一样在这里维护：提 PR、升版本号，由 Sokel 维护者审核。有几处是生成的，请用工具改、别手改：
模型厂商等由 shell 承接的插件，契约段来自平台的 shell schema（平台仓库里的 `reembed-llm` / `reembed-shell`）；
`site/brands.js` 来自平台的品牌图标表。[官方插件](https://github.com/sokel-dev/sokel-official-plugins)的发版会以 PR 的形式到这里：
在那边打 `<插件>/vX.Y.Z` 标签，它的 Release 流水线按插件代码重写条目契约、把镜像按摘要钉死，然后开 PR，由维护者审核合并。
平台内置的是本仓某个固定提交的快照：合并的改动在平台挪动这个提交后进入内置目录，把本站设为刷新源的平台会更早拿到。

## 发布新版本

改你条目下的文件，并**升高 `plugin.version`**。CI 会和 `main` 对比，改了文件却没升版本（或降了版本）会被拒：
平台按版本判断「有更新」、按版本匹配安全通告，不升版本的改动对它们是看不见的。由你 org 的负责人批准。

## 报告已发布版本的问题（安全通告）

- **已经公开、或风险较低：** 提 PR 往 `advisories.json` 加一条（语法见 [ADVISORIES.zh-CN.md](ADVISORIES.zh-CN.md)）。
  `warn` 标出这个版本；`block` 让平台拒绝调用它。
- **尚未公开：** 用 GitHub 的私密漏洞报告（Security → Report a vulnerability），先修再公告。

通告合并后，把本站设为刷新源的平台在下一次刷新时生效；此后的每个平台版本也会把它带进内置快照。

用新版本修复，并在通告里写明受影响范围（例如 `["<v1.2.0"]`）。

## 下架插件

删掉它的目录。已装的照常工作，但不再有更新和通告。下架需要维护者批准。

## 合并之后

发布流程几分钟内重建 `index.json` 并部署页面。把这个站点设为刷新源的平台会在下一次刷新时拿到
（每 12 小时一次，或点「立即同步」）；内置快照随平台版本更新。
