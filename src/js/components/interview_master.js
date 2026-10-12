import { esc, renderMarkdown } from '../utils.js';

const HINTS = [
  { icon: '🌱', title: '為什麼這對你重要？', desc: '觸動你探索這個主題的核心起心動念或真實痛點。' },
  { icon: '☕', title: '親身經歷或微觀察', desc: '真實生活片刻、個案同行觀察、或是曾讓你胃一緊的瞬間。' },
  { icon: '💡', title: '想打破的簡化迷思', desc: '不想流於陳腔濫調（例如：只叫人「勇敢說不」，背後卻忽略被討厭的恐懼）。' },
  { icon: '🔍', title: '對話中最先看見什麼？', desc: '陪對方先留意的身體訊號、情緒界線或隱微保護機制。' },
  { icon: '✨', title: '今日可試的小實驗', desc: '微小、無痛、受眾今天就能試做的一個行為小步驟。' }
];

export function renderInterviewMaster(container, state, app) {
  const detail = state.currentDetail;
  const currentIdea = detail?.idea || null;
  const master = detail?.master || null;
  const answers = master?.interview_answers || {};
  const review = master?.clear_review || null;
  const editing = state.ui.editingMaster;

  // Attached images in session/state
  if (!state.ui.interviewImages) {
    state.ui.interviewImages = answers.images || [];
  }

  // Pre-fill free notes from answers.free_notes, or assemble legacy q1-q5 if existing
  let initialNotes = answers.free_notes || '';
  if (!initialNotes && (answers.q1_importance || answers.q2_experience)) {
    initialNotes = [
      answers.q1_importance ? `【重要性】\n${answers.q1_importance}` : '',
      answers.q2_experience ? `【個人經驗/案例】\n${answers.q2_experience}` : '',
      answers.q3_oversimplification ? `【想打破的迷思】\n${answers.q3_oversimplification}` : '',
      answers.q4_client_notice ? `【陪伴看見】\n${answers.q4_client_notice}` : '',
      answers.q5_small_experiment ? `【今日微實驗】\n${answers.q5_small_experiment}` : ''
    ].filter(Boolean).join('\n\n');
  }

  if (!currentIdea) {
    container.innerHTML = `<div style="text-align: center; padding: 100px 20px; color: var(--text-muted);"><h3>請先在「靈感與學理研究」選擇或建立主題</h3></div>`;
    return;
  }

  const markers = master?.verify_markers || 0;
  const hasArticle = !!master?.master_article;

  container.innerHTML = `
    <div class="split-view interview-split-view">
      <div class="side-panel interview-panel">
        <div class="interview-panel-header">
          <div>
            <h3>🎙️ 個人洞見與筆記空間</h3>
            <p class="section-desc" style="margin-bottom: 8px;">
              隨性書寫、貼上 Gemini Notebook 架構，或上傳筆記與草圖。右側有教練思考提點，放手自由發揮。
            </p>
          </div>
        </div>

        ${!currentIdea.research_pack ? `<div class="source-banner cite-bad" style="margin-bottom: 12px;">⚠️ 尚未完成學理研究，請先回上一步完成 Research Pack</div>` : ''}

        <!-- Upload & Note Quick Actions -->
        <div class="note-upload-bar">
          <label class="btn btn-outline btn-xs" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            📄 匯入筆記 (.md / .txt)
            <input type="file" id="input-note-file" accept=".md,.txt,.markdown" style="display: none;">
          </label>
          <label class="btn btn-outline btn-xs" style="cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
            🖼️ 上傳架構圖 / 筆記截圖
            <input type="file" id="input-image-file" accept="image/png,image/jpeg,image/webp" multiple style="display: none;">
          </label>
          <span style="font-size: 11.5px; color: var(--text-muted); margin-left: auto;">支援 NotebookLM 匯出</span>
        </div>

        <!-- Image Previews -->
        <div id="interview-image-previews" class="image-previews-container" style="${state.ui.interviewImages.length ? 'display: flex;' : 'display: none;'}">
          ${(state.ui.interviewImages || []).map((img, idx) => `
            <div class="image-preview-chip">
              <img src="${img.data}" alt="${esc(img.name || '筆記截圖')}" />
              <span class="preview-name">${esc(img.name || `圖片 ${idx + 1}`)}</span>
              <button type="button" class="btn-remove-image" data-index="${idx}" title="移除圖片">×</button>
            </div>
          `).join('')}
        </div>

        <form id="interview-form">
          <div class="form-group" style="margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-label" style="margin-bottom: 0;">✍️ Betty 的個人洞見、架構或筆記全文</label>
              <button type="button" id="btn-toggle-hints" class="btn-text-link" style="font-size: 12px; color: var(--primary);">
                💡 思考提點 (${HINTS.length})
              </button>
            </div>
            <textarea id="free-notes-editor" class="form-textarea notes-workspace" placeholder="在這裡自由書寫你的感受、生活片段、對話心得，或直接貼上 Gemini Notebook / NotebookLM 整理好的架構與大綱...&#10;&#10;不必拘泥固定題目格式，AI 會尊重你的語氣與思維，自動與心理學研究包融合為 12 步溫暖母文章。">${esc(initialNotes)}</textarea>
          </div>

          <!-- Collapsible / Floating Coaching Prompts -->
          <div id="coaching-hints-card" class="coaching-hints-card">
            <div class="hints-card-header">
              <span>💡 教練思考提點（寫作時可參考的靈感角度）</span>
            </div>
            <div class="hints-grid">
              ${HINTS.map(h => `
                <div class="hint-item">
                  <span class="hint-icon">${h.icon}</span>
                  <div class="hint-body">
                    <strong>${h.title}</strong>
                    <p>${h.desc}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="margin-top: 14px;">
            <button type="submit" class="btn btn-primary btn-block" ${state.isProcessing || !currentIdea.research_pack ? 'disabled' : ''}>
              ${state.isProcessing ? '⏳ 正在依據筆記撰寫母文章與 CLEAR 審查...' : (hasArticle ? '🔄 依新筆記重新生成母文章' : '✨ 依筆記生成母文章（含 CLEAR 審查）')}
            </button>
            ${hasArticle ? `<p style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px; text-align: center;">重新生成會覆蓋目前文章，舊版仍完整保留在版本紀錄中。</p>` : ''}
          </div>
        </form>
      </div>

      <div class="main-panel">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 12px;">
          <div>
            <h2>母文章 & 核准</h2>
            <div style="font-size: 13px; color: var(--text-muted);">
              ${esc(currentIdea.title)}
              ${hasArticle ? ` · 版本 ${master.version_count || 1}` : ''}
              ${master?.is_approved ? ' · <strong style="color: #059669;">✓ 已核准</strong>' : ''}
            </div>
          </div>
          ${hasArticle && !editing ? `
            <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
              <button id="btn-edit-master" class="btn btn-outline btn-sm">✏️ 編輯</button>
              <button id="btn-toggle-approve" class="btn ${master.is_approved ? 'btn-secondary' : 'btn-accent'} btn-sm" ${!master.is_approved && markers > 0 ? 'disabled title="請先處理 [VERIFY]"' : ''}>
                ${master.is_approved ? '取消核准' : '🎯 核准 (APPROVED)'}
              </button>
            </div>
          ` : ''}
        </div>

        ${!hasArticle ? `
          <div style="text-align: center; padding: 80px 20px; border: 2px dashed var(--border); border-radius: 10px;">
            <p style="font-size: 14px; color: var(--text-muted);">尚未生成母文章。</p>
          </div>
        ` : `
          ${markers > 0 ? `
            <div class="source-banner cite-bad" style="margin-bottom: 14px;">
              ⚠️ 文章中有 <strong>${markers}</strong> 處 <mark class="verify-mark">[VERIFY]</mark>（未查證的文獻或需要你補充的個人例子）。
              請點「編輯」補上或刪除，處理完才能核准。
            </div>
          ` : ''}

          ${review ? renderReview(review) : ''}

          ${editing ? `
            <textarea id="master-editor" class="form-textarea master-editor">${esc(master.master_article)}</textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <span id="editor-verify-count" style="font-size: 12px; color: var(--text-muted);"></span>
              <div style="display: flex; gap: 8px;">
                <button id="btn-cancel-edit" class="btn btn-outline btn-sm">取消</button>
                <button id="btn-save-edit" class="btn btn-primary btn-sm" ${state.isProcessing ? 'disabled' : ''}>💾 儲存修改</button>
              </div>
            </div>
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">儲存後會取消核准，舊的 CLEAR 審查會標示為「已過期」，建議重新審查。</p>
          ` : `
            <div class="article-view markdown-body">${renderMarkdown(master.master_article)}</div>
          `}

          ${!editing ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; gap: 8px;">
                <button id="btn-copy-master" class="btn btn-outline btn-sm">📋 複製全文</button>
                <button id="btn-show-versions" class="btn btn-outline btn-sm">🕘 版本紀錄</button>
                <button id="btn-export-pkg" class="btn btn-export btn-sm" title="一鍵打包下載整合 Markdown，並可自動同步至指定資料夾">📦 匯出成果</button>
              </div>
              <div style="display: flex; gap: 10px;">
                <button id="btn-goto-podcast" class="btn btn-secondary btn-sm" ${!master.is_approved ? 'disabled title="需先核准母文章"' : ''}>🎙️ 播客錄音室 ➔</button>
                <button id="btn-goto-social" class="btn btn-accent btn-sm" ${!master.is_approved ? 'disabled title="需先核准母文章"' : ''}>📱 社群矩陣 ➔</button>
              </div>
            </div>
            <div id="versions-panel"></div>
          ` : ''}
        `}
      </div>
    </div>
  `;

  // Note File Import (.md / .txt)
  container.querySelector('#input-note-file')?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result || '';
      const notesEditor = container.querySelector('#free-notes-editor');
      if (notesEditor) {
        if (notesEditor.value.trim()) {
          notesEditor.value = notesEditor.value + '\n\n---\n\n' + content;
        } else {
          notesEditor.value = content;
        }
        app.showToast(`✓ 已匯入筆記「${file.name}」！`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Image Upload (.png, .jpg, .webp)
  container.querySelector('#input-image-file')?.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        app.showToast(`圖片「${file.name}」超過 8MB，請縮小後再上傳`);
        continue;
      }
      const base64 = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target?.result);
        reader.readAsDataURL(file);
      });
      state.ui.interviewImages.push({
        name: file.name,
        mimeType: file.type || 'image/png',
        data: base64
      });
    }
    app.showToast(`✓ 已加入 ${files.length} 張架構/筆記圖片`);
    app.render();
  });

  // Remove Image
  container.querySelectorAll('.btn-remove-image').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      if (!isNaN(idx)) {
        state.ui.interviewImages.splice(idx, 1);
        app.render();
      }
    });
  });

  // Toggle Hints
  container.querySelector('#btn-toggle-hints')?.addEventListener('click', () => {
    const card = container.querySelector('#coaching-hints-card');
    if (card) {
      card.style.display = card.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Interview submit
  container.querySelector('#interview-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const freeNotes = container.querySelector('#free-notes-editor')?.value.trim() || '';
    const payload = {
      free_notes: freeNotes,
      images: state.ui.interviewImages || []
    };

    if (hasArticle && !confirm('重新生成會覆蓋目前的母文章（舊版會保留在版本紀錄）。確定？')) return;
    await app.saveInterviewAndGenerateMaster(currentIdea.id, payload);
  });

  // Approve
  container.querySelector('#btn-toggle-approve')?.addEventListener('click', () => {
    app.approveMaster(currentIdea.id, !master.is_approved);
  });

  // Edit mode
  container.querySelector('#btn-edit-master')?.addEventListener('click', () => {
    state.ui.editingMaster = true;
    app.render();
  });
  container.querySelector('#btn-cancel-edit')?.addEventListener('click', () => {
    state.ui.editingMaster = false;
    app.render();
  });

  const editor = container.querySelector('#master-editor');
  const countLabel = container.querySelector('#editor-verify-count');
  if (editor && countLabel) {
    const updateCount = () => {
      const n = (editor.value.match(/\[VERIFY[^\]]*\]/gi) || []).length;
      countLabel.innerHTML = n > 0
        ? `<span style="color: #B45309;">剩餘 ${n} 處 [VERIFY]</span>`
        : '<span style="color: #059669;">✓ 沒有 [VERIFY]</span>';
    };
    editor.addEventListener('input', updateCount);
    updateCount();
  }
  container.querySelector('#btn-save-edit')?.addEventListener('click', () => {
    app.saveMasterEdit(currentIdea.id, editor.value);
  });

  // Re-run CLEAR
  container.querySelector('#btn-rerun-clear')?.addEventListener('click', () => app.rerunClear(currentIdea.id));

  // Copy
  container.querySelector('#btn-copy-master')?.addEventListener('click', () => {
    navigator.clipboard.writeText(master.master_article);
    app.showToast('已複製母文章全文');
  });

  // Export
  container.querySelector('#btn-export-pkg')?.addEventListener('click', () => {
    app.exportIdeaPackage(currentIdea.id);
  });

  // Versions
  container.querySelector('#btn-show-versions')?.addEventListener('click', async () => {
    const panel = container.querySelector('#versions-panel');
    if (panel.innerHTML) { panel.innerHTML = ''; return; }
    const versions = await app.loadVersions(currentIdea.id);
    panel.innerHTML = `
      <div class="info-card" style="margin-top: 12px;">
        <div class="info-card-header"><span>🕘 版本紀錄（最新在上）</span></div>
        ${versions.length ? versions.map(v => `
          <div class="version-row">
            <span>${v.origin === 'ai' ? '🤖 AI 生成' : '✏️ 手動編輯'} · ${esc(v.created_at)} · ${v.content.length} 字</span>
            <button class="btn btn-outline btn-sm btn-load-version" data-id="${v.id}">載入到編輯器</button>
          </div>
        `).join('') : '<p style="font-size: 12.5px; color: var(--text-muted);">沒有版本紀錄</p>'}
      </div>
    `;
    panel.querySelectorAll('.btn-load-version').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = versions.find(x => String(x.id) === btn.dataset.id);
        if (!v) return;
        state.ui.editingMaster = true;
        app.render();
        const ed = document.querySelector('#master-editor');
        if (ed) { ed.value = v.content; ed.dispatchEvent(new Event('input')); }
        app.showToast('已載入舊版本，確認後按「儲存修改」');
      });
    });
  });

  container.querySelector('#btn-goto-podcast')?.addEventListener('click', () => app.switchTab('podcast'));
  container.querySelector('#btn-goto-social')?.addEventListener('click', () => app.switchTab('social'));
}

