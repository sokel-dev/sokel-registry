# 小米 MiMo

小米 MiMo 开放平台（`https://api.xiaomimimo.com/v1`）的接入：OpenAI 兼容线缆。

## 能做什么

| 能力 | 上游模型 | 说明 |
| --- | --- | --- |
| 对话 | `mimo-v2.6-flash` / `mimo-v2.6-pro` / `mimo-v2.6-pro-ultraspeed` | 思考只有开关（`thinking:{type}`，默认开）；思考模式下上游会把 temperature / top_p 强制成推荐值 |
| 语音合成 | `mimo-v2.5-tts`（预置音色）/ `mimo-v2.5-tts-voicedesign`（文本描述音色）/ `mimo-v2.5-tts-voiceclone`（样本复刻） | 走 chat/completions 变体：待念文本在 assistant 消息、风格指令在 user 消息；格式 mp3 / wav / pcm16（pcm16 由插件裹成 WAV） |
| 语音识别 | `mimo-v2.5-asr` | 只收 mp3 / wav；语种 auto / zh / en |

MiMo 没有嵌入与重排。

## 凭证

- `api_key`：开放平台的 API Key。
- `base_url`：缺省 `https://api.xiaomimimo.com/v1`，走代理时改这里。官方主机只填 `https://api.xiaomimimo.com` 也行，平台会补 `/v1`；自建网关按它实际的路径填，平台不猜。

## 音色

预置音色（`mimo-v2.5-tts`）：`mimo_default`、冰糖、茉莉、苏打、白桦（中文）；Mia、Chloe、Milo、Dean（英文）。
中文名本身就是音色 id。复刻模型把样本音频（mp3 / wav，≤10MB）作为「音色样本」传入；音色设计模型不传音色，靠风格指令描述。

风格控制：user 消息里写自然语言指令（语气 / 情绪 / 角色），或在待念文本里用 `(风格)` 前缀与 `[标签]`（如 `(开心)你好 [笑]`）。

## 计价

对话按 token；TTS 系列目前限时免费（计价单位选「每 1M token」即可）；ASR 按音频时长（计价单位「每小时音频」）。
