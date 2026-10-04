# Sokel 插件目录

[English](README.md) · 简体中文

[Sokel](https://github.com/sokel-dev) 工作流平台的插件目录，以及展示它的页面：
**https://sokel-dev.github.io/sokel-registry/**

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
site/                   # 页面（无构建步骤）
cmd/build-index/        # 准入检查与发布目录
```

目录就是身份：`plugins/acme/foo` 就是 `acme/foo`；每个 org 由谁维护写在 `.github/CODEOWNERS`。

## 平台怎么用它

平台自带这份目录的内置快照，离线也能用。管理员可以把这个站点设为刷新源（**平台设置 → 插件索引源**，
地址填 `https://sokel-dev.github.io/sokel-registry`）：平台每 12 小时拉一次 `index.json` 和 `advisories.json`，
新插件出现在市场里并从同一来源安装，已装版本命中安全通告时会标出来。默认关闭——没人打开就不会联网。

## 本地运行

```bash
go run ./cmd/build-index -site _site .             # 准入 + 生成发布目录
go run ./cmd/build-index -base ../main-checkout .  # PR 的版本检查
cd _site && python3 -m http.server                 # 打开 http://localhost:8000
```

## 许可

[Apache-2.0](LICENSE)。各插件的许可以它自己的仓库为准。
