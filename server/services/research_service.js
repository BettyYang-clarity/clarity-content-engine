const { generate } = require('./gemini_service');
const { prepareSource } = require('./source_fetcher');
const frameworksData = require('../knowledge/psychology_frameworks.json');

/**
 * Citation statuses:
 *  trusted     — matches Betty's trusted source list
 *  verified    — confirmed via Google Search
 *  corrected   — exists, but details were wrong; corrected_citation holds the fix
 *  not_found   — search could not confirm it exists  → [VERIFY]
 *  unverified  — search did not run / failed          → [VERIFY]
 */
const NEEDS_VERIFY = ['not_found', 'unverified'];

function normalize(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

function matchTrusted(citation, trustedSources) {
  const n = normalize(citation);
  if (!n) return null;
  return trustedSources.find(t => {
    const tn = normalize(t.citation);
    // Match if one contains the first 30 normalized chars of the other (author + year + title start)
    return tn && (tn.includes(n.slice(0, 30)) || n.includes(tn.slice(0, 30)));
  }) || null;
}

/**
 * Step 1 — Build the Research Pack from the real source content.
 */
async function buildResearchPack(idea, trustedSources, onProgress = () => {}) {
  onProgress(1, 3, idea.source_url ? '讀取來源內容' : '整理筆記');
  const source = await prepareSource(idea);
  onProgress(2, 3, '尋找跨領域佐證、整理研究包');

  const frameworksSummary = frameworksData.frameworks.map(f =>
    `- 【${f.name}】代表學者: ${f.theorists.join(', ')}。核心概念: ${f.core_concepts.join('、')}`
  ).join('\n');

  const trustedList = trustedSources.length
    ? trustedSources.map((t, i) => `${i + 1}. ${t.citation}`).join('\n')
    : '（目前沒有）';

  const prompt = `
你現在要協助作者為一篇個人分享文章做「佐證研究」與內容解構。
作者的思考偏向心理與自我覺察，但主題不限領域；你的任務是找到「真正能說明這個想法」的可信佐證，而不是把主題硬套進某個心理學理論。

【靈感資訊】
- 標題/主題：${idea.title}
- 來源類型：${idea.source_type || '個人觀察與靈感'}
- 來源作者/出處：${idea.author || '未註明'}
- 來源連結：${idea.source_url || '無'}
- 來源讀取狀態：${source.meta.message}
- 作者的原始筆記：
${idea.raw_notes || '（無額外筆記）'}

【研究方法】
1. 先判斷哪些領域最能解釋這個主題：心理學、行為經濟學、神經科學、管理學、哲學、教育、社會學、知名書籍或可信的報導等皆可，可同時跨多個領域。
2. 從那些領域找出可信的研究、理論、書籍或資料來支持（或挑戰）這個想法。
3. 不要為了「看起來學術」而硬套理論；若沒有合適的理論，primary_framework 寫「個人觀察，無特定理論」即可。

【心理學參考架構（僅供參考，不需套用；主題不適合時請完全忽略）】
${frameworksSummary}

【作者的信任文獻清單（若相關則優先引用）】
${trustedList}

【引用規則（非常重要）】
1. 若信任文獻清單中有相關文獻，優先引用並將 from_trusted_list 設為 true；不相關就不要硬引。
2. 只有在你非常確定該文獻或資料真實存在時，才可列出清單以外的來源；不確定就不要列。
3. 絕不可編造作者、年份、期刊、卷期或頁碼。寧可少列，不可錯列。
4. 若有附上來源內容，「source_says」必須只根據該內容，不可補充來源沒說的事。

請只回傳 JSON，結構如下（psychology_grounding 為歷史欄位名稱，內容可來自任何領域）：
{
  "source_summary": "來源客觀事實摘要（200字內，避免照抄原文）",
  "central_insight": "核心洞見（一句話）",
  "source_says": ["來源實際提出的重點（若無來源內容則為空陣列）"],
  "research_suggests": ["研究、理論或資料對此的觀點（標明來自哪個領域/理論）"],
  "interpretation_space": ["留給作者個人詮釋的空間或可能角度"],
  "key_concepts": [{"term": "名詞", "definition": "白話且精確的定義"}],
  "psychology_grounding": {
    "fields": ["相關領域，例如：行為經濟學、管理學"],
    "primary_framework": "最主要的視角或概念名稱（任何領域；無則寫「個人觀察，無特定理論」）",
    "theorists": ["相關作者或研究者"],
    "citations": [{"citation": "APA 格式引用", "from_trusted_list": true, "relevance": "此來源支持哪個論點"}],
    "theoretical_explanation": "用白話說明：為什麼這個想法說得通（或有哪些限制）",
    "recommended_reading": ["延伸閱讀書目或可信資源"]
  },
  "claims_to_verify": ["需要查證或容易被過度簡化的說法"],
  "alternative_interpretations": ["避免單一歸因的其他可能解釋"],
  "content_angles": [{"angle_name": "切角名稱", "target_audience": "適合誰", "hook": "開場切入點"}],
  "source_attribution_notes": "正式引用此來源時必須標註的致謝說明"
}
`;

  const parts = [...source.parts, { text: prompt }];
  const systemInstruction = '你是一位跨領域、重視證據的研究助理，擅長找出能說明一個想法的可信來源，並用白話解釋。只輸出合法 JSON。';

  let result;
  try {
    result = await generate({
      parts,
      systemInstruction,
      temperature: 0.3,
      jsonMode: true,
      mediaResolution: source.meta.status === 'youtube' ? 'MEDIA_RESOLUTION_LOW' : undefined
    });
  } catch (err) {
    // If the video could not be processed (private / too long / region-locked), fall back to notes only
    if (source.meta.status !== 'youtube') throw err;
    source.meta = { status: 'error', message: `YouTube 影片無法分析（${err.message.slice(0, 120)}），本次僅依據筆記分析`, url: idea.source_url };
    result = await generate({
      parts: [{ text: prompt.replace(/來源讀取狀態：.*\n/, `來源讀取狀態：${source.meta.message}\n`) }],
      systemInstruction,
      temperature: 0.3,
      jsonMode: true
    });
  }

  const pack = result.json;
  pack.source_fetch = source.meta;
  return pack;
}

/**
 * Step 2 — Verify citations with Google Search grounding.
 */
async function verifyCitations(citations, trustedSources) {
  const results = citations.map(c => {
    const text = typeof c === 'string' ? c : c.citation;
    const trusted = matchTrusted(text, trustedSources);
    return {
      citation: text,
      relevance: typeof c === 'object' ? c.relevance || '' : '',
      status: trusted ? 'trusted' : 'pending',
      note: trusted ? '符合信任文獻清單' : '',
      corrected_citation: null
    };
  });

  const pending = results.map((r, i) => ({ ...r, index: i })).filter(r => r.status === 'pending');
  let searchSources = [];

  if (pending.length) {
    const prompt = `
請使用 Google 搜尋，逐條查證以下文獻或資料來源是否真實存在，並確認作者、年份、標題、出處是否正確。

${pending.map(p => `[${p.index}] ${p.citation}`).join('\n')}

判定規則：
- verified：找到可信來源，且作者、年份、標題大致正確
- corrected：文獻存在，但作者/年份/標題/出處有誤，請提供正確 APA 引用
- not_found：搜尋後無法確認此文獻存在

只輸出 JSON 陣列，不要任何其他文字：
[{"index": 0, "status": "verified|corrected|not_found", "corrected_citation": "若為 corrected 才填，否則 null", "note": "簡短說明查證依據（例如出版社或期刊網站）"}]
`;
    try {
      const res = await generate({
        prompt,
        systemInstruction: '你是嚴謹的學術文獻查證員。只依據搜尋結果判斷，不確定就判定 not_found。',
        includeBrand: false,
        temperature: 0,
        jsonMode: true,
        tools: [{ googleSearch: {} }]
      });

      const chunks = res.grounding?.groundingChunks || [];
      searchSources = chunks
        .filter(c => c.web?.uri)
        .map(c => ({ title: c.web.title || c.web.uri, uri: c.web.uri }));

      const searched = searchSources.length > 0;
      const verdicts = Array.isArray(res.json) ? res.json : [];

      pending.forEach(p => {
        const v = verdicts.find(x => Number(x.index) === p.index);
        const target = results[p.index];
        if (!searched) {
          // Model answered without actually searching — do not trust its verdict
          target.status = 'unverified';
          target.note = '本次未執行搜尋，無法確認';
        } else if (v && ['verified', 'corrected', 'not_found'].includes(v.status)) {
          target.status = v.status;
          target.note = v.note || '';
          target.corrected_citation = v.status === 'corrected' ? v.corrected_citation || null : null;
        } else {
          target.status = 'unverified';
          target.note = '查證結果缺漏';
        }
      });
    } catch (err) {
      pending.forEach(p => {
        results[p.index].status = 'unverified';
        results[p.index].note = `查證失敗：${err.message.slice(0, 120)}`;
      });
    }
  }

  return { results, searchSources, verifiedAt: new Date().toISOString() };
}

/**
 * Full research pipeline: read source → build pack → verify citations → flag [VERIFY].
 */
async function generateResearchPack(idea, trustedSources = [], onProgress = () => {}) {
  const pack = await buildResearchPack(idea, trustedSources, onProgress);
  const grounding = pack.psychology_grounding || (pack.psychology_grounding = {});
  const citations = grounding.citations || [];

  onProgress(3, 3, `用 Google 搜尋查證 ${citations.length} 筆文獻`);
  const verification = await verifyCitations(citations, trustedSources);

  // Replace citations with verified objects (use corrected text where applicable)
  grounding.citations = verification.results.map(r => ({
    citation: r.status === 'corrected' && r.corrected_citation ? r.corrected_citation : r.citation,
    original_citation: r.status === 'corrected' ? r.citation : undefined,
    relevance: r.relevance,
    status: r.status,
    note: r.note
  }));
  grounding.search_sources = verification.searchSources;
  grounding.verified_at = verification.verifiedAt;

  // Keep the legacy string list for older prompts/UI
  grounding.academic_citations = grounding.citations.map(c => c.citation);

  // Every unconfirmed citation becomes a [VERIFY] item
  pack.claims_to_verify = (pack.claims_to_verify || []).filter(Boolean);
  grounding.citations
    .filter(c => NEEDS_VERIFY.includes(c.status))
    .forEach(c => pack.claims_to_verify.push(`[VERIFY] 引用未能查證：${c.citation}`));

  return pack;
}

module.exports = {
  generateResearchPack,
  verifyCitations,
  NEEDS_VERIFY
};
