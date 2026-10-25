import { esc, safeUrl, CITATION_STATUS, renderMdArchiveSection, bindMdArchiveEvents } from '../utils.js';

const STATUS_LABELS = {
  INBOX: '靈感待研究',
  RESEARCHED: '已完成研究',
  INTERVIEWED: '已完成訪談',
  MASTER_DRAFTED: '母文審查中',
  NEEDS_ATTENTION: '需要處理',
  APPROVED: '已核准',
  MULTIPLIED: '全平台已倍增'
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
            <input type="text" id="new-idea-title" class="form-input" placeholder="主題或工作標題（例：為什麼開會越多決策越慢）">
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
                <span>${esc(item.source_type || '觀察')}</span>
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
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 12px; flex-wrap: wrap;">
            <div>
              <span class="badge badge-${esc(currentIdea.status.toLowerCase())}" style="margin-bottom: 6px;">${esc(getStatusLabel(currentIdea.status))}</span>
              <h2>${esc(currentIdea.title)}</h2>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                來源類型：<strong>${esc(currentIdea.source_type || '觀察')}</strong>
                ${currentIdea.author ? ` · 作者：${esc(currentIdea.author)}` : ''}
                ${currentIdea.source_url ? ` · <a href="${safeUrl(currentIdea.source_url)}" target="_blank" rel="noopener" style="color: var(--primary);">來源連結 ↗</a>` : ''}
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <button id="btn-edit-idea" class="btn btn-outline btn-sm">✏️ 修改靈感</button>
              <button id="btn-delete-idea" class="btn btn-outline btn-sm" style="color: #DC2626;">🗑️ 刪除</button>
              <button id="btn-one-click-studio" class="btn btn-studio btn-sm" ${state.isProcessing ? 'disabled' : ''} style="white-space: nowrap;" title="一鍵自動完成研究、起草母文與 CLEAR 審查">
                ⚡ 一鍵生成初稿
              </button>
              <button id="btn-run-research" class="btn btn-primary btn-sm" ${state.isProcessing ? 'disabled' : ''} style="white-space: nowrap;">
                ${state.isProcessing ? '⏳ 處理中...' : (pack ? '🔄 重新研究' : '🔍 開始研究')}
              </button>
            </div>
          </div>

          ${state.ui.editingIdea ? `
            <div class="info-card" style="margin-bottom: 16px; border: 2px solid var(--primary);">
              <div class="info-card-header"><span>✏️ 修改靈感資料</span></div>
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 8px;">
                <input type="text" id="edit-idea-title" class="form-input" value="${esc(currentIdea.title)}" placeholder="主題標題">
                <select id="edit-idea-type" class="form-select">
                  ${[['Observation', '觀察 / 隨想'], ['YouTube', 'YouTube 影片'], ['Article', '網路文章'], ['Book', '書籍'], ['Research', '研究論文'], ['Experience', '個人經驗']]
                    .map(([v, l]) => `<option value="${v}" ${currentIdea.source_type === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </div>
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 8px;">
                <input type="text" id="edit-idea-url" class="form-input" value="${esc(currentIdea.source_url || '')}" placeholder="來源網址（可選）">
                <input type="text" id="edit-idea-author" class="form-input" value="${esc(currentIdea.author || '')}" placeholder="作者 / 創作者（可選）">
              </div>
              <textarea id="edit-idea-notes" class="form-textarea" placeholder="原始靈感筆記...">${esc(currentIdea.raw_notes || '')}</textarea>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                <button id="btn-cancel-edit-idea" class="btn btn-outline btn-sm">取消</button>
                <button id="btn-confirm-edit-idea" class="btn btn-primary btn-sm">💾 確定儲存</button>
              </div>
            </div>
          ` : (currentIdea.raw_notes ? `
            <div class="info-card" style="margin-bottom: 14px; background: #FAF9F6;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12.5px; font-weight: 700; color: var(--primary);">📝 原始靈感筆記</span>
              </div>
              <p style="font-size: 13.5px; color: #374151; margin-top: 4px; white-space: pre-wrap;">${esc(currentIdea.raw_notes)}</p>
            </div>
          ` : '')}

          ${state.ui.editingResearch ? `
            <div class="info-card" style="margin-bottom: 16px; border: 2px solid #4F46E5;">
              <div class="info-card-header" style="color: #4F46E5;"><span>✏️ 新增 / 修改研究重點與核心洞見</span></div>
              <div class="form-group">
                <label class="form-label">💡 核心洞見</label>
                <input type="text" id="edit-res-insight" class="form-input" value="${esc(pack?.central_insight || currentIdea.title)}">
              </div>
              <div class="form-group">
                <label class="form-label">📄 來源摘要</label>
                <textarea id="edit-res-summary" class="form-textarea">${esc(pack?.source_summary || '')}</textarea>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;" class="form-group">
                <div>
                  <label class="form-label">📚 主要視角 / 理論概念</label>
                  <input type="text" id="edit-res-framework" class="form-input" value="${esc(grounding.primary_framework || '')}">
                </div>
                <div>
                  <label class="form-label">👤 相關作者 / 研究者（逗號分隔）</label>
                  <input type="text" id="edit-res-theorists" class="form-input" value="${esc((grounding.theorists || []).join(', '))}">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">🔬 佐證說明要點</label>
                <textarea id="edit-res-explanation" class="form-textarea">${esc(grounding.theoretical_explanation || '')}</textarea>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                <button id="btn-cancel-edit-res" class="btn btn-outline btn-sm">取消</button>
                <button id="btn-confirm-edit-res" class="btn btn-primary btn-sm">💾 確定儲存研究包</button>
              </div>
            </div>
          ` : ''}

          ${pack ? `
            <div class="research-container">
              ${sourceMeta ? `
                <div class="source-banner ${SOURCE_STATUS[sourceMeta.status]?.cls || ''}">
                  ${SOURCE_STATUS[sourceMeta.status]?.icon || 'ℹ️'} ${esc(sourceMeta.message)}
                </div>
              ` : ''}

              <div class="info-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <div class="info-card-header" style="margin-bottom: 0;"><span>💡 核心洞見</span></div>
                  <div style="display: flex; gap: 6px;">
                    <button id="btn-edit-research" class="btn btn-outline btn-sm">✏️ 修改研究重點</button>
                    <button id="btn-delete-research" class="btn btn-outline btn-sm" style="color: #DC2626;">🗑️ 刪除研究包</button>
                  </div>
                </div>
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
                <div class="info-card-header" style="color: #4F46E5;"><span>📚 佐證與依據（跨領域文獻查證）</span></div>
                <span class="academic-badge">${esc(grounding.primary_framework || '個人觀察與佐證')}</span>
                ${(grounding.fields || []).length ? `<div style="font-size: 12.5px; color: var(--text-muted); margin-bottom: 4px;">相關領域：${esc(grounding.fields.join('、'))}</div>` : ''}
                ${(grounding.theorists || []).length ? `<div style="font-size: 13px; margin-bottom: 8px;"><strong>相關作者 / 來源：</strong>${esc((grounding.theorists || []).join(', '))}</div>` : ''}
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
                <button id="btn-go-to-interview" class="btn btn-accent btn-sm">進行洞見與母文 ➔</button>
              </div>
            </div>
          ` : `
            <div style="text-align: center; padding: 50px 20px; border: 2px dashed var(--border); border-radius: 10px;">
              <p style="font-size: 14px; color: var(--text-muted);">尚未研究。</p>
              <p style="font-size: 12.5px; color: var(--text-light); margin: 4px 0 14px;">
                可點擊右上角「🔍 開始研究」由 AI 查證，或手動新增研究重點，也可直接跳至「洞見與母文」自由書寫。
              </p>
              <div style="display: flex; justify-content: center; gap: 8px;">
                <button id="btn-manual-research" class="btn btn-outline btn-sm">➕ 手動新增研究重點</button>
                <button id="btn-go-to-interview" class="btn btn-accent btn-sm">直接前往洞見與母文 ➔</button>
              </div>
            </div>
          `}

          ${renderMdArchiveSection(detail?.exports || [], currentIdea, state)}
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
      source_type: container.querySelector('#new-idea-type').value,
      source_url: container.querySelector('#new-idea-url').value.trim(),
      author: container.querySelector('#new-idea-author').value.trim(),
      raw_notes: container.querySelector('#new-idea-notes').value.trim()
    });
  });

  container.querySelectorAll('.idea-card').forEach(card => {
    card.addEventListener('click', () => app.selectIdea(card.dataset.id));
  });

  // Idea Edit / Delete
  container.querySelector('#btn-edit-idea')?.addEventListener('click', () => {
    state.ui.editingIdea = !state.ui.editingIdea;
    app.render();
  });
  container.querySelector('#btn-cancel-edit-idea')?.addEventListener('click', () => {
    state.ui.editingIdea = false;
    app.render();
  });
  container.querySelector('#btn-confirm-edit-idea')?.addEventListener('click', async () => {
    const title = container.querySelector('#edit-idea-title').value.trim();
    if (!title) return app.showToast('標題不可為空');
    await app.updateIdea(currentIdea.id, {
      title,
      source_type: container.querySelector('#edit-idea-type').value,
      source_url: container.querySelector('#edit-idea-url').value.trim(),
      author: container.querySelector('#edit-idea-author').value.trim(),
      raw_notes: container.querySelector('#edit-idea-notes').value
    });
  });
  container.querySelector('#btn-delete-idea')?.addEventListener('click', async () => {
    if (confirm(`確定要刪除靈感「${currentIdea.title}」及其相關文章嗎？`)) {
      await app.deleteIdea(currentIdea.id);
    }
  });

  // Research Pack Edit / Delete
  container.querySelector('#btn-edit-research')?.addEventListener('click', () => {
    state.ui.editingResearch = !state.ui.editingResearch;
    app.render();
  });
  container.querySelector('#btn-manual-research')?.addEventListener('click', () => {
    state.ui.editingResearch = true;
    app.render();
  });
  container.querySelector('#btn-cancel-edit-res')?.addEventListener('click', () => {
    state.ui.editingResearch = false;
    app.render();
  });
  container.querySelector('#btn-confirm-edit-res')?.addEventListener('click', async () => {
    const central_insight = container.querySelector('#edit-res-insight').value.trim();
    const source_summary = container.querySelector('#edit-res-summary').value.trim();
    const primary_framework = container.querySelector('#edit-res-framework').value.trim();
    const theorists = container.querySelector('#edit-res-theorists').value.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    const theoretical_explanation = container.querySelector('#edit-res-explanation').value.trim();
    await app.updateResearchPack(currentIdea.id, {
      ...(pack || {}),
      central_insight,
      source_summary,
      psychology_grounding: {
        ...(grounding || {}),
        primary_framework,
        theorists,
        theoretical_explanation
      }
    });
  });
  container.querySelector('#btn-delete-research')?.addEventListener('click', async () => {
    if (confirm('確定要刪除此研究包嗎？')) {
      await app.deleteResearchPack(currentIdea.id);
    }
  });

  container.querySelector('#btn-one-click-studio')?.addEventListener('click', () => app.runOneClickStudio(currentIdea.id));
  container.querySelector('#btn-run-research')?.addEventListener('click', () => app.runResearch(currentIdea.id));
  container.querySelector('#btn-go-to-interview')?.addEventListener('click', () => app.switchTab('interview'));

  bindMdArchiveEvents(container, detail?.exports || [], currentIdea, state, app);
}