function renderReview(review) {
  const gates = [
    ['complete', 'Complete 完整'],
    ['clear', 'Clear 清晰'],
    ['evidence', 'Evidence 實證'],
    ['audience', 'Audience 共感'],
    ['revise', 'Revise 語氣安全']
  ];
  const passed = review.overall_status === 'PASSED';
  return `
    <div class="clear-review-box ${review.stale ? 'stale' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
        <span style="font-weight: 700; font-size: 14px; color: var(--primary);">
          🛡️ CLEAR 審查：
          <strong style="color: ${passed ? '#059669' : '#D97706'};">${passed ? '✓ 通過' : '⚠️ 建議修改'}</strong>
          ${review.stale ? '<span class="cite-badge cite-warn" style="margin-left: 6px;">文章已修改，結果已過期</span>' : ''}
        </span>
        <button id="btn-rerun-clear" class="btn btn-outline btn-sm">🔁 重新審查</button>
      </div>
      <div class="clear-gates-grid">
        ${gates.map(([k, label]) => {
          const g = review.gates?.[k] || {};
          return `<div class="gate-pill ${g.status === 'PASS' ? 'pass' : 'revise'}" title="${esc(g.comment || '')}">
            <strong>${label}</strong><br>${esc(g.status || '-')}
          </div>`;
        }).join('')}
      </div>
      ${review.safety_check?.has_diagnostic_language ? '<div class="source-banner cite-bad" style="margin-bottom: 8px;">⚠️ 偵測到可能的診斷性語言</div>' : ''}
      ${review.safety_check?.unsupported_claims_flagged?.filter(Boolean).length ? `
        <div style="font-size: 12.5px; color: #92400E;"><strong>過度絕對的說法：</strong>
          <ul style="padding-left: 18px;">${review.safety_check.unsupported_claims_flagged.filter(Boolean).map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        </div>` : ''}
      ${review.specific_revision_suggestions?.length ? `
        <div style="font-size: 12.5px; color: #4B5563; margin-top: 6px;"><strong>💡 修改建議：</strong>
          <ul style="padding-left: 18px;">${review.specific_revision_suggestions.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
        </div>` : ''}
    </div>
  `;
}
