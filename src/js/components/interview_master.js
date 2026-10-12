import { esc, renderMarkdown } from '../utils.js';

const QUESTIONS = [
  ['q1_importance', '1. 這個主題為什麼對你而言很重要？', '例如：看過太多人因為過度討好而身心耗竭...'],
  ['q2_experience', '2. 你親身經歷或觀察到的具體例子？', '例如：週五下班前同事丟來的工作，胃一緊卻還是說「好」...（留白的話，文章會標記 [VERIFY] 請你補）'],
  ['q3_oversimplification', '3. 你想避免的過度簡化說法？', '例如：不想只說「勇敢說不就好」，說不背後有被拋棄的恐懼...'],
  ['q4_client_notice', '4. 教練對話中，你會先陪對方看見什麼？', '例如：先留意身體感受，分清哪些是別人的情緒...'],
  ['q5_small_experiment', '5. 讀者今天就能試的一個小實驗？', '例如：練習說「我看一下行事曆，十分鐘後回你」...']
];

export function renderInterviewMaster(container, state, app) {
  const detail = state.currentDetail;
  const currentIdea = detail?.idea || null;
  const master = detail?.master || null;
  const answers = master?.interview_answers || {};
  const review = master?.clear_review || null;
  const editing = state.ui.editingMaster;

  if (!currentIdea) {
    container.innerHTML = `<div style="text-align: center; padding: 100px 20px; color: var(--text-muted);"><h3>請先在「靈感與學理研究」選擇或建立主題</h3></div>`;
    return;
  }

  const markers = master?.verify_markers || 0;
  const hasArticle = !!master?.master_article;

  container.innerHTML = `
    <div class="split-view">
      <div class="side-panel">
        <h3>🎙️ 個人洞見訪談</h3>
        <p class="section-desc">你的經驗與觀點是文章的靈魂。沒填的題目，AI 不會替你編造，而是留下 [VERIFY] 請你補。</p>
        ${!currentIdea.research_pack ? `<div class="source-banner cite-bad" style="margin-bottom: 12px;">⚠️ 尚未完成研究，請先回上一步</div>` : ''}

        <form id="interview-form">
          ${QUESTIONS.map(([key, label, ph]) => `
            <div class="form-group">
              <label class="form-label">${label}</label>
              <textarea data-key="${key}" class="form-textarea" placeholder="${esc(ph)}">${esc(answers[key] || '')}</textarea>
            </div>
          `).join('')}
          <button type="submit" class="btn btn-primary btn-block" ${state.isProcessing || !currentIdea.research_pack ? 'disabled' : ''}>
            ${state.isProcessing ? '⏳ 生成中...' : (hasArticle ? '🔄 依新回答重新生成母文章' : '✨ 生成母文章（含 CLEAR 審查）')}
          </button>
          ${hasArticle ? `<p style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">重新生成會覆蓋目前文章，舊版仍保留在版本紀錄中。</p>` : ''}
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

  // Interview submit
  container.querySelector('#interview-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {};
    container.querySelectorAll('#interview-form textarea').forEach(t => { payload[t.dataset.key] = t.value.trim(); });
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
