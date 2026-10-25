const { callGemini } = require('./gemini_service');
const brandConfig = require('../config/brand.json');

/**
 * Generate Master Article based on Research Pack and Betty's Personal Input
 */
async function generateMasterArticle(idea, researchPack, interviewAnswers, options = {}) {
  const grounding = researchPack.psychology_grounding || {};
  const citations = grounding.citations || (grounding.academic_citations || []).map(c => ({ citation: c, status: 'unverified' }));
  const usable = citations.filter(c => ['trusted', 'verified', 'corrected'].includes(c.status));
  const unconfirmed = citations.filter(c => !['trusted', 'verified', 'corrected'].includes(c.status));

  // Determine if the author provided flexible free_notes (e.g. from Gemini Notebook / NotebookLM) or legacy structured questions
  const freeNotes = (interviewAnswers.free_notes || '').trim();
  const hasFreeNotes = freeNotes.length > 0;

  let authorInputSection = '';
  if (hasFreeNotes) {
    authorInputSection = `
【作者親自撰寫的筆記與架構（來自自由書寫 / Gemini Notebook 整理）】：
"""
${freeNotes}
"""
這是本文的核心與靈魂。請從中萃取：
- 作者對這個主題真正在意的事與觀點
- 作者提到的真實經驗或觀察（絕不編造未提及的情節）
- 作者想分享的那個「換個角度看」的想法
- 作者自己試過、或想分享的小做法
`;
  } else {
    authorInputSection = `
【作者先前回答的問題】：
1. 為什麼這個主題對我重要？：${interviewAnswers.q1_importance || '無特定'}
2. 我親身經歷或觀察到的例子？：${interviewAnswers.q2_experience || '無特定'}
3. 我想避免的過度簡化說法？：${interviewAnswers.q3_oversimplification || '無特定'}
4. 我最先注意到的是什麼？：${interviewAnswers.q4_client_notice || '無特定'}
5. 一個可以試試看的小做法？：${interviewAnswers.q5_small_experiment || '無特定'}
`;
  }

  const disclaimer = brandConfig.safety_and_ethics?.disclaimer_template || '';

  const prompt = `
請以作者的第一人稱「我」，依據研究包與作者的筆記，寫一篇溫暖、清楚、有佐證的【正體中文分享文章（母文章）】。
這是「分享」而不是「教學」：像一位有想法的朋友，分享自己注意到的事、讀到的研究、以及自己的經驗。

【主題與研究包背景】：
- 主題：${idea.title}
- 核心洞見：${researchPack.central_insight || idea.title}
- 相關領域：${(grounding.fields || []).join('、') || '依主題而定'}
- 主要視角或概念：${grounding.primary_framework || '依作者筆記而定'}
- 相關作者/研究者：${(grounding.theorists || []).join(', ') || '（無）'}
- 佐證說明要點：${grounding.theoretical_explanation || ''}
- 來源實際說法：${(researchPack.source_says || []).join('；') || '（無）'}
- 來源致謝：${researchPack.source_attribution_notes || '（無）'}

【可直接引用的來源（已查證）】：
${usable.length ? usable.map(c => `- ${c.citation}`).join('\n') : '（無已查證來源：文中不要寫出具體文獻，只可用「有研究/觀點認為」等描述，並在參考資料段落標記 [VERIFY]）'}

【尚未查證的來源（若使用，必須在該句後方標記 [VERIFY]）】：
${unconfirmed.length ? unconfirmed.map(c => `- ${c.citation}`).join('\n') : '（無）'}

${authorInputSection}

【建議結構（依內容調整順序與比重，不需要每段都有，也可以合併；請讓文章自然流動）】：
- 開場：一個讀者熟悉的情境，或我自己的一個瞬間
- 我注意到的事 / 核心想法
- 為什麼這說得通：引用佐證（任何領域皆可），用白話解釋，不堆砌術語
- 我的經驗或觀察（若筆記中沒有，請寫 [VERIFY: 待補充個人例子]）
- 其他可能的角度（避免單一歸因）
- 一兩個可以試試看的小做法（用「我會…/對我有幫助的是…」的分享口吻，不是指導）
- 留給讀者的思考（邀請式，不是作業）
- 結語，並邀請讀者留言分享自己的經驗或追蹤
- 參考資料 + 免責聲明

請撰寫完整的文章（約 1,000 ~ 1,500 字），段落有呼吸感、排版優雅，可用 Markdown 小標題。

【不可違反】
- 全文第一人稱「我」；不可自稱「Betty 教練」、「教練」或「老師」，不可用第三人稱稱呼作者。
- 不可邀請或提及任何教練會談、諮詢、諮商或付費服務。
- 若筆記中缺少親身故事，不可編造經歷，必須在該處寫「[VERIFY: 待補充個人例子]」。
- 參考資料只列「已查證來源」與來源致謝；未查證的來源若出現必須帶 [VERIFY]。
- 文末免責聲明請原文使用以下文字（不可改寫、不可加入服務介紹）：
  ${disclaimer}
`;

  // Build parts if images or attachments are present
  const images = interviewAnswers.images || options.images || [];
  let parts = null;
  if (Array.isArray(images) && images.length > 0) {
    parts = [];
    for (const img of images) {
      if (img.data && img.mimeType) {
        // base64 inline data
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data.replace(/^data:[^;]+;base64,/, '')
          }
        });
      }
    }
    parts.push({ text: prompt });
  }

  return await callGemini({
    prompt: parts ? undefined : prompt,
    parts: parts || undefined,
    systemInstruction: "你是一位擅長把個人思考寫成溫暖、易讀、有佐證的分享文的編輯。請嚴格根據提供的事實、筆記與故事撰寫，絕不捏造經歷或他人隱私。",
    temperature: 0.65,
    includeLearning: true
  });
}

