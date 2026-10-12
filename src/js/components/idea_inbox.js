import { esc, safeUrl, CITATION_STATUS } from '../utils.js';

const STATUS_LABELS = {
  INBOX: '靈感待研究',
  RESEARCHED: '已完成研究',
  INTERVIEWED: '已完成訪談',
  MASTER_DRAFTED: '母文審查中',
  NEEDS_ATTENTION: '需要處理',
  APPROVED: '已核准',
  MULTIPLIED: '全平台已倍增'
};

const PILLARS = {
  clarity: 'Clarity 認知釐清',
  confidence: 'Confidence 自信效能',
  hsp: 'HSP 高敏感特質',
  boundaries: 'Boundaries 心理邊界',
  growth: 'Positive Psychology 正向心理'
};

const SOURCE_STATUS = {
  youtube: { icon: '🎬', cls: 'cite-ok' },
  web: { icon: '🌐', cls: 'cite-ok' },
  none: { icon: '📝', cls: 'cite-warn' },
  error: { icon: '⚠️', cls: 'cite-bad' }
};

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function renderCitations(grounding) {
  // Support research packs created before verification existed (plain strings)
  const citations = grounding.citations
    || (grounding.academic_citations || []).map(c => ({ citation: c, status: 'unverified', note: '舊版研究包，未經查證' }));

  if (!citations.length) {
    return '<p style="font-size: 12.5px; color: var(--text-muted);">沒有列出文獻引用。</p>';
  }

  return `
    <ul class="citation-list">
      ${citations.map(c => {
        const s = CITATION_STATUS[c.status] || CITATION_STATUS.unverified;
        return `
          <li class="citation-item">
            <span class="cite-badge ${s.cls}">${s.icon} ${s.label}</span>
            <div>
              <div class="cite-text">${esc(c.citation)}</div>
              ${c.original_citation ? `<div class="cite-note">原始寫法：<s>${esc(c.original_citation)}</s></div>` : ''}
              ${c.relevance ? `<div class="cite-note">支持論點：${esc(c.relevance)}</div>` : ''}
              ${c.note ? `<div class="cite-note">查證說明：${esc(c.note)}</div>` : ''}
            </div>
          </li>
        `;
      }).join('')}
    </ul>
    ${(grounding.search_sources || []).length ? `
      <details style="margin-top: 8px;">
        <summary style="font-size: 12px; color: var(--text-muted); cursor: pointer;">🔎 查證時參考的搜尋結果（${grounding.search_sources.length}）</summary>
        <ul style="padding-left: 18px; font-size: 12px; margin-top: 4px;">
          ${grounding.search_sources.map(s => `<li><a href="${safeUrl(s.uri)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}
        </ul>
      </details>
    ` : ''}
  `;
}

function renderList(items, color) {
  if (!items || !items.length) return '<p style="font-size: 12.5px; color: var(--text-light);">（無）</p>';
  return `<ul style="padding-left: 18px; font-size: 13px; color: ${color || '#374151'};">
    ${items.map(i => `<li style="margin-bottom: 4px;">${esc(i)}</li>`).join('')}
  </ul>`;
}

export function renderIdeaInbox(container, state, app) {
  const detail = state.currentDetail;
  const currentIdea = detail?.idea || null;
  const pack = currentIdea?.research_pack || null;
  const grounding = pack?.psychology_grounding || {};
  const sourceMeta = pack?.source_fetch;

  container.innerHTML = `
    <div class="split-view">
      <div class="side-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3>💡 靈感收集箱</h3>
          <div style="display: flex; gap: 6px;">
            <button id="btn-sync-inbox" class="btn btn-outline btn-sm" title="從手機 Google 表單匯入">📱 同步</button>
            <button id="btn-show-add" class="btn btn-primary btn-sm">+ 新增靈感</button>
          </div>
        </div>
        <p class="section-desc">貼上 YouTube／文章連結或隨手筆記。系統會實際讀取來源內容。</p>

        <div id="add-idea-form" class="info-card" style="margin-bottom: 14px; display: none;">
          <div class="form-group">
            <input type="text" id="new-idea-title" class="form-input" placeholder="主題或工作標題（例：討好型人格的邊界陷阱）">
          </div>
          <div class="form-group">
            <select id="new-idea-pillar" class="form-select">
              ${Object.entries(PILLARS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <select id="new-idea-type" class="form-select">
              <option value="Observation">觀察 / 隨想</option>
              <option value="YouTube">YouTube 影片</option>
              <option value="Article">網路文章</option>
              <option value="Book">書籍</option>
              <option value="Research">研究論文</option>
              <option value="Experience">個人經驗</option>
            </select>
          </div>
          <div class="form-group">
            <input type="text" id="new-idea-url" class="form-input" placeholder="來源網址（YouTube 或文章，可選）">
          </div>
          <div class="form-group">
            <input type="text" id="new-idea-author" class="form-input" placeholder="作者 / 創作者（可選，用於致謝）">
          </div>
          <div class="form-group">
            <textarea id="new-idea-notes" class="form-textarea" placeholder="為什麼想聊這個？一句戳中你的話、書中摘錄..."></textarea>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-save-idea" class="btn btn-primary btn-sm btn-block">儲存靈感</button>
            <button id="btn-cancel-add" class="btn btn-outline btn-sm">取消</button>
          </div>
        </div>

        <div class="idea-list">
          ${state.ideas.length === 0 ? `
            <div style="text-align: center; padding: 30px 10px; color: var(--text-muted); font-size: 13px;">
              尚未建立任何靈感。<br>點擊上方「+ 新增靈感」開始！
            </div>
          ` : state.ideas.map(item => `
            <div class="idea-card ${item.id === state.selectedIdeaId ? 'active' : ''}" data-id="${esc(item.id)}">
              <div class="idea-card-header">
                <span class="idea-card-title">${esc(item.title)}</span>
                <span class="badge badge-${esc((item.status || '').toLowerCase())}">${esc(getStatusLabel(item.status))}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-muted);">
                <span>${esc(PILLARS[item.content_pillar] || item.content_pillar)}</span>
                <span>${esc(item.created_at ? item.created_at.slice(5, 10) : '')}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="main-panel">
        ${!currentIdea ? `
          <div style="text-align: center; padding: 80px 20px; color: var(--text-muted);">
            <h3>👈 請從左側選擇或新增一個靈感主題</h3>
          </div>
        ` : `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px;">
            <div>
              <span class="badge badge-${esc(currentIdea.status.toLowerCase())}" style="margin-bottom: 6px;">${esc(getStatusLabel(currentIdea.status))}</span>
              <h2>${esc(currentIdea.title)}</h2>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                支柱：<strong>${esc(PILLARS[currentIdea.content_pillar] || currentIdea.content_pillar)}</strong>
                ${currentIdea.source_url ? ` · <a href="${safeUrl(currentIdea.source_url)}" target="_blank" rel="noopener" style="color: var(--primary);">來源連結 ↗</a>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="btn-one-click-studio" class="btn btn-studio" ${state.isProcessing ? 'disabled' : ''} style="white-space: nowrap;" title="一鍵自動完成研究、起草母文與 CLEAR 審查，之後隨時可精雕">
                ⚡ 一鍵生成初稿
              </button>
              <button id="btn-run-research" class="btn btn-primary" ${state.isProcessing ? 'disabled' : ''} style="white-space: nowrap;">
                ${state.isProcessing ? '⏳ 處理中...' : (pack ? '🔄 重新研究' : '🔍 開始研究')}
              </button>
            </div>
          </div>

          ${pack ? `
            <div class="research-container">
              ${sourceMeta ? `
                <div class="source-banner ${SOURCE_STATUS[sourceMeta.status]?.cls || ''}">
                  ${SOURCE_STATUS[sourceMeta.status]?.icon || 'ℹ️'} ${esc(sourceMeta.message)}
                </div>
              ` : ''}

              <div class="info-card">
                <div class="info-card-header"><span>💡 核心洞見</span></div>
                <p style="font-size: 15px; font-weight: 600; color: var(--primary);">${esc(pack.central_insight)}</p>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: 8px;"><strong>來源摘要：</strong>${esc(pack.source_summary)}</p>
              </div>

              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                <div class="info-card">
                  <div class="info-card-header"><span>📄 來源說了什麼</span></div>
                  ${renderList(pack.source_says)}
                </div>
                <div class="info-card">
                  <div class="info-card-header" style="color: #4F46E5;"><span>🔬 研究與理論觀點</span></div>
                  ${renderList(pack.research_suggests)}
                </div>
                <div class="info-card">
                  <div class="info-card-header" style="color: var(--accent);"><span>🌱 留給你詮釋的空間</span></div>
                  ${renderList(pack.interpretation_space)}
                </div>
              </div>

              <div class="info-card" style="border-left: 4px solid #4F46E5;">
                <div class="info-card-header" style="color: #4F46E5;"><span>📚 學理依據與文獻查證</span></div>
                <span class="academic-badge">${esc(grounding.primary_framework || '心理學理論')}</span>
                <div style="font-size: 13px; margin-bottom: 8px;"><strong>代表學者：</strong>${esc((grounding.theorists || []).join(', '))}</div>
                <div style="font-size: 13.5px; line-height: 1.6; margin-bottom: 12px;">${esc(grounding.theoretical_explanation)}</div>
                ${renderCitations(grounding)}
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                <div class="info-card">
                  <div class="info-card-header"><span>🔑 關鍵名詞</span></div>
                  <ul style="padding-left: 18px; font-size: 13px;">
                    ${(pack.key_concepts || []).map(c => `<li style="margin-bottom: 6px;"><strong>${esc(c.term)}</strong>：${esc(c.definition)}</li>`).join('')}
                  </ul>
                </div>
                <div class="info-card">
                  <div class="info-card-header" style="color: var(--accent);"><span>⚠️ 需查證 / 避免武斷</span></div>
                  ${renderList(pack.claims_to_verify, '#78350F')}
                </div>
              </div>

              <div class="next-step-banner">
                <div>
                  <h4 style="font-size: 14px; color: var(--primary);">✓ 研究包已就緒</h4>
                  <p style="font-size: 12.5px; color: #4B5563;">標示「⚠️」的文獻在母文章中會被標記 [VERIFY]，核准前必須處理。</p>
                </div>
                <button id="btn-go-to-interview" class="btn btn-accent btn-sm">進行洞見訪談 ➔</button>
              </div>
            </div>
          ` : `
            <div style="text-align: center; padding: 60px 20px; border: 2px dashed var(--border); border-radius: 10px;">
              <p style="font-size: 14px; color: var(--text-muted);">尚未研究。</p>
              <p style="font-size: 12.5px; color: var(--text-light); margin-top: 4px;">
                會依序：讀取來源內容 → 對齊心理學理論 → 用 Google 搜尋逐條查證文獻（約 30–90 秒）
              </p>
            </div>
          `}
        `}
      </div>
    </div>
  `;

  const addForm = container.querySelector('#add-idea-form');
  container.querySelector('#btn-sync-inbox')?.addEventListener('click', () => app.syncInbox(false));
  container.querySelector('#btn-show-add')?.addEventListener('click', () => {
    addForm.style.display = addForm.style.display === 'none' ? 'block' : 'none';
  });
  container.querySelector('#btn-cancel-add')?.addEventListener('click', () => {
    addForm.style.display = 'none';
  });
  container.querySelector('#btn-save-idea')?.addEventListener('click', async () => {
    const title = container.querySelector('#new-idea-title').value.trim();
    if (!title) return app.showToast('請輸入主題或工作標題');
    await app.createIdea({
      title,
      content_pillar: container.querySelector('#new-idea-pillar').value,
      source_type: container.querySelector('#new-idea-type').value,
      source_url: container.querySelector('#new-idea-url').value.trim(),
      author: container.querySelector('#new-idea-author').value.trim(),
      raw_notes: container.querySelector('#new-idea-notes').value.trim()
    });
  });

  container.querySelectorAll('.idea-card').forEach(card => {
    card.addEventListener('click', () => app.selectIdea(card.dataset.id));
  });

  container.querySelector('#btn-one-click-studio')?.addEventListener('click', () => app.runOneClickStudio(currentIdea.id));
  container.querySelector('#btn-run-research')?.addEventListener('click', () => app.runResearch(currentIdea.id));
  container.querySelector('#btn-go-to-interview')?.addEventListener('click', () => app.switchTab('interview'));
}
