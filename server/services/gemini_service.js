const { getSetting, getDb } = require('../db');
const brandConfig = require('../config/brand.json');

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function getApiKey() {
  return process.env.GEMINI_API_KEY || getSetting('gemini_api_key');
}

function buildBrandContext() {
  const safety = brandConfig.safety_and_ethics || {};
  const voiceRules = (brandConfig.voice_rules || []).map(r => `- ${r}`).join('\n');
  const ctaOptions = (brandConfig.cta_options || []).join('；');
  return `
你是協助 Betty 整理與撰寫「${brandConfig.brand_name}」個人分享內容的編輯夥伴。
【作者定位與語氣】：
- 角色：${brandConfig.positioning.roles.join('、')}。
- 語氣：${brandConfig.positioning.tone}。
- 核心承諾：${brandConfig.positioning.core_promise}。
- 語言：${brandConfig.language}。

【語氣與自稱（重要）】：
${voiceRules}

【結尾邀請只能是】：${ctaOptions}。
禁止提及或邀請任何教練會談、諮詢、諮商或付費服務。

【免責聲明（需要時一律原文使用，不可改寫或加入服務介紹）】：
${safety.disclaimer_template || ''}

【倫理與安全紅線 (最高優先級)】：
1. 嚴禁任何臨床診斷或病理化標籤，一律採用可能性語氣（「這可能反映了…」、「或許可以探索」）。
2. 不承諾任何療效或結果；不推銷任何服務。
3. 嚴格區分「研究/資料指出」、「常見說法」與「我（作者）的個人經驗與想法」。
4. 絕不捏造文獻、作者、年份、研究數據或作者的個人經歷；不確定的內容一律標記 [VERIFY]。
5. 涉及身心健康、創傷或重大困擾的話題時，語氣更謹慎並保留免責聲明。
`;
}

const VOICE_SAMPLE_CHARS = 1200;

/**
 * Betty's learning library → prompt context for writing tasks.
 *  rule   — writing preferences / banned phrases (all active, max 15)
 *  lesson — what performed well or badly (latest 10)
 *  voice  — excerpts of articles Betty edited herself (latest 2)
 */
function buildLearningContext() {
  const db = getDb();
  if (!db) return '';
  const rows = (category, limit) => {
    const res = db.exec(
      `SELECT title, content FROM learning_library WHERE category = '${category}' AND COALESCE(is_active, 1) = 1 ORDER BY created_at DESC LIMIT ${limit}`
    );
    return res[0] ? res[0].values.map(([title, content]) => ({ title, content })) : [];
  };

  const rules = rows('rule', 15);
  const lessons = rows('lesson', 10);
  const voice = rows('voice', 2);
  if (!rules.length && !lessons.length && !voice.length) return '';

  const parts = ['【作者的寫作學習庫（請優先遵守，與上方紅線衝突時以紅線為準；若內容含有教練/服務相關說法，以上方語氣規則為準）】'];
  if (rules.length) {
    parts.push('寫作偏好與禁用說法：', ...rules.map(r => `- ${r.content}`));
  }
  if (lessons.length) {
    parts.push('過往成效學到的事：', ...lessons.map(l => `- ${l.title ? `${l.title}：` : ''}${l.content}`));
  }
  if (voice.length) {
    parts.push(
      '作者親自修訂過的文字範本（只模仿語氣、節奏與用詞，不可複製內容或故事）：',
      ...voice.map(v => `<voice_sample>\n${(v.content || '').slice(0, VOICE_SAMPLE_CHARS)}\n</voice_sample>`)
    );
  }
  return parts.join('\n');
}

/**
 * Extract a JSON value from model text (handles code fences / leading prose).
 */
function extractJson(text) {
  if (!text) throw new Error('模型沒有回傳內容');
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const firstObj = cleaned.indexOf('{');
    const firstArr = cleaned.indexOf('[');
    const starts = [firstObj, firstArr].filter(i => i >= 0);
    if (!starts.length) throw new Error('回傳內容不是 JSON');
    const start = Math.min(...starts);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Low-level Gemini call via REST.
 * Returns { text, json, grounding, finishReason }.
 *
 * @param {object} opts
 * @param {string} [opts.prompt]           plain-text prompt (ignored if parts given)
 * @param {Array}  [opts.parts]            raw content parts (text / fileData)
 * @param {string} [opts.systemInstruction]
 * @param {boolean}[opts.jsonMode]         parse output as JSON
 * @param {Array}  [opts.tools]            e.g. [{ googleSearch: {} }]
 * @param {boolean}[opts.includeBrand]     append brand context to system instruction
 * @param {string} [opts.mediaResolution]  e.g. 'MEDIA_RESOLUTION_LOW' for long videos
 */
async function generate({
  prompt,
  parts,
  systemInstruction,
  temperature = 0.7,
  jsonMode = false,
  tools,
  includeBrand = true,
  includeLearning = false,
  modelName = DEFAULT_MODEL,
  mediaResolution,
  retries = 2
}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('尚未設定 Gemini API Key。請至設定頁面輸入，或設定環境變數 GEMINI_API_KEY。');
  }

  const sys = [
    systemInstruction,
    includeBrand ? buildBrandContext() : '',
    includeLearning ? buildLearningContext() : ''
  ].filter(Boolean).join('\n\n');

  const body = {
    contents: [{ role: 'user', parts: parts || [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: 32768 }
  };
  if (sys) body.systemInstruction = { parts: [{ text: sys }] };
  // Structured JSON output cannot be combined with tools — fall back to prompt-instructed JSON
  if (jsonMode && !tools) body.generationConfig.responseMimeType = 'application/json';
  if (tools) body.tools = tools;
  if (mediaResolution) body.generationConfig.mediaResolution = mediaResolution;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1500 * attempt);
    try {
      const res = await fetch(`${API_BASE}/${modelName}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errText = await res.text();
        const err = new Error(`Gemini API ${res.status}: ${errText.slice(0, 400)}`);
        err.status = res.status;
        // Retry only on rate limits / server errors
        if (res.status === 429 || res.status >= 500) { lastError = err; continue; }
        throw err;
      }

      const data = await res.json();
      const cand = data.candidates?.[0];
      const finishReason = cand?.finishReason;
      const text = (cand?.content?.parts || [])
        .filter(p => typeof p.text === 'string' && !p.thought)
        .map(p => p.text)
        .join('');

      if (!text) {
        lastError = new Error(`模型沒有回傳文字（finishReason: ${finishReason || data.promptFeedback?.blockReason || 'unknown'}）`);
        continue;
      }

      let json = null;
      if (jsonMode) {
        try {
          json = extractJson(text);
        } catch (e) {
          lastError = new Error(
            finishReason === 'MAX_TOKENS'
              ? '輸出內容過長被截斷，請縮短輸入或分段生成'
              : `JSON 解析失敗：${e.message}`
          );
          if (finishReason === 'MAX_TOKENS') {
            lastError.noRetry = true;
            throw lastError;
          }
          continue;
        }
      }

      return { text, json, grounding: cand.groundingMetadata || null, finishReason };
    } catch (err) {
      if (err.noRetry) throw err;
      if (err.status && err.status < 500 && err.status !== 429) throw err;
      lastError = err;
    }
  }
  throw lastError || new Error('Gemini 呼叫失敗');
}

/**
 * Backward-compatible helper: returns parsed JSON (jsonMode) or text.
 */
async function callGemini(opts) {
  const result = await generate(opts);
  return opts.jsonMode ? result.json : result.text;
}

module.exports = {
  generate,
  callGemini,
  getApiKey,
  extractJson
};
