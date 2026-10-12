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

  // Determine if Betty provided flexible free_notes (e.g. from Gemini Notebook / NotebookLM) or traditional structured questions
  const freeNotes = (interviewAnswers.free_notes || '').trim();
  const hasFreeNotes = freeNotes.length > 0;

  let bettyInputSection = '';
  if (hasFreeNotes) {
    bettyInputSection = `
【Betty 親自撰寫的架構筆記與核心洞見（來自自由書寫 / Gemini Notebook 整理）】：
"""
${freeNotes}
"""
請將上述內容視為 Betty 本篇母文章的最核心靈魂與個人真誠觀點。
請從中深刻萃取：
- Betty 對此主題的真實價值觀與關切點
- Betty 所提及的真實生活觀察或個案同行體驗（絕不編造未提及的情節）
- Betty 想陪伴受眾看見的隱微盲點與溫和重構 (Reframe)
- 可落地的微小行動或日常實驗
`;
  } else {
    bettyInputSection = `
【Betty 親自回答的 5 個核心洞見】：
1. 為什麼這個主題對你重要？：${interviewAnswers.q1_importance || '無特定'}
2. 你親身經歷或觀察到的具體生活案例？：${interviewAnswers.q2_experience || '無特定'}
3. 你特別想破除、避免過度簡化的迷思是什麼？：${interviewAnswers.q3_oversimplification || '無特定'}
4. 在教練對話中，你會陪伴個案最先看見什麼？：${interviewAnswers.q4_client_notice || '無特定'}
5. 讀者今天就能嘗試的一個極微小實驗？：${interviewAnswers.q5_small_experiment || '無特定'}
`;
  }

  const prompt = `
請以 Betty 的第一人稱專屬語氣，依據已審核的研究包（Research Pack）與 Betty 親自提供的個人洞見與筆記，撰寫一篇高品質、富有學理深度與溫度的【正體中文母文章】。

【主題與研究包背景】：
- 主題：${idea.title}
- 核心洞見：${researchPack.central_insight}
- 心理學理論依據：${grounding.primary_framework || '正向心理學與認知重塑'}
- 代表學者：${(grounding.theorists || []).join(', ')}
- 學理解釋要點：${grounding.theoretical_explanation || ''}
- 來源實際說法：${(researchPack.source_says || []).join('；') || '（無）'}
- 來源致謝：${researchPack.source_attribution_notes || '（無）'}

【可直接引用的文獻（已查證）】：
${usable.length ? usable.map(c => `- ${c.citation}`).join('\n') : '（無已查證文獻：文中不要寫出具體文獻，只可用「有心理學觀點認為」等描述，並在 Sources 段落標記 [VERIFY]）'}

【尚未查證的文獻（若使用，必須在該句後方標記 [VERIFY]）】：
${unconfirmed.length ? unconfirmed.map(c => `- ${c.citation}`).join('\n') : '（無）'}

${bettyInputSection}

【母文章嚴格結構 (12 步架構)】：
1. **Hook（共鳴開場）**：描繪一個受眾極有感、真實的情境或心聲。
2. **Problem（表層困境）**：受眾在當下的痛苦感受、糾結或過度思考。
3. **Pattern（隱微模式）**：揭示藏在表象底下的自動化運作模式。
4. **Insight（核心重構）**：顛覆原先自我批判的一記清亮重構 (Reframe)。
5. **Psychology Explanation（學理深度解析）**：精準帶入心理學理論（如 ${researchPack.psychology_grounding?.primary_framework || '心理學理論'}），用清晰易懂的語言解釋「為什麼大腦/身心會有這個反應」，並註明學理出處。
6. **Betty's Observation（教練個人觀察與故事）**：融入 Betty 的真實觀察或生活案例，展現同行陪伴的溫度（絕不可無中生有捏造經歷）。若 Betty 筆記中未提及具體故事或案例，請留下 [VERIFY: 待 Betty 補充個人生活或個案微案例]。
7. **Alternative Perspectives（多元視角與不確定性）**：避免單一歸因，採用可能語氣提醒其他可能情境。
8. **Practical Options（2~3 個溫和且可落地的實踐方向）**。
9. **Reflection Questions（深度自省引導題）**：留給讀者的教練式提問。
10. **Takeaway（一語定心結語）**。
11. **Gentle CTA（溫和行動邀請）**：邀請留言交流感受或探索一對一教練會談。
12. **Sources & Disclaimer（文獻出處與免責聲明）**：列出參考書籍/論文，並附上標準身心免責聲明。

請撰寫完整的長文（約 1,000 ~ 1,500 字），段落呼吸感佳、排版優雅。

【不可違反】
- 若 Betty 的筆記或回答中缺少親身故事，不可替 Betty 編造經歷，必須在該處寫「[VERIFY: 待 Betty 補充個人例子]」。
- Sources 段落只列「已查證文獻」與來源致謝；未查證的文獻若出現必須帶 [VERIFY]。
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
    systemInstruction: "你是一位兼具文筆深度、心理學專業與教練同理心的資深編輯主筆。請嚴格根據提供的事實、架構筆記與故事撰寫，絕不捏造虛假個案隱私。",
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
1. **C - Complete (完整性)**：是否包含情境、隱微模式、重構、學理解釋、真實案例、練習與結語？
2. **L - Clear (清晰度)**：心理學名詞是否深入淺出，受眾能否在沒有專案背景下秒懂？
3. **E - Evidence (實證與邊界)**：是否將「學理事實」、「個人經驗」與「觀點詮釋」嚴格分開？有無未經證實的絕對化斷言？
4. **A - Audience (受眾共感度)**：是否擊中高敏感、想太多、追求釐清受眾的真實痛點，而非陳腔濫調心靈雞湯？
5. **R - Revise (語氣與安全性)**：是否具備 Betty 溫暖、非評判的教練同行者語氣？是否嚴格避免了任何臨床診斷字眼？

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
    systemInstruction: "你是一位專業的心理學出版品審查員與教練倫理督導，秉持客觀、溫和但極度嚴格的品管原則。只輸出合法 JSON。",
    temperature: 0.2,
    jsonMode: true
  });

  review.verify_markers = countVerifyMarkers(masterArticle);
  review.reviewed_at = new Date().toISOString();
  review.stale = false;
  return review;
}

module.exports = {
  generateMasterArticle,
  runClearReview,
  countVerifyMarkers
};
