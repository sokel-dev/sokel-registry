# 文本内容处理

实现 `content/process` v1，支持纯文本和 Markdown。文件输入保留平台原件，文本输入保留原文，内容块提供 Unicode 字符位置。

此实现随平台基础插件构建；目录中的镜像已固定摘要，启动时启用 `SOKEL_BASE_PLUGINS=content-text`，仅注册文本处理这一项插件。安装并确认健康后，在知识库内容处理规则中绑定 `text/plain` 或 `text/markdown`。

# Text content processing

Implements `content/process` v1 for plain text and Markdown, preserving originals and Unicode character locations. Use the digest-pinned base-plugin image in the manifest and enable `SOKEL_BASE_PLUGINS=content-text` to register only the text processor. Bind a healthy installation to the appropriate knowledge-base MIME rules.
