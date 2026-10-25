import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Escape any text before inserting it into innerHTML.
 * All AI output and user input must pass through this.
 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only allow http(s) links in href attributes. */
export function safeUrl(url) {
  return /^https?:\/\//i.test(url || '') ? esc(url) : '#';
}

/** Escape text and highlight [VERIFY] markers. */
export function escWithVerify(text) {
  return esc(text).replace(/\[VERIFY[^\]]*\]/gi, m => `<mark class="verify-mark">${m}</mark>`);
}

/**
 * Render AI-generated Markdown safely.
 * AI output can echo scraped web content, so HTML is always sanitised.
 * [VERIFY] markers are highlighted after sanitising (they contain no HTML).
 */
export function renderMarkdown(text) {
  if (!text) return '';
  const html = DOMPurify.sanitize(marked.parse(String(text), { gfm: true, breaks: true }));
  return html.replace(/\[VERIFY[^\]<]*\]/gi, m => `<mark class="verify-mark">${m}</mark>`);
}

/** JSON fetch helper that surfaces server error messages. */
export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  let data;
  try {
    data = await res.json();
  } catch (_) {
    throw new Error(`伺服器回應格式錯誤（HTTP ${res.status}）`);
  }
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.code = data.code;
    throw err;
  }
  return data;
}

export const CITATION_STATUS = {
  trusted: { label: '信任清單', cls: 'cite-ok', icon: '⭐' },
  verified: { label: '已查證', cls: 'cite-ok', icon: '✅' },
  corrected: { label: '已更正', cls: 'cite-warn', icon: '✏️' },
  not_found: { label: '查無此文獻', cls: 'cite-bad', icon: '⚠️' },
  unverified: { label: '未能查證', cls: 'cite-bad', icon: '⚠️' }
};

