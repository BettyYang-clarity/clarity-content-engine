import { esc, renderMarkdown } from '../utils.js';

export function renderPodcastStudio(container, state, app) {
  const detail = state.currentDetail;
  const currentIdea = detail?.idea || null;
  const master = detail?.master || null;
  const podcast = detail?.podcast || null;

  if (!currentIdea || !master?.master_article || !master.is_approved) {
    container.innerHTML = `
      <div style="text-align: center; padding: 100px 20px; color: var(--text-muted);">
        <h3>🎙️ 播客內容只會從「已核准」的母文章產生</h3>
        <p style="margin-top: 8px; font-size: 14px;">這是為了確保所有平台的內容都以你確認過的版本為準。</p>
        <button id="btn-back-to-master" class="btn btn-primary" style="margin-top: 14px;">前往母文章 ➔</button>
      </div>
    `;
    container.querySelector('#btn-back-to-master')?.addEventListener('click', () => app.switchTab('interview'));
    return;
  }

  const mode = state.ui.podcastMode || 'talking';

  container.innerHTML = `
    <div class="main-panel" style="max-width: 1100px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px;">
        <div>
          <h2>🎙️ 播客錄音室</h2>
          <div style="font-size: 13.5px; color: var(--text-muted); margin-top: 4px;">${esc(currentIdea.title)} · 重點提綱 / 逐字講稿 / Show Notes / NotebookLM</div>
        </div>
        <button id="btn-generate-podcast" class="btn btn-primary" ${state.isProcessing ? 'disabled' : ''} style="white-space: nowrap;">
          ${state.isProcessing ? '⏳ 編排中...' : (podcast ? '🔄 重新生成' : '✨ 生成播客工具包')}
        </button>
      </div>

      ${podcast?.is_stale ? `<div class="source-banner cite-warn" style="margin-bottom: 14px;">⚠️ 這份播客內容是在母文章修改之前產生的，建議重新生成。</div>` : ''}

      ${!podcast ? `
        <div style="text-align: center; padding: 80px 20px; border: 2px dashed var(--border); border-radius: 10px;">
          <p style="font-size: 15px; font-weight: 600; color: var(--primary);">尚未生成本集播客內容</p>
          <p style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">三款標題 · 開場 Hook · 重點提綱 · 逐字講稿 · Show Notes · NotebookLM 筆記</p>
        </div>
      ` : `
        <div class="podcast-titles-grid">
          <div class="title-card"><div class="title-card-type">🔥 吸睛型</div><div class="title-card-text">${esc(podcast.titles?.catchy_title)}</div></div>
          <div class="title-card"><div class="title-card-type">🌿 反思型</div><div class="title-card-text">${esc(podcast.titles?.reflective_title)}</div></div>
          <div class="title-card"><div class="title-card-type">📚 學理型</div><div class="title-card-text">${esc(podcast.titles?.academic_title)}</div></div>
        </div>

        <div class="info-card" style="margin-bottom: 20px; background: #FAF9F6; border-left: 4px solid var(--accent);">
          <div class="info-card-header" style="color: var(--accent);"><span>⚡ 開場 30 秒 Hook</span></div>
          <p style="font-size: 15px; font-weight: 600; line-height: 1.6;">${esc(podcast.hook)}</p>
        </div>

        <div class="podcast-mode-tabs">
          ${[['talking', '📋 重點提綱'], ['script', '📖 逐字講稿'], ['shownotes', '📑 Show Notes'], ['notebooklm', '✨ NotebookLM']]
            .map(([k, l]) => `<button class="mode-tab-btn ${mode === k ? 'active' : ''}" data-mode="${k}">${l}</button>`).join('')}
        </div>

        ${mode === 'talking' ? `
          <div class="talking-points-list">
            ${(Array.isArray(podcast.talking_points) ? podcast.talking_points : []).map(tp => `
              <div class="talking-point-item">
                <div class="tp-segment"><span>${esc(tp.segment)}</span><span class="tp-time">${esc(tp.time_est)}</span></div>
                <ul style="padding-left: 18px; margin: 8px 0; font-size: 13.5px;">
                  ${(tp.speaking_triggers || []).map(t => `<li>${esc(t)}</li>`).join('')}
                </ul>
                <div style="font-size: 12px; color: var(--text-muted);"><strong>關鍵字：</strong>${esc((tp.key_words || []).join(' · '))}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${mode === 'script' ? `
          <div style="text-align: right; margin-bottom: 8px;"><button id="btn-copy-script" class="btn btn-outline btn-sm">📋 複製講稿</button></div>
          <div class="article-view markdown-body" style="max-height: 600px;">${renderMarkdown(podcast.full_script)}</div>
        ` : ''}

        ${mode === 'shownotes' ? `
          <div class="info-card">
            <div style="text-align: right;"><button id="btn-copy-shownotes" class="btn btn-outline btn-sm">📋 複製 Show Notes</button></div>
            <h4 style="margin-bottom: 8px; color: var(--primary);">📝 單集摘要</h4>
            <p style="font-size: 13.5px; line-height: 1.6;">${esc(podcast.show_notes?.summary)}</p>
            <h4 style="margin: 16px 0 8px; color: var(--primary);">⏱️ 時間軸（錄完後請依實際時間調整）</h4>
            <ul style="padding-left: 18px; font-size: 13px;">${(podcast.show_notes?.timestamps || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
            <h4 style="margin: 16px 0 8px; color: #4F46E5;">📚 參考資料</h4>
            <ul style="padding-left: 18px; font-size: 13px;">${(podcast.show_notes?.psychology_references || []).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
            <h4 style="margin: 16px 0 8px; color: var(--accent);">💭 課後練習題</h4>
            <p style="font-size: 13.5px; font-weight: 600; color: var(--accent);">${esc(podcast.show_notes?.reflection_question_for_listener)}</p>
          </div>
        ` : ''}

        ${mode === 'notebooklm' ? `
          <div class="notebooklm-banner">
            <div>
              <h4 style="color: #3730A3;">✨ 貼到 Google NotebookLM</h4>
              <p style="font-size: 12.5px; color: #4338CA; margin-top: 2px;">
                在 NotebookLM 新增來源 →「複製的文字」→ 貼上 → 產生「語音摘要」。（NotebookLM 沒有公開 API，所以這一步需要手動貼上。）
              </p>
            </div>
            <button id="btn-copy-notebooklm" class="btn btn-primary btn-sm">📋 複製筆記</button>
          </div>
          <div class="article-view markdown-body" style="margin-top: 14px; max-height: 450px; background: #FAF5FF; border-color: #E9D5FF;">
            ${renderMarkdown(podcast.notebooklm_markdown)}
          </div>
        ` : ''}
      `}
    </div>
  `;

  container.querySelectorAll('.mode-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.podcastMode = btn.dataset.mode;
      app.render();
    });
  });

  container.querySelector('#btn-generate-podcast')?.addEventListener('click', () => app.generatePodcast(currentIdea.id));

  const copy = (sel, text, msg) => container.querySelector(sel)?.addEventListener('click', () => {
    navigator.clipboard.writeText(text || '');
    app.showToast(msg);
  });
  copy('#btn-copy-script', podcast?.full_script, '已複製講稿');
  copy('#btn-copy-notebooklm', podcast?.notebooklm_markdown, '已複製 NotebookLM 筆記');
  if (podcast?.show_notes) {
    const sn = podcast.show_notes;
    const text = [
      sn.summary, '',
      '⏱️ 時間軸', ...(sn.timestamps || []), '',
      '📚 參考資料', ...(sn.psychology_references || []), '',
      '💭 課後練習', sn.reflection_question_for_listener || '', '',
      sn.host_links_and_cta || ''
    ].join('\n');
    copy('#btn-copy-shownotes', text, '已複製 Show Notes');
  }
}
