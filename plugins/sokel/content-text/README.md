# 文本内容处理

实现 `content/process` v1，支持纯文本和 Markdown。文件输入保留平台原件，文本输入保留原文，内容块提供 Unicode 字符位置。

此实现随平台基础插件构建：部署本版本 `plugin-builtin`，启用 `SOKEL_BASE_PLUGINS=content-text`。本条目未填写远端镜像地址；发布镜像后应按目录贡献规则补入带摘要的不可变引用。安装并确认健康后，在知识库内容处理规则中绑定 `text/plain` 或 `text/markdown`。

# Text content processing

Implements `content/process` v1 for plain text and Markdown, preserving originals and Unicode character locations. Build the matching platform `plugin-builtin` source and enable `SOKEL_BASE_PLUGINS=content-text`. No remote image is advertised by this entry; add an immutable digest after publishing. Bind a healthy installation to the appropriate knowledge-base MIME rules.
