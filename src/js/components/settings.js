import { esc } from '../utils.js';

export function renderSettings(container, state, app) {
  const frameworks = state.frameworks || [];
  const trusted = state.trustedSources || [];

  container.innerHTML = `
    <div class="main-panel" style="max-width: 1000px; margin: 0 auto;">
      <h2>⚙️ 設定與文獻庫</h2>
      <p class="section-desc">API 金鑰、信任文獻清單、內建理論架構與倫理守則。</p>

      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary);">🔑 Gemini API</h3>
        <div style="display: flex; gap: 10px; max-width: 600px;">
          <input type="password" id="gemini-key-input" class="form-input" placeholder="${state.settings?.has_gemini_key ? '已設定（輸入可替換）' : '請輸入 AI Studio API Key'}">
          <button id="btn-save-key" class="btn btn-primary" style="white-space: nowrap;">儲存</button>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: ${state.settings?.has_gemini_key ? '#059669' : '#DC2626'};">
          ${state.settings?.has_gemini_key ? `✓ 已設定（${esc(state.settings.masked_key || '環境變數')}）` : '⚠️ 尚未設定'}
        </div>
      </div>

      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary); margin-bottom: 4px;">📱 手機靈感收集（Google 表單）</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          手機填 Google 表單 → 回應存進試算表 → 這裡每次開啟時自動匯入。電腦關機時也能收集。設定步驟見專案內 <code>mobile_inbox_setup.md</code>。
        </p>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="inbox-csv-input" class="form-input" placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv" value="${esc(state.settings?.inbox_sheet_csv_url || '')}">
          <button id="btn-save-inbox" class="btn btn-primary" style="white-space: nowrap;">儲存</button>
        </div>
      </div>

      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary); margin-bottom: 4px;">⭐ 信任文獻清單（${trusted.length}）</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          研究時會<strong>優先引用</strong>這裡的文獻，符合清單的引用會直接標示為「信任」，不必再查證。
          建議只放你讀過、確認過的書或論文；同一份清單也可以上傳到 NotebookLM 當研究庫。
        </p>
        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <input type="text" id="trusted-citation" class="form-input" placeholder="APA 引用，例如：Aron, E. N. (1996). The Highly Sensitive Person. Broadway Books.">
          <input type="text" id="trusted-note" class="form-input" style="max-width: 220px;" placeholder="備註（可選）">
          <button id="btn-add-trusted" class="btn btn-primary" style="white-space: nowrap;">+ 加入</button>
        </div>
        <div class="trusted-list">
          ${trusted.length ? trusted.map(t => `
            <div class="version-row">
              <div>
                <div style="font-size: 13px;">${esc(t.citation)}</div>
                ${t.note ? `<div class="cite-note">${esc(t.note)}</div>` : ''}
              </div>
              <button class="btn btn-outline btn-sm btn-del-trusted" data-id="${t.id}">刪除</button>
            </div>
          `).join('') : '<p style="font-size: 12.5px; color: var(--text-muted);">清單是空的</p>'}
        </div>
      </div>

      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary); margin-bottom: 8px;">📚 內建理論架構（${frameworks.length}）</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">研究時用來對齊主題的理論地圖（不是引用來源；引用以上方清單與搜尋查證為準）。</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${frameworks.map(f => `
            <div style="background: #F9FAFB; border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
                <strong style="color: var(--primary); font-size: 14px;">${esc(f.name)}</strong>
                <span style="font-size: 12px; color: #4B5563;">${esc((f.theorists || []).join(', '))}</span>
              </div>
              <div style="font-size: 12.5px; color: #374151;">${esc((f.core_concepts || []).join(' · '))}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="info-card">
        <h3 style="color: var(--primary); margin-bottom: 8px;">🛡️ 系統強制執行的規則</h3>
        <ul style="padding-left: 20px; font-size: 13px; line-height: 1.8;">
          <li>每條文獻引用都會用 Google 搜尋查證；查不到的會標記 <mark class="verify-mark">[VERIFY]</mark>。</li>
          <li>訪談沒填的個人經驗，AI 不會編造，而是留下 [VERIFY] 請你補充。</li>
          <li>母文章還有 [VERIFY] 時<strong>無法核准</strong>；沒核准就<strong>無法</strong>生成播客與社群內容（後端也會擋）。</li>
          <li>修改母文章會自動取消核准，已生成的播客和社群內容會標示「已過期」。</li>
        </ul>
      </div>
    </div>
  `;

  container.querySelector('#btn-save-key')?.addEventListener('click', () => {
    const key = container.querySelector('#gemini-key-input').value.trim();
    if (!key) return app.showToast('請輸入 API Key');
    app.saveSettings({ gemini_api_key: key });
  });

  container.querySelector('#btn-save-inbox')?.addEventListener('click', async () => {
    const url = container.querySelector('#inbox-csv-input').value.trim();
    await app.saveSettings({ inbox_sheet_csv_url: url });
    if (url) app.syncInbox(false);
  });

  container.querySelector('#btn-add-trusted')?.addEventListener('click', () => {
    const citation = container.querySelector('#trusted-citation').value.trim();
    const note = container.querySelector('#trusted-note').value.trim();
    if (!citation) return app.showToast('請輸入文獻引用');
    app.addTrustedSource(citation, note);
  });

  container.querySelectorAll('.btn-del-trusted').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('確定從信任清單刪除？')) app.deleteTrustedSource(btn.dataset.id);
    });
  });
}
