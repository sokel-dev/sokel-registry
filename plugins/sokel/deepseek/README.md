# DeepSeek

Use an API key from https://platform.deepseek.com. The default base URL is
https://api.deepseek.com; a compatible proxy may include a trailing `/v1`.
Every operation uses the existing DeepSeek credential. Files belong to the upstream
account and are shared by its API keys.

## Capabilities

- **Chat** keeps the existing model gateway and streaming interface.
- **Speech** calls the full-text TTS API. Select WAV or PCM16 (returned as playable
  WAV), voice `stella` (female) or `tide` (male). The upstream detects language.
  Audio is 24 kHz, 16-bit mono. MP3, speed changes, style prompts and voice cloning
  are unavailable. `extra_body: {"filter_markdown": false}` preserves Markdown.
  Limit: 10,000 billed characters and a 64 KiB request; Chinese characters count
  as two. The model field is not sent because this is a model-free API.
- **Transcription** accepts 16-bit PCM WAV or Ogg Opus, at most 8 MiB and 120 seconds.
  WAV sample rates: 8, 16, 22.05, 24, 32, 44.1 or 48 kHz. With stereo, only the left
  channel is recognized. Language is automatic; prompts are unsupported. Audio
  duration is rounded up to whole seconds for metering. No streaming ASR is available.
- **Web search** returns normalized results plus summaries, page content, source
  metadata and relevance scores. Queries support `site:`, `lang:`, `after:` and
  `before:`. Limit: 128 Unicode characters, 1–50 results. The standalone API does
  not provide image search; use the chatbot web tool for image search.
- **Content processing** OCRs one authorized platform file into standard content
  for workflows and knowledge ingestion. Sources retain the original file ID;
  character references target the extracted text. The API does not return actual
  page dimensions, so physical page/bounding-box coordinates are not fabricated.

## Application operations

`ocr` supports PDF, DOC/DOCX, PPT/PPTX and common images, up to 100 MiB and
1,000 pages. Choose `text_recognition` or `rich_layout_recognition`. Both modes
can contain layout markers when the API recognizes pages instead of extracting text.

- `text` and `pages[].text` contain readable text with recognized layout metadata
  removed. Markdown, HTML tables and formulas remain intact. Regions and pages
  are joined by a blank line; plain text without markers is unchanged.
- `raw_text` and `pages[].raw_text` preserve the original model output, including
  `<｜ref｜>` and `<｜box｜>` markers. Use these fields for custom parsing.
- `pages[].layout` contains the original region `type`, body `text`, `boxes` and
  `text_range`. Each box is `{x1,y1,x2,y2}`, with a top-left origin and values
  normalized to 0–1000. Convert to pixels using `x * width / 1000` and
  `y * height / 1000` with actual page dimensions. `text_range` is a Unicode
  character range `[start,end)` in the cleaned page text, omitted for empty regions.
- Invalid coordinates are omitted with a warning; original metadata remains in
  `raw_text`. Incomplete trailing metadata on truncated pages is excluded from
  readable text. Incomplete pages and unparsed metadata also produce warnings.

In knowledge base settings, expand a content processing rule and its Processing options to select Text recognition or Rich layout recognition. This saves `options.purpose`; the default is `text_recognition`. New intake tasks use the saved options, while existing tasks keep their original rule snapshot.

The `process` capability uses the same readable text and creates standard content
blocks from recognized regions, with character references to that text. If OCR consumes
input tokens but returns no output tokens and entirely empty completed pages, content
processing retries once with the same recognition mode. A second empty result fails
before indexing; this extra recognition may be billed. Direct `ocr` calls return the
original result without retrying. Other empty extractions retain the original file. Neither operation fabricates physical page
dimensions or downloads cropped figures. Recognition errors in HTTP 200 responses
are still reported as errors. See the [official OCR response format](https://api-docs.deepseek.com/zh-cn/guides/ocr/#响应).

`fetch` reads an HTTP(S) page as Markdown. `upload_file` uploads images or parses
documents for chat; choose `user_data` for images/text/spreadsheets/ebooks, and
`text_recognition` or `rich_layout_recognition` for PDF/Word/PowerPoint. Rich
parsing gives the chat model extracted figures as well as text. Limits: images
64 MiB; documents 100 MiB; text/spreadsheets/ebooks 32 MiB. Optional expiration:
3,600–2,592,000 seconds; omitted means permanent storage. `list_files` preserves
pagination (`last_id` to `after`, `has_more`), `get_file` retrieves metadata, and
`delete_file` removes a named upstream file. Originals and parsed content cannot
be downloaded through this API.

`chatbot` uses `deepseek-flash`. Enable web search and URL reading independently;
turn on thinking for multi-step deep search. Supply uploaded `file_ids`, optionally
request a conversation title, and choose `high` or `low` content safety (`high`
by default). `latest_reminder` carries date, weekday, location, platform and
language in the upstream comma-separated format. Append the full returned
`message` to `history.messages` unchanged, together with user messages and prior
metadata markers. The raw response preserves citations, server tools, token usage
and safety metadata. A `content_filter` finish returns an empty answer. These
features are also available on the model gateway via native requests/extra body;
this plugin operation exposes them explicitly for workflows. `max_tokens` limits
each inference step, not the entire search round.

`speech_stream` sends an ordered array of text chunks over the WebSocket TTS API.
It collects PCM frames and publishes a WAV file only after a successful `finish`
event. It accepts a finite chunk array; it is not a live microphone or a duplex
socket exposed to workflow callers. Cancellation closes the socket. A premature
close or upstream error fails the operation.

## Verification and billing

Credential checks use the model-list endpoint. New operations make billable
requests; authentication success alone does not guarantee balance or feature access.
OCR and document parsing continue upstream after disconnection and may be billed
if completed. Inspect warnings for truncated OCR pages. HTTP failures, invalid
JSON, oversized responses and partial audio are surfaced without automatic retries.

Official references (checked 2026-11-14):
- https://api-docs.deepseek.com/guides/build_a_chatbot/
- https://api-docs.deepseek.com/guides/tts/
- https://api-docs.deepseek.com/guides/asr/
- https://api-docs.deepseek.com/guides/ocr/
- https://api-docs.deepseek.com/guides/search/
- https://api-docs.deepseek.com/guides/files_api/
