# DeepSeek

在 https://platform.deepseek.com 获取 API Key，默认地址为 https://api.deepseek.com，也支持带 `/v1` 后缀的兼容代理地址。所有操作复用现有 DeepSeek 凭证。上传的文件属于上游账户，同一账户的 API Key 共享文件。

## 平台能力

- **对话**：保留原有模型网关及流式对话接口。
- **语音合成**：选择 WAV 或 PCM16，返回可播放的 WAV。音色为 `stella`（女声）和 `tide`（男声），自动识别语言，24 kHz、16 位单声道。不支持 MP3、调速、风格指令和音色复刻。`extra_body` 支持 `{"filter_markdown": false}`。最多 10,000 个计费字符，汉字按两个计费；请求不超过 64 KiB。上游无需模型名。
- **语音识别**：支持 16 位 PCM WAV 和 Ogg Opus，最多 8 MiB、120 秒。WAV 采样率支持 8、16、22.05、24、32、44.1、48 kHz；立体声只识别左声道。自动识别语言，不支持提示词及流式识别。计费时长向上取整到秒。
- **网页搜索**：返回标题、链接、摘要、正文、来源和相关性分数。支持 `site:`、`lang:`、`after:`、`before:`，查询最多 128 个 Unicode 字符，每次 1–50 条结果。独立搜索接口暂不支持图片搜索，聊天工具支持。
- **内容处理**：将一个已授权的平台文件进行 OCR，转换为知识库和工作流可用的标准内容。保留原件文件 ID，字符范围定位到提取文本。上游没有实际页面尺寸，因此不生成虚假的页面或物理坐标。

## 专用操作

`ocr` 支持 PDF、DOC/DOCX、PPT/PPTX 和常见图片，最多 100 MiB、1,000 页。可选 `text_recognition` 或 `rich_layout_recognition`。上游逐页识别时，两种模式都可能带有排版标记；直接提取文字的文档不带标记。

- `text` 和 `pages[].text` 返回去除已解析排版标记后的可读文本，保留 Markdown、HTML 表格和公式。区域和页面之间以空行连接；没有标记的纯文本保持原样。
- `raw_text` 和 `pages[].raw_text` 保留模型原始输出，包括 `<｜ref｜>`、`<｜box｜>` 等标记，可用于自行解析。
- `pages[].layout` 包含区域原始类型 `type`、正文 `text`、坐标 `boxes` 和字符范围 `text_range`。坐标为 `{x1,y1,x2,y2}`，以左上角为原点，按页面宽高归一化到 0–1000。使用真实页面尺寸，按 `x * 宽度 / 1000`、`y * 高度 / 1000` 转为像素。`text_range` 是可读页面文本中的 Unicode 字符范围 `[start,end)`；空区域不提供字符范围。
- 无效坐标会被忽略并给出警告，原始数据仍保留在 `raw_text`。被截断页面末尾的不完整排版标记不会混入可读文本；页面未识别完整或仍有无法解析的标记时也会给出警告。

在知识库设置的“内容处理”中，展开规则及“处理选项”，可选择“文字识别”或“版面识别”。对应参数为 `options.purpose`，默认值为 `text_recognition`。保存后对新录入任务生效，已有任务保留创建时的规则快照。

“内容处理”使用相同的可读文本，按区域生成标准内容块，字符引用指向清理后的文本。如果 OCR 消耗了输入 token，但输出 token 为 0 且所有正常结束的页面原文都为空，内容处理会按原识别模式重试一次；再次为空则在入库前报错，额外识别可能计费。直接调用 `ocr` 不自动重试，仍返回原始结果。其他未提取出文字的情况保留原件文件。两个操作都不会编造实际页面尺寸或下载裁剪图片。即使 HTTP 状态是 200，响应中的错误仍按失败处理。详见[官方 OCR 响应格式](https://api-docs.deepseek.com/zh-cn/guides/ocr/#响应)。

`fetch` 将 HTTP(S) 网页读取为 Markdown。`upload_file` 上传文件供后续聊天使用：图片、文本、表格和电子书选 `user_data`；PDF、Word、PowerPoint 选文字识别或富排版识别。富排版文件解析会同时向聊天模型提供提取的图片。图片上限 64 MiB，文档 100 MiB，文本、表格、电子书 32 MiB。可设置 3,600–2,592,000 秒过期，不填则永久保存。

`list_files` 保留分页信息，将 `last_id` 作为下次的 `after`，通过 `has_more` 判断是否继续。`get_file` 查询元数据；`delete_file` 删除指定的上游文件。上游不提供原文件或解析结果下载。

`chatbot` 使用 `deepseek-flash`，可开启网页/图片搜索、深度思考搜索、URL 阅读、文件问答、会话标题和内容安全检查，安全级别默认 `high`。`latest_reminder` 按上游格式提供日期、星期、位置、客户端和语言。多轮聊天时，将完整返回的 `message` 原样放入 `history.messages`，同时保留用户消息和此前的元数据消息。原始响应保留引用、服务端工具调用、用量和安全元数据；内容被过滤时答案为空。`max_tokens` 限制每个推理步骤，并非整轮搜索。模型网关原生请求或额外 body 也可配置这些上游特性。

`speech_stream` 将有序文本片段数组发送到 WebSocket TTS 接口，收到成功结束事件后才发布 WAV 文件。它接收有限数组，不向工作流暴露实时双向套接字，也不是实时麦克风输入。取消会关闭连接；异常断流或上游报错均按失败处理。

## 验证与计费

凭证检查调用模型列表接口，不产生模型 token。新操作会产生真实调用费用，凭证有效不代表账户余额或特性权限充足。OCR 和文件解析可能在客户端断开后继续运行并计费。请检查逐页截断警告。HTTP 错误、错误 JSON、过大响应和可检测的音频传输中断都会返回错误，不自动重试。

官方说明（2026-11-14 核对）：
- https://api-docs.deepseek.com/guides/build_a_chatbot/
- https://api-docs.deepseek.com/guides/tts/
- https://api-docs.deepseek.com/guides/asr/
- https://api-docs.deepseek.com/guides/ocr/
- https://api-docs.deepseek.com/guides/search/
- https://api-docs.deepseek.com/guides/files_api/
