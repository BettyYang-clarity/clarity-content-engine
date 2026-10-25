import { esc, renderMdArchiveSection, bindMdArchiveEvents } from '../utils.js';

export function renderSettings(container, state, app) {
  const frameworks = state.frameworks || [];
  const trusted = state.trustedSources || [];
  const library = state.learningLibrary || [];
  const perfs = state.performanceLogs || [];
  const allExports = state.allExports || [];
  const editingLibId = state.ui?.editingLibId || null;

  container.innerHTML = `
    <div class="main-panel" style="max-width: 1000px; margin: 0 auto;">
      <h2>⚙️ 設定、理論庫與自學中心</h2>
      <p class="section-desc">API 金鑰、Google Drive 匯出路徑、信任文獻、成效回饋閉環與 AI 寫作法則自學庫。</p>

      <!-- Section 1: API & System Config -->
      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary);">🔑 Gemini API 金鑰</h3>
        <div style="display: flex; gap: 10px; max-width: 600px;">
          <input type="password" id="gemini-key-input" class="form-input" placeholder="${state.settings?.has_gemini_key ? '已設定（輸入可替換）' : '請輸入 AI Studio API Key'}">
          <button id="btn-save-key" class="btn btn-primary" style="white-space: nowrap;">儲存</button>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: ${state.settings?.has_gemini_key ? '#059669' : '#DC2626'};">
          ${state.settings?.has_gemini_key ? `✓ 已設定（${esc(state.settings.masked_key || '環境變數')}）` : '⚠️ 尚未設定'}
        </div>
      </div>

      <!-- Section 2: Google Drive / Local Export Directory -->
      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary); margin-bottom: 4px;">📂 本地 / Google Drive 匯出資料夾</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          設定本地資料夾路徑（例如 Google Drive 電腦版同步資料夾 <code>G:\\我的雲端硬碟\\ClarityPosts</code> 或 Obsidian 筆記庫）。點擊「匯出成果」時除了自動下載，還會直接存入該資料夾。
        </p>
        <div style="display: flex; gap: 10px;">
          <input type="text" id="export-dir-input" class="form-input" placeholder="例如：D:\\MyWriting\\GoogleDrive\\Posts" value="${esc(state.settings?.export_dir || '')}">
          <button id="btn-save-export-dir" class="btn btn-primary" style="white-space: nowrap;">儲存路徑</button>
        </div>
      </div>

      <!-- Section 3: Mobile Google Form Sync -->
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

      <!-- Section 4: Learning Library & Closed-Loop -->
      <div class="info-card" style="margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <h3 style="color: var(--primary); margin-bottom: 4px;">🧠 我的寫作學習庫 (Learning Library)</h3>
            <p style="font-size: 13px; color: var(--text-muted);">
              包含你的手動寫作規則 (rule)、親筆修訂語氣範本 (voice) 與 AI 從成效數據自動萃取的法則 (lesson)。生成母文與社群時會自動注入！
            </p>
          </div>
          <button id="btn-extract-lessons" class="btn btn-studio btn-sm" style="white-space: nowrap;">
            🤖 從成效萃取法則
          </button>
        </div>

        <div style="display: flex; gap: 8px; margin: 12px 0;">
          <select id="lib-cat-select" class="form-select" style="max-width: 140px;">
            <option value="rule">寫作規則 / 禁忌</option>
            <option value="voice">語氣範本片段</option>
            <option value="story">故事庫存案例</option>
          </select>
          <input type="text" id="lib-title-input" class="form-input" style="max-width: 200px;" placeholder="標題/規則摘要">
          <input type="text" id="lib-content-input" class="form-input" placeholder="規則詳細內容（例：避免使用「底層邏輯」，改用「內在運作模式」）">
          <button id="btn-add-lib-rule" class="btn btn-primary" style="white-space: nowrap;">+ 新增規則</button>
        </div>

        <div class="learning-library-grid">
          ${library.length ? library.map(item => {
            const isEd = editingLibId === item.id;
            return `
            <div class="learning-card ${item.is_active ? '' : 'inactive'}">
              <div>
                <div class="learning-card-header">
                  <span class="learning-badge ${esc(item.category)}">${esc(item.category.toUpperCase())}</span>
                  <strong style="font-size: 13px;">${esc(item.title || '無標題')}</strong>
                </div>
                ${isEd ? `
                  <input type="text" class="form-input inp-edit-lib-title" data-id="${item.id}" value="${esc(item.title || '')}" style="margin-top: 6px; font-size: 12.5px;" placeholder="標題">
                  <textarea class="form-textarea inp-edit-lib-content" data-id="${item.id}" style="margin-top: 6px; min-height: 70px; font-size: 12.5px;">${esc(item.content)}</textarea>
                  <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 6px;">
                    <button class="btn btn-outline btn-sm btn-cancel-edit-lib" style="padding: 2px 8px; font-size: 11px;">取消</button>
                    <button class="btn btn-primary btn-sm btn-save-edit-lib" data-id="${item.id}" style="padding: 2px 8px; font-size: 11px;">💾 確定儲存</button>
                  </div>
                ` : `
                  <div style="font-size: 12.5px; color: #374151; margin-top: 6px; line-height: 1.5;">${esc(item.content)}</div>
                `}
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px solid var(--border); padding-top: 6px;">
                <label style="font-size: 12px; cursor: pointer; color: var(--text-muted);">
                  <input type="checkbox" class="chk-lib-active" data-id="${item.id}" ${item.is_active ? 'checked' : ''}>
                  ${item.is_active ? '啟用中' : '已停用'}
                </label>
                <div style="display: flex; gap: 4px;">
                  <button class="btn btn-outline btn-sm btn-edit-lib" data-id="${item.id}" style="padding: 2px 6px; font-size: 11px;">✏️ 修改</button>
                  <button class="btn btn-outline btn-sm btn-del-lib" data-id="${item.id}" style="padding: 2px 6px; font-size: 11px; color: #DC2626;">🗑️ 刪除</button>
                </div>
              </div>
            </div>
          `;
          }).join('') : '<p style="font-size: 12.5px; color: var(--text-muted);">目前尚無學習庫規則，可手動新增或點擊上方萃取法則。</p>'}
        </div>
      </div>

      <!-- Section 4.5: All MD Export Archives Space -->
      <div style="margin-bottom: 24px;">
        ${renderMdArchiveSection(allExports, state.currentDetail?.idea || null, state)}
      </div>

      <!-- Section 5: Performance Logs Input -->
      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary); margin-bottom: 4px;">📈 社群發布成效紀錄 (Performance Feedback)</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          發布到 IG / FB / Threads 後，將成效數據登記於此。系統著重「收藏 (Saves)」與「分享 (Shares)」代表的高度認同。
        </p>

        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr auto; gap: 8px; margin-bottom: 12px; align-items: center;">
          <select id="perf-idea-select" class="form-select">
            <option value="">選擇對應主題...</option>
            ${state.ideas.map(i => `<option value="${i.id}">${esc(i.title)}</option>`).join('')}
          </select>
          <select id="perf-platform-select" class="form-select">
            <option value="instagram">Instagram</option>
            <option value="threads">Threads</option>
            <option value="facebook">Facebook</option>
            <option value="blog">Blog</option>
            <option value="podcast">Podcast</option>
          </select>
          <input type="number" id="perf-reach" class="form-input" placeholder="觸及數" min="0">
          <input type="number" id="perf-saves" class="form-input" placeholder="收藏數" min="0">
          <input type="number" id="perf-shares" class="form-input" placeholder="分享數" min="0">
          <input type="number" id="perf-comments" class="form-input" placeholder="留言數" min="0">
          <button id="btn-add-perf" class="btn btn-primary" style="white-space: nowrap;">+ 登記成效</button>
        </div>

        ${perfs.length ? `
          <table class="perf-table">
            <thead>
              <tr>
                <th>主題</th>
                <th>平台</th>
                <th>觸及</th>
                <th>⭐ 收藏</th>
                <th>🔄 分享</th>
                <th>💬 留言</th>
                <th>日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${perfs.map(p => `
                <tr>
                  <td>${esc(p.title)}</td>
                  <td><span class="cite-badge cite-ok">${esc(p.platform)}</span></td>
                  <td>${p.reach || 0}</td>
                  <td><strong style="color: #D97706;">${p.saves || 0}</strong></td>
                  <td><strong>${p.shares || 0}</strong></td>
                  <td>${p.comments || 0}</td>
                  <td style="color: var(--text-muted); font-size: 11px;">${(p.created_at || '').slice(0, 10)}</td>
                  <td>
                    <button class="btn btn-outline btn-sm btn-edit-perf" data-id="${p.id}" style="padding: 2px 6px; font-size: 11px;">✏️ 修改</button>
                    <button class="btn btn-outline btn-sm btn-del-perf" data-id="${p.id}" style="padding: 2px 6px; font-size: 11px; color: #DC2626;">🗑️ 刪除</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : '<p style="font-size: 12.5px; color: var(--text-muted); margin-top: 8px;">尚未登記任何社群發布成效數據。</p>'}
      </div>

      <!-- Section 6: Trusted Sources -->
      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary); margin-bottom: 4px;">⭐ 信任文獻清單（${trusted.length}）</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          研究時會<strong>優先引用</strong>這裡的文獻，符合清單的引用會直接標示為「信任」，不必再查證。
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
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-outline btn-sm btn-edit-trusted" data-id="${t.id}">✏️ 修改</button>
                <button class="btn btn-outline btn-sm btn-del-trusted" data-id="${t.id}" style="color: #DC2626;">🗑️ 刪除</button>
              </div>
            </div>
          `).join('') : '<p style="font-size: 12.5px; color: var(--text-muted);">清單是空的</p>'}
        </div>
      </div>

      <!-- Section 7: Theoretical Frameworks -->
      <div class="info-card" style="margin-bottom: 24px;">
        <h3 style="color: var(--primary); margin-bottom: 8px;">📚 心理學選配參考庫（${frameworks.length}）</h3>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">僅在主題與心理相關時作為可選參考，不會限制其他領域的主題（研究步驟會跨領域搜尋佐證）。</p>
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

      <!-- Section 8: Quality Rules -->
      <div class="info-card">
        <h3 style="color: var(--primary); margin-bottom: 8px;">🛡️ 系統強制執行的安全與倫理守則</h3>
        <ul style="padding-left: 20px; font-size: 13px; line-height: 1.8;">
          <li>每條文獻引用都會用 Google 搜尋查證；查不到的強制標記 <mark class="verify-mark">[VERIFY]</mark>。</li>
          <li>訪談沒填的個人經驗，AI 絕不編造，留下 [VERIFY] 請你親自補充與微調。</li>
          <li>母文章還有 [VERIFY] 時<strong>無法核准</strong>；沒核准就<strong>無法</strong>生成播客與社群內容。</li>
          <li>修改母文章會自動取消核准，已生成的播客和社群內容會標示「已過期」。</li>
        </ul>
      </div>
    </div>
  `;

  // --- Event Bindings ---
  container.querySelector('#btn-save-key')?.addEventListener('click', () => {
    const key = container.querySelector('#gemini-key-input').value.trim();
    if (!key) return app.showToast('請輸入 API Key');
    app.saveSettings({ gemini_api_key: key });
  });

  container.querySelector('#btn-save-export-dir')?.addEventListener('click', () => {
    const dir = container.querySelector('#export-dir-input').value.trim();
    app.saveSettings({ export_dir: dir });
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

  container.querySelectorAll('.btn-edit-trusted').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = trusted.find(x => String(x.id) === btn.dataset.id);
      if (!item) return;
      const citation = prompt('修改文獻引用：', item.citation);
      if (!citation || !citation.trim()) return;
      const note = prompt('修改備註：', item.note || '') ?? '';
      await app.updateTrustedSource(item.id, citation.trim(), note.trim());
    });
  });

  container.querySelectorAll('.btn-del-trusted').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('確定從信任清單刪除？')) app.deleteTrustedSource(btn.dataset.id);
    });
  });

  container.querySelector('#btn-add-lib-rule')?.addEventListener('click', () => {
    const cat = container.querySelector('#lib-cat-select').value;
    const title = container.querySelector('#lib-title-input').value.trim();
    const content = container.querySelector('#lib-content-input').value.trim();
    if (!content) return app.showToast('請輸入規則內容');
    app.addLibraryRule(cat, title, content);
  });

  container.querySelectorAll('.chk-lib-active').forEach(chk => {
    chk.addEventListener('change', () => {
      app.toggleLibraryItem(chk.dataset.id, chk.checked);
    });
  });

  container.querySelectorAll('.btn-edit-lib').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.editingLibId = state.ui.editingLibId === btn.dataset.id ? null : btn.dataset.id;
      app.render();
    });
  });

  container.querySelectorAll('.btn-cancel-edit-lib').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.editingLibId = null;
      app.render();
    });
  });

  container.querySelectorAll('.btn-save-edit-lib').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const title = container.querySelector(`.inp-edit-lib-title[data-id="${id}"]`)?.value.trim() || '';
      const content = container.querySelector(`.inp-edit-lib-content[data-id="${id}"]`)?.value.trim() || '';
      if (!content) return app.showToast('內容不可為空');
      state.ui.editingLibId = null;
      await app.updateLibraryItem(id, { title, content });
    });
  });

  container.querySelectorAll('.btn-del-lib').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('確定刪除此條規則？')) app.deleteLibraryItem(btn.dataset.id);
    });
  });

  container.querySelector('#btn-extract-lessons')?.addEventListener('click', () => {
    app.extractPerformanceLessons();
  });

  container.querySelector('#btn-add-perf')?.addEventListener('click', () => {
    const ideaId = container.querySelector('#perf-idea-select').value;
    if (!ideaId) return app.showToast('請先選擇對應主題');
    const platform = container.querySelector('#perf-platform-select').value;
    const reach = container.querySelector('#perf-reach').value;
    const saves = container.querySelector('#perf-saves').value;
    const shares = container.querySelector('#perf-shares').value;
    const comments = container.querySelector('#perf-comments').value;

    app.logPerformance(ideaId, { platform, reach, saves, shares, comments });
  });

  container.querySelectorAll('.btn-edit-perf').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = perfs.find(x => String(x.id) === btn.dataset.id);
      if (!item) return;
      const reach = prompt('修改觸及數：', item.reach || 0);
      if (reach === null) return;
      const saves = prompt('修改收藏數：', item.saves || 0);
      if (saves === null) return;
      const shares = prompt('修改分享數：', item.shares || 0);
      if (shares === null) return;
      const comments = prompt('修改留言數：', item.comments || 0);
      if (comments === null) return;
      await app.updatePerformanceLog(item.id, { reach, saves, shares, comments });
    });
  });

  container.querySelectorAll('.btn-del-perf').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('確定刪除此筆成效紀錄？')) {
        await app.deletePerformanceLog(btn.dataset.id);
      }
    });
  });

  bindMdArchiveEvents(container, allExports, state.currentDetail?.idea || null, state, app);
}
