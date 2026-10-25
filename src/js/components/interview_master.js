import { esc, renderMarkdown, downloadMarkdownFile, renderMdArchiveSection, bindMdArchiveEvents } from '../utils.js';

const HINTS = [
  { icon: '🌱', title: '為什麼我想聊這件事？', desc: '觸動你注意這個主題的原因，或最近卡在你心裡的一個問題。' },
  { icon: '☕', title: '我的經驗或觀察', desc: '真實的生活片刻、工作場景、或某個讓你有感的瞬間。' },
  { icon: '💡', title: '想補充的不同角度', desc: '常見說法忽略了什麼？有沒有更貼近真實處境的看法？' },
  { icon: '🔍', title: '我是怎麼發現的？', desc: '讀到的書、看到的研究、或自己踩過坑之後整理出的線索。' },
  { icon: '✨', title: '一個我自己試過（或想試）的小做法', desc: '具體、低門檻、可以分享給讀者一起試試看的小方法。' }
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

  // Topic switcher options
  const ideas = state.ideas || [];

  if (!currentIdea && ideas.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 100px 20px; color: var(--text-muted);">
        <h3>💡 尚未建立任何主題</h3>
        <p style="font-size: 14px; margin-top: 8px;">你可以直接點擊下方按鈕，在洞見母文直接建立新主題開始書寫：</p>
        <button id="btn-quick-new-idea" class="btn btn-primary" style="margin-top: 14px;">+ 快速建立新主題</button>
      </div>
    `;
    container.querySelector('#btn-quick-new-idea')?.addEventListener('click', async () => {
      const title = prompt('請輸入文章主題（例如：為什麼開會越多決策越慢）：');
      if (title && title.trim()) {
        await app.createIdea({ title: title.trim(), source_type: 'Observation' });
      }
    });
    return;
  }

  const markers = master?.verify_markers || 0;
  const hasArticle = !!master?.master_article;

  container.innerHTML = `
    <div class="split-view interview-split-view">
      <div class="side-panel interview-panel">
        <div class="interview-panel-header">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
            <h3 style="margin-bottom: 0;">🎙️ 個人洞見與筆記空間</h3>
            <div style="display: flex; gap: 4px;">
              <button type="button" id="btn-interview-new-topic" class="btn btn-outline btn-xs" title="直接新建主題">+ 新增主題</button>
              <button type="button" id="btn-interview-edit-topic" class="btn btn-outline btn-xs" title="修改目前主題名稱">✏️ 改名</button>
              <button type="button" id="btn-interview-del-topic" class="btn btn-outline btn-xs" style="color: #DC2626;" title="刪除目前主題">🗑️ 刪除</button>
            </div>
          </div>
          
          <!-- Quick Topic Selector -->
          <div class="form-group" style="margin-bottom: 10px;">
            <label class="form-label" style="font-size: 12px; color: var(--text-muted); margin-bottom: 4px;">目前主題：</label>
            <select id="interview-topic-select" class="form-select" style="font-size: 13px; font-weight: 600; padding: 6px 10px;">
              ${ideas.map(item => `
                <option value="${esc(item.id)}" ${item.id === currentIdea?.id ? 'selected' : ''}>
                  ${esc(item.title)} ${item.is_approved ? '✓' : ''}
                </option>
              `).join('')}
            </select>
          </div>

          <p class="section-desc" style="margin-bottom: 8px;">
            隨性書寫、貼上 Gemini Notebook 架構，或上傳筆記與草圖。下方有寫作提點可參考，放手自由發揮。
          </p>
        </div>

        ${currentIdea?.research_pack ? `
          <div class="source-banner cite-ok" style="margin-bottom: 8px; font-size: 12px; padding: 6px 10px;">
            📚 已結合第一步驟之跨領域研究包
          </div>
        ` : `
          <div class="source-banner" style="margin-bottom: 8px; font-size: 12px; padding: 6px 10px; background: #F3F4F6; color: #4B5563; border-color: #E5E7EB;">
            💡 獨立模式：直接依你的筆記與架構生成分享文章，無需先跑研究步驟
          </div>
        `}

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
              <label class="form-label" style="margin-bottom: 0;">✍️ 我的想法、架構或筆記</label>
              <button type="button" id="btn-toggle-hints" class="btn-text-link" style="font-size: 12px; color: var(--primary);">
                💡 寫作提點 (${HINTS.length})
              </button>
            </div>
            <textarea id="free-notes-editor" class="form-textarea notes-workspace" placeholder="在這裡自由書寫你的觀察、生活片段、讀書心得，或直接貼上 Gemini Notebook / NotebookLM 整理好的架構與大綱...&#10;&#10;不必拘泥固定格式，AI 會以第一人稱「我」的分享口吻（不說教、不自稱教練），依內容自然組織成一篇好讀的文章。">${esc(initialNotes)}</textarea>
          </div>

          <!-- Collapsible / Floating Writing Prompts -->
          <div id="coaching-hints-card" class="coaching-hints-card">
            <div class="hints-card-header">
              <span>💡 寫作提點（寫作時可參考的角度，不需逐題填寫）</span>
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

          <div style="display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap;">
            <button type="button" id="btn-save-notes-only" class="btn btn-outline btn-sm" style="flex: 1;">💾 確定儲存筆記</button>
            <button type="button" id="btn-export-notes-md" class="btn btn-outline btn-sm" style="flex: 1;">📥 筆記存為 .md</button>
            <button type="button" id="btn-clear-notes" class="btn btn-outline btn-sm" style="color: #DC2626;">🗑️ 清空</button>
          </div>

          <div style="margin-top: 10px;">
            <button type="submit" class="btn btn-primary btn-block" ${state.isProcessing ? 'disabled' : ''}>
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
              <button id="btn-edit-master" class="btn btn-outline btn-sm">✏️ 修改母文</button>
              <button id="btn-delete-master" class="btn btn-outline btn-sm" style="color: #DC2626;">🗑️ 刪除母文</button>
              <button id="btn-toggle-approve" class="btn ${master.is_approved ? 'btn-secondary' : 'btn-accent'} btn-sm" ${!master.is_approved && markers > 0 ? 'disabled title="請先處理 [VERIFY]"' : ''}>
                ${master.is_approved ? '取消核准' : '🎯 確定核准 (APPROVED)'}
              </button>
            </div>
          ` : ''}
        </div>

        ${!hasArticle && !editing ? `
          <div style="text-align: center; padding: 60px 20px; border: 2px dashed var(--border); border-radius: 10px;">
            <p style="font-size: 14px; color: var(--text-muted); margin-bottom: 12px;">尚未生成母文章。你可以由左側筆記讓 AI 生成，或直接手動新增母文章：</p>
            <button id="btn-create-blank-master" class="btn btn-outline btn-sm">➕ 手動新增 / 貼上母文章</button>
          </div>
        ` : `
          ${markers > 0 ? `
            <div class="source-banner cite-bad" style="margin-bottom: 14px;">
              ⚠️ 文章中有 <strong>${markers}</strong> 處 <mark class="verify-mark">[VERIFY]</mark>（未查證的文獻或需要你補充的個人例子）。
              請點「修改母文」補上或刪除，處理完才能核准。
            </div>
          ` : ''}

          ${review ? renderReview(review) : ''}

          ${editing ? `
            <textarea id="master-editor" class="form-textarea master-editor" placeholder="在此輸入或修改母文章 Markdown 內容...">${esc(master?.master_article || '')}</textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
              <span id="editor-verify-count" style="font-size: 12px; color: var(--text-muted);"></span>
              <div style="display: flex; gap: 8px;">
                <button id="btn-cancel-edit" class="btn btn-outline btn-sm">取消</button>
                <button id="btn-save-edit" class="btn btn-primary btn-sm" ${state.isProcessing ? 'disabled' : ''}>💾 確定儲存修改</button>
              </div>
            </div>
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">儲存後會取消核准，舊的 CLEAR 審查會標示為「已過期」，建議重新審查。</p>
          ` : `
            <div class="article-view markdown-body">${renderMarkdown(master.master_article)}</div>
          `}

          ${!editing ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button id="btn-copy-master" class="btn btn-outline btn-sm">📋 複製全文</button>
                <button id="btn-show-versions" class="btn btn-outline btn-sm">🕘 版本紀錄</button>
                <button id="btn-export-pkg" class="btn btn-export btn-sm" title="一鍵打包下載整合 Markdown，並存入下方 MD 存檔紀錄">📦 匯出 .md 存檔</button>
              </div>
              <div style="display: flex; gap: 10px;">
                <button id="btn-goto-podcast" class="btn btn-secondary btn-sm" ${!master.is_approved ? 'disabled title="需先核准母文章"' : ''}>🎙️ 播客錄音室 ➔</button>
                <button id="btn-goto-social" class="btn btn-accent btn-sm" ${!master.is_approved ? 'disabled title="需先核准母文章"' : ''}>📱 社群矩陣 ➔</button>
              </div>
            </div>
            <div id="versions-panel"></div>
          ` : ''}
        `}

        ${renderMdArchiveSection(detail?.exports || [], currentIdea, state)}
      </div>
    </div>
  `;

  // Switch Topic directly in Interview tab
  container.querySelector('#interview-topic-select')?.addEventListener('change', e => {
    const id = e.target.value;
    if (id) app.selectIdea(id);
  });

  // Create / Rename / Delete Topic directly in Interview tab
  container.querySelector('#btn-interview-new-topic')?.addEventListener('click', async () => {
    const title = prompt('請輸入新主題標題（例如：為什麼開會越多決策越慢）：');
    if (title && title.trim()) {
      await app.createIdea({
        title: title.trim(),
        source_type: 'Observation',
        raw_notes: '直接在洞見母文建立的主題'
      });
    }
  });
  container.querySelector('#btn-interview-edit-topic')?.addEventListener('click', async () => {
    if (!currentIdea) return;
    const title = prompt('修改主題標題：', currentIdea.title);
    if (title && title.trim() && title.trim() !== currentIdea.title) {
      await app.updateIdea(currentIdea.id, { title: title.trim() });
    }
  });
  container.querySelector('#btn-interview-del-topic')?.addEventListener('click', async () => {
    if (!currentIdea) return;
    if (confirm(`確定要刪除主題「${currentIdea.title}」及其相關文章嗎？`)) {
      await app.deleteIdea(currentIdea.id);
    }
  });

  // Save / Export / Clear Notes without triggering AI
  container.querySelector('#btn-save-notes-only')?.addEventListener('click', async () => {
    const freeNotes = container.querySelector('#free-notes-editor')?.value || '';
    await app.saveInterviewOnly(currentIdea.id, {
      free_notes: freeNotes,
      images: state.ui.interviewImages || []
    });
  });
  container.querySelector('#btn-export-notes-md')?.addEventListener('click', async () => {
    const freeNotes = container.querySelector('#free-notes-editor')?.value.trim() || '';
    if (!freeNotes) return app.showToast('筆記目前是空的');
    await app.exportIdeaPackage(currentIdea.id, {
      title: `${currentIdea.title}（個人筆記）`,
      note: '個人洞見筆記',
      markdown_content: `# ${currentIdea.title} - 個人洞見與筆記\n\n${freeNotes}\n`
    });
  });
  container.querySelector('#btn-clear-notes')?.addEventListener('click', async () => {
    const ed = container.querySelector('#free-notes-editor');
    if (!ed || !ed.value) return;
    if (confirm('確定要清空目前的筆記內容嗎？')) {
      ed.value = '';
      await app.saveInterviewOnly(currentIdea.id, { free_notes: '', images: [] });
    }
  });

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

  // Edit / Create Blank / Delete Master mode
  container.querySelector('#btn-edit-master')?.addEventListener('click', () => {
    state.ui.editingMaster = true;
    app.render();
  });
  container.querySelector('#btn-create-blank-master')?.addEventListener('click', () => {
    state.ui.editingMaster = true;
    app.render();
  });
  container.querySelector('#btn-delete-master')?.addEventListener('click', async () => {
    if (confirm('確定要刪除此篇母文章嗎？（歷史版本紀錄仍會保留）')) {
      await app.deleteMasterArticle(currentIdea.id);
    }
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
    app.exportIdeaPackage(currentIdea.id, { note: '母文章定稿' });
  });

  // Versions
  const renderVersionsPanel = async () => {
    const panel = container.querySelector('#versions-panel');
    if (!panel) return;
    const versions = await app.loadVersions(currentIdea.id);
    panel.innerHTML = `
      <div class="info-card" style="margin-top: 12px;">
        <div class="info-card-header"><span>🕘 版本紀錄（最新在上）</span></div>
        ${versions.length ? versions.map(v => `
          <div class="version-row">
            <span>${v.origin === 'ai' ? '🤖 AI 生成' : '✏️ 手動編輯'} · ${esc(v.created_at)} · ${v.content.length} 字</span>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-outline btn-sm btn-dl-version" data-id="${v.id}">📥 下載 .md</button>
              <button class="btn btn-outline btn-sm btn-load-version" data-id="${v.id}">✏️ 載入修改</button>
              <button class="btn btn-outline btn-sm btn-del-version" data-id="${v.id}" style="color: #DC2626;">🗑️ 刪除</button>
            </div>
          </div>
        `).join('') : '<p style="font-size: 12.5px; color: var(--text-muted);">沒有版本紀錄</p>'}
      </div>
    `;
    panel.querySelectorAll('.btn-dl-version').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = versions.find(x => String(x.id) === btn.dataset.id);
        if (v) downloadMarkdownFile(`${currentIdea.title}_v${v.id}.md`, v.content);
      });
    });
    panel.querySelectorAll('.btn-load-version').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = versions.find(x => String(x.id) === btn.dataset.id);
        if (!v) return;
        state.ui.editingMaster = true;
        app.render();
        const ed = document.querySelector('#master-editor');
        if (ed) { ed.value = v.content; ed.dispatchEvent(new Event('input')); }
        app.showToast('已載入舊版本，確認後按「💾 確定儲存修改」');
      });
    });
    panel.querySelectorAll('.btn-del-version').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('確定要刪除此條版本紀錄？')) {
          await app.deleteMasterVersion(currentIdea.id, btn.dataset.id);
          await renderVersionsPanel();
        }
      });
    });
  };

  container.querySelector('#btn-show-versions')?.addEventListener('click', async () => {
    const panel = container.querySelector('#versions-panel');
    if (panel.innerHTML) { panel.innerHTML = ''; return; }
    await renderVersionsPanel();
  });

  container.querySelector('#btn-goto-podcast')?.addEventListener('click', () => app.switchTab('podcast'));
  container.querySelector('#btn-goto-social')?.addEventListener('click', () => app.switchTab('social'));

  bindMdArchiveEvents(container, detail?.exports || [], currentIdea, state, app);
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
      ${review.safety_check?.mentions_coaching_service ? `<div class="source-banner cite-bad" style="margin-bottom: 8px;">⚠️ 偵測到教練/諮詢服務相關字眼（${esc((review.safety_check.coaching_mentions_found || []).join('、') || '請移除服務邀約或教練自稱')}）</div>` : ''}
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