/**
 * Count [VERIFY] markers deterministically (not left to the model).
 */
function countVerifyMarkers(text) {
  return ((text || '').match(/\[VERIFY[^\]]*\]/gi) || []).length;
}

/**
 * Find phrases that advertise coaching / counselling services or use a coach self-title.
 * Returns the unique matched phrases (empty array if clean).
 */
const COACHING_PATTERNS = [
  /Betty\s*教練/g,
  /一對一[^\n。，]{0,6}(教練|會談|諮詢|諮商)/g,
  /教練(會談|服務|課程|諮詢)/g,
  /(預約|報名|探索)[^\n。，]{0,8}(教練|諮詢|諮商)/g,
  /(諮詢|諮商)服務/g
];

function findCoachingMentions(text) {
  const hits = new Set();
  for (const re of COACHING_PATTERNS) {
    for (const m of (text || '').matchAll(re)) hits.add(m[0]);
  }
  return [...hits];
}

/**
 * Run CLEAR Review Gate
 */
async function runClearReview(masterArticle) {
  const prompt = `
請以最嚴謹的品質與倫理標準，針對這篇母文章進行【CLEAR 五維度審查】：

母文章全文：
"""
${masterArticle}
"""

審查指標：
1. **C - Complete (完整性)**：是否有清楚的核心想法、佐證、作者的經驗或觀察（或 [VERIFY] 標記）、可以試試的做法與結語？（不要求固定結構）
2. **L - Clear (清晰度)**：專有名詞是否用白話解釋，讀者不需背景知識也能懂？
3. **E - Evidence (實證與邊界)**：佐證可來自任何可信領域；是否把「研究/資料事實」、「個人經驗」與「觀點詮釋」清楚分開？有無未經證實的絕對化斷言？
4. **A - Audience (讀者共感度)**：是否貼近喜歡思考、想把事情想清楚的讀者，而非空泛的心靈雞湯？
5. **R - Revise (語氣與安全性)**：是否為第一人稱、像朋友分享的溫暖語氣，而非教學或說教？是否沒有自稱「教練/老師」？是否沒有邀請或提及教練會談、諮詢、諮商等服務？是否避免任何臨床診斷字眼？文末是否有免責聲明？

請回傳格式化 JSON 物件：
{
  "overall_status": "PASSED 或 REVISE",
  "gates": {
    "complete": {"status": "PASS/REVISE", "comment": "簡要點評"},
    "clear": {"status": "PASS/REVISE", "comment": "簡要點評"},
    "evidence": {"status": "PASS/REVISE", "comment": "簡要點評"},
    "audience": {"status": "PASS/REVISE", "comment": "簡要點評"},
    "revise": {"status": "PASS/REVISE", "comment": "簡要點評"}
  },
  "safety_check": {
    "has_diagnostic_language": false,
    "has_disclaimer": true,
    "mentions_coaching_service": false,
    "uses_teaching_voice": false,
    "unsupported_claims_flagged": ["若有過度絕對的說法則列出，否則為空陣列"]
  },
  "specific_revision_suggestions": [
    "具體修改建議 1",
    "具體修改建議 2",
    "具體修改建議 3"
  ]
}
`;

  const review = await callGemini({
    prompt,
    systemInstruction: "你是一位嚴謹的內容品質與倫理審查員，秉持客觀、溫和但嚴格的品管原則，特別留意語氣是否為分享而非教學、以及是否有任何服務推銷。只輸出合法 JSON。",
    temperature: 0.2,
    jsonMode: true
  });

  review.verify_markers = countVerifyMarkers(masterArticle);
  // Deterministic backstop: never rely only on the model to catch service mentions / coach self-titles
  const coachingHits = findCoachingMentions(masterArticle);
  review.safety_check = review.safety_check || {};
  if (coachingHits.length) {
    review.safety_check.mentions_coaching_service = true;
    review.safety_check.coaching_mentions_found = coachingHits;
    review.overall_status = 'REVISE';
  }
  review.reviewed_at = new Date().toISOString();
  review.stale = false;
  return review;
}

module.exports = {
  generateMasterArticle,
  runClearReview,
  countVerifyMarkers,
  findCoachingMentions
};
