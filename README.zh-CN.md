# Sokel 插件目录

[English](README.md) · 简体中文

[Sokel](https://github.com/sokel-dev) 工作流平台的插件目录，以及展示它的页面：
**https://plugins.sokel.dev/**

插件代码在它自己的仓库里。这里放的是它的 **manifest**——每个操作收什么、出什么，要哪些凭证，怎么运行——
加上可选的翻译和使用说明。平台读这份目录来填充自己的插件市场；这个页面读的也是同一批文件。

## 插件怎么进来

1. 用[插件 SDK](https://github.com/sokel-dev/sokel-plugin-sdk)（Go / Python / TypeScript）写好插件，
   发布一个别人能运行的镜像或二进制。
2. 提 PR，新增 `plugins/<org>/<name>/manifest.yml`。CI 自动检查，维护者审核。
3. 合并后几分钟内，目录重建并发布到上面的页面。

发新版本、报安全通告走同一套 PR 流程，见 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。

## 布局

```
plugins/<org>/<name>/
  manifest.yml          # 唯一必需（manifest.yaml / manifest.json 也行）
  locales/<lang>.json   # 可选翻译：原文 -> 译文
  README.md             # 可选使用说明，显示在详情页
advisories.json         # 安全通告，语法见 ADVISORIES.zh-CN.md
site/                   # 页面（无构建步骤）；site/brands.js 由平台的品牌图标表生成
cmd/build-index/        # 准入检查与发布目录
```

目录就是身份：`plugins/acme/foo` 就是 `acme/foo`；每个 org 由谁维护写在 `.github/CODEOWNERS`。

`sokel` 发布者命名空间之外的条目会标注“第三方发布”，详情页和安装弹窗提醒用户在授权数据与凭证前，
核对发布者、代码来源与所需权限。来源提示与针对具体版本的安全通告分别展示；由 Sokel 发布不代表
所有上游接入都使用对应服务的官方接口。

## 平台怎么用它

平台自带这份目录的内置快照，离线也能用。管理员可以把这个站点设为刷新源（**平台设置 → 插件索引源**，
地址填 `https://plugins.sokel.dev`）：平台每 12 小时拉一次 `index.json` 和 `advisories.json`，
新插件出现在市场里并从同一来源安装，已装版本命中安全通告时会标出来。默认关闭——没人打开就不会联网。安全通告也会随每个平台版本发布（镜像构建时带上当时的通告），
离线部署升级平台即可拿到。

## 本地运行

只预览 registry 页面、使用官方线上目录，无需启动平台或登录：

```bash
python3 scripts/preview.py
# 打开 http://127.0.0.1:5180/?base=https://plugins.sokel.dev/&lang=zh
```

预览服务禁用浏览器缓存，避免修改后混用新页面和旧样式。更新线上页面时，同步递增
`site/index.html` 的资源版本与 `site/style.css` 中 tokens 导入的版本。

构建并预览当前仓库中的目录：

```bash
go run ./cmd/build-index -site _site .             # 准入 + 生成发布目录
go run ./cmd/build-index -base ../main-checkout .  # PR 的版本检查
cd _site && python3 -m http.server                 # 打开 http://localhost:8000
```

目录支持中英文交叉搜索，业务分类、平台能力、发布者、事件触发和部署产物组合筛选，以及排序和卡片/列表视图。
筛选、页码和视图保存在链接中。每页渲染 24、48 或 96 条；打开插件才加载详情，展开操作才渲染参数。

首页保留原来的主视觉和品牌图标区，每个发现分组最多展示 6 个插件；搜索和分类入口进入 `#/plugins`
完整目录。从详情返回时，回到此前的首页或目录。

发现逻辑位于 `site/catalog.js`：优先使用 index 的 `categories`，旧官方条目按完整 ref 使用兼容分类表；
没有分类的新插件进入“未分类”。浏览器仍下载完整的轻量 index，分页控制的是渲染量，不是索引下载量。
没有根据索引中不存在的数据推测热门程度或发布时间。

无依赖 UI 测试：`node --test tests/*.test.cjs`。浏览器测试包含 2,000 条模拟插件和真实线上索引检查，
可复用已有 Playwright 安装：

```bash
PLAYWRIGHT_MODULE=/path/to/node_modules/@playwright/test node tests/catalog-browser.mjs
PLAYWRIGHT_MODULE=/path/to/node_modules/@playwright/test node tests/publisher-risk-browser.mjs
```

发布者风险测试只在浏览器中模拟第三方条目，覆盖名称冒充官方、原安装跳转、中英文、手机布局及安全通告分别展示。

## 许可

[Apache-2.0](LICENSE)。各插件的许可以它自己的仓库为准。
