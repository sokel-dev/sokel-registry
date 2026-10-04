# 安全通告（advisories.json）

[English](ADVISORIES.md) · 简体中文

标记「某插件的某些版本有问题」的唯一入口。平台随索引消费它：命中已装版本 → 市场/插件列表/详情
标红 + 平台告警；`block` 级还会**拒绝该插件的调用**（报错点名原因与链接）。

**信任纪律**：与 org 判定同一条——平台只信 registry 附带的这份文件（GitOps 审核改动），
插件自报的任何「我没问题/我有问题」都不看。

条目形状（`advisories` 数组元素）：

```json
{
  "ref": "sokel/example",           // 完整 <org>/<name>
  "versions": ["<v1.2.0"],          // 受影响版本：精确（"v1.0.1"）或范围（<,<=,>,>= 前缀）
  "severity": "warn",               // warn = 标红提醒；block = 另加拒绝调用
  "reason": "凭证可能被记录进调试日志",
  "url": "https://…/GHSA-xxxx",      // 详情链接，可空
  "published": "2026-09-06"
}
```

维护：提 PR 改本文件 → CI 校验 ref 存在、字段合法（本地可跑 `go run ./cmd/build-index -site _site .`）→ 评审合并后随目录一起发布。尚未公开的漏洞先走 GitHub 私密漏洞报告，见 [CONTRIBUTING.zh-CN.md](CONTRIBUTING.zh-CN.md)。

## 版本表达式（2026-09-06 起）

`versions` 每项是**精确版本**或**范围**：

- 精确：`"v1.0.1"` —— 与已装版本归一比较（v 前缀不敏感，`v1.0.1` 命中 `1.0.1`）。
- 范围：`"<v1.2.0"` / `"<=…"` / `">…"` / `">=…"` —— semver 大小比较，典型用法
  「v1.2.0 已修复 → 之前的全部中招」写成 `["<v1.2.0"]`。
- 版本格式：`v?MAJOR.MINOR.PATCH(-prerelease)?`，build-index 校验，写错整份拒收。
- 已装版本解析不了（历史脏值）时：范围**永不命中**（未知 ≠ 中招），精确项退回逐字符
  ——按脏值点名的老通告仍然有效。