/** Trigger browser download of a Markdown string. */
export function downloadMarkdownFile(filename, markdown) {
  const blob = new Blob([markdown || ''], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'export.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reusable MD Export & Archive Space section (新增、修改、刪除、確定、下載 .md).
 */
export function renderMdArchiveSection(exportsList = [], currentIdea = null, state = {}) {
  const editingExpId = state.ui?.editingExportId || null;
  const showNewExp = !!state.ui?.addingCustomExport;

  return `
    <div class="info-card md-archive-box" style="margin-top: 20px; border-left: 4px solid #059669; background: #FAFDFB;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
        <div>
          <strong style="font-size: 14px; color: var(--primary);">📂 MD 匯出存檔紀錄空間（${exportsList.length} 筆）</strong>
          <span style="font-size: 12px; color: var(--text-muted); margin-left: 6px;">所有匯出與手動存檔的 .md 檔案皆永久保存在此，可隨時新增、修改、下載或刪除</span>
        </div>
        ${currentIdea ? `
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-outline btn-sm btn-md-new-custom">➕ 手動新增 .md 存檔</button>
            <button type="button" class="btn btn-export btn-sm btn-md-quick-export">📦 匯出目前進度並存檔 (.md)</button>
          </div>
        ` : ''}
      </div>

      ${showNewExp && currentIdea ? `
        <div style="background: #FFFFFF; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <input type="text" class="form-input inp-new-exp-title" placeholder="存檔標題（例：初稿備份 / 完稿定案）" value="${esc(currentIdea.title)}">
            <input type="text" class="form-input inp-new-exp-note" placeholder="版本備註（例：v1 個人筆記版）">
          </div>
          <textarea class="form-textarea inp-new-exp-md" style="min-height: 140px; font-family: monospace; font-size: 12.5px;" placeholder="輸入或貼上要存檔的 Markdown 內容（若留空則自動整合目前所有進度）..."></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <button type="button" class="btn btn-outline btn-sm btn-md-cancel-new">取消</button>
            <button type="button" class="btn btn-primary btn-sm btn-md-confirm-new">💾 確定存檔並下載 .md</button>
          </div>
        </div>
      ` : ''}

      ${exportsList.length === 0 ? `
        <p style="font-size: 12.5px; color: var(--text-muted); margin: 4px 0;">尚無 .md 匯出存檔紀錄。點擊右上角「📦 匯出目前進度並存檔 (.md)」即可建立第一筆紀錄。</p>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${exportsList.map(exp => {
            const isEditing = editingExpId === exp.id;
            return `
              <div style="background: #FFFFFF; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <div>
                    <strong style="font-size: 13px; color: var(--primary);">📄 ${esc(exp.title || exp.file_name)}</strong>
                    ${exp.note ? `<span class="cite-badge cite-ok" style="margin-left: 6px;">${esc(exp.note)}</span>` : ''}
                    <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                      檔名：<code>${esc(exp.file_name)}</code> · 時間：${esc((exp.created_at || '').slice(0, 16))} · ${(exp.markdown_content || '').length} 字
                      ${exp.saved_path ? ` · 路徑：<code>${esc(exp.saved_path)}</code>` : ''}
                    </div>
                  </div>
                  <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-outline btn-sm btn-md-download" data-id="${esc(exp.id)}">📥 下載 .md</button>
                    <button type="button" class="btn btn-outline btn-sm btn-md-edit" data-id="${esc(exp.id)}">${isEditing ? '收起' : '✏️ 修改'}</button>
                    <button type="button" class="btn btn-outline btn-sm btn-md-delete" data-id="${esc(exp.id)}" style="color: #DC2626;">🗑️ 刪除</button>
                  </div>
                </div>
                ${isEditing ? `
                  <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                      <input type="text" class="form-input inp-edit-exp-title" data-id="${esc(exp.id)}" value="${esc(exp.title || '')}" placeholder="存檔標題">
                      <input type="text" class="form-input inp-edit-exp-note" data-id="${esc(exp.id)}" value="${esc(exp.note || '')}" placeholder="版本備註">
                    </div>
                    <textarea class="form-textarea inp-edit-exp-md" data-id="${esc(exp.id)}" style="min-height: 180px; font-family: monospace; font-size: 12.5px;">${esc(exp.markdown_content || '')}</textarea>
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
                      <button type="button" class="btn btn-outline btn-sm btn-md-cancel-edit">取消</button>
                      <button type="button" class="btn btn-primary btn-sm btn-md-save-edit" data-id="${esc(exp.id)}">💾 確定儲存修改</button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;
}

export function bindMdArchiveEvents(container, exportsList = [], currentIdea = null, state = {}, app) {
  container.querySelector('.btn-md-quick-export')?.addEventListener('click', () => {
    if (!currentIdea) return;
    const note = prompt('請輸入此份 .md 存檔的版本備註（可留空直接按確定）：', '') ?? null;
    if (note === null) return;
    app.exportIdeaPackage(currentIdea.id, { note });
  });

  container.querySelector('.btn-md-new-custom')?.addEventListener('click', () => {
    state.ui.addingCustomExport = !state.ui.addingCustomExport;
    app.render();
  });

  container.querySelector('.btn-md-cancel-new')?.addEventListener('click', () => {
    state.ui.addingCustomExport = false;
    app.render();
  });

  container.querySelector('.btn-md-confirm-new')?.addEventListener('click', async () => {
    if (!currentIdea) return;
    const title = container.querySelector('.inp-new-exp-title')?.value.trim() || currentIdea.title;
    const note = container.querySelector('.inp-new-exp-note')?.value.trim() || '';
    const markdown_content = container.querySelector('.inp-new-exp-md')?.value || '';
    state.ui.addingCustomExport = false;
    await app.exportIdeaPackage(currentIdea.id, { title, note, markdown_content });
  });

  container.querySelectorAll('.btn-md-download').forEach(btn => {
    btn.addEventListener('click', () => {
      const exp = exportsList.find(x => x.id === btn.dataset.id);
      if (exp) {
        downloadMarkdownFile(exp.file_name, exp.markdown_content);
        app.showToast(`✓ 已下載 ${exp.file_name}`);
      }
    });
  });

  container.querySelectorAll('.btn-md-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      state.ui.editingExportId = state.ui.editingExportId === id ? null : id;
      app.render();
    });
  });

  container.querySelectorAll('.btn-md-cancel-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.editingExportId = null;
      app.render();
    });
  });

  container.querySelectorAll('.btn-md-save-edit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const title = container.querySelector(`.inp-edit-exp-title[data-id="${id}"]`)?.value.trim() || '';
      const note = container.querySelector(`.inp-edit-exp-note[data-id="${id}"]`)?.value.trim() || '';
      const markdown_content = container.querySelector(`.inp-edit-exp-md[data-id="${id}"]`)?.value || '';
      await app.updateExportArchive(id, { title, note, markdown_content });
    });
  });

  container.querySelectorAll('.btn-md-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('確定要刪除此筆 .md 存檔紀錄？')) {
        await app.deleteExportArchive(btn.dataset.id);
      }
    });
  });
}
