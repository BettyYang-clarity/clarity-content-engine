import { esc, renderMarkdown, renderMdArchiveSection, bindMdArchiveEvents } from '../utils.js';

// Platform text limits (characters)
const LIMITS = { threads: 500, igCaption: 2200 };

const DEFAULT_STYLE_ANCHOR = 'Kinfolk 雜誌室內靜物攝影風格，50mm f/1.8 淺景深定焦鏡頭，Kodak Portra 400 柔和底片質感，低飽和暖米白、燕麥色與鼠尾草綠色調，柔和斜射自然窗光';

/**
 * Ensure any visual prompt (including older saved ones) starts with an explicit
 * image-generation verb, strips Midjourney-style tags, and locks onto a unified style anchor.
 */
function toGeminiImagePrompt(raw, { isContinuation = false, styleAnchor = DEFAULT_STYLE_ANCHOR } = {}) {
  if (!raw) return '';
  let text = String(raw).trim();
  // Strip negative / technical / "blank background" phrases that trigger Gemini's empty-content filter
  text = text
    .replace(/,?\s*no objects/gi, '')
    .replace(/,?\s*no text/gi, '')
    .replace(/,?\s*text-centric layout/gi, '')
    .replace(/,?\s*aspect ratio\s*4:5/gi, '')
    .replace(/,?\s*1080\s*x\s*1350(\s*px)?/gi, '')
    .replace(/,?\s*4k\b/gi, '')
    .replace(/沒有任何物品[，、]?/g, '')
    .replace(/無雜物[，、]?/g, '')
    .replace(/適合直接作為文字排版的底圖[。，]?/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/g, '')
    .trim();

  // If it's a legacy "textured background" prompt with no concrete subject, replace with same-room wall/shadow angle
  if (/clean minimalist textured background/i.test(text)) {
    text = '鏡頭稍微上移，對焦在同一個房間的溫暖米白色灰泥牆面，午後陽光穿過亞麻窗紗在牆上投下柔和的植物樹影，畫面最下緣僅露出一小截同一張淺橡木桌面邊緣與一枝失焦的尤加利葉，上方呈現大片乾淨柔和的淺景深牆面';
  }

  const isChinese = /[\u4e00-\u9fff]/.test(text);
  const anchor = styleAnchor || DEFAULT_STYLE_ANCHOR;

  if (isContinuation && !/延續上一張|same room and style/i.test(text)) {
    text = text
      .replace(/^(請(幫我)?生成一張直式\s*4:5\s*的圖片[：:]?\s*)/i, '')
      .replace(/^(please\s+generate\s+a\s+vertical\s+4:5\s+(editorial\s+)?(image|photograph)\s+of[：:]?\s*)/i, '');
    text = isChinese
      ? `請幫我生成一張直式 4:5 的圖片，請嚴格延續上一張圖完全相同的房間場景、牆面與桌面材質、色調、光線方向與攝影風格，只改變鏡頭位置：${text}`
      : `Please generate a vertical 4:5 editorial photograph, strictly keeping the exact same room, wall and table materials, color palette, lighting direction, and photography style as the previous image, only shifting the camera angle: ${text}`;
  } else {
    const hasVerb = /^(請(幫我)?生成|請畫|請製作|please\s+generate|generate\s+(an?\s+)?(vertical\s+)?(4:5\s+)?image|create\s+an?\s+image|draw\s+)/i.test(text);
    if (!hasVerb) {
      text = isChinese
        ? `請幫我生成一張直式 4:5 的圖片：${text}`
        : `Please generate a vertical 4:5 editorial photograph of: ${text}`;
    }
  }

  if (!text.includes('固定風格鎖定') && !text.includes('Kinfolk')) {
    text = `${text.replace(/[。.]$/, '')}。【固定風格鎖定：${anchor}】`;
  }
  return text;
}

function lengthBadge(text, limit) {
  const n = [...(text || '')].length;
  const over = n > limit;
  return `<span class="cite-badge ${over ? 'cite-bad' : 'cite-ok'}">${n} / ${limit} 字${over ? '（超過上限）' : ''}</span>`;
}

export function renderSocialMultiplier(container, state, app) {
  const detail = state.currentDetail;
  const currentIdea = detail?.idea || null;
  const master = detail?.master || null;
  const outputs = detail?.outputs || [];

  if (!currentIdea || !master?.master_article || !master.is_approved) {
    container.innerHTML = `
      <div style="text-align: center; padding: 100px 20px; color: var(--text-muted);">
        <h3>📱 社群內容只會從「已核准」的母文章產生</h3>
        <button id="btn-back-to-master2" class="btn btn-primary" style="margin-top: 14px;">前往母文章 ➔</button>
      </div>
    `;
    container.querySelector('#btn-back-to-master2')?.addEventListener('click', () => app.switchTab('interview'));
    return;
  }

  const find = p => outputs.find(o => o.platform === p);
  const ig = find('instagram')?.content_payload || null;
  const fb = find('facebook')?.content_payload || null;
  const threads = find('threads')?.content_payload || null;
  const blog = find('blog')?.content_payload || null;
  const isStale = outputs.some(o => o.is_stale);
  const sub = state.ui.socialTab || 'ig';
  const editingSocial = !!state.ui.editingSocial;

  container.innerHTML = `
    <div class="main-panel" style="max-width: 1200px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px; flex-wrap: wrap;">
        <div>
          <h2>📱 社群多平台矩陣</h2>
          <div style="font-size: 13.5px; color: var(--text-muted); margin-top: 4px;">Instagram 輪播 · Facebook · Threads × 3 · Blog</div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${outputs.length > 0 ? `
            <button id="btn-toggle-social-edit" class="btn btn-outline btn-sm">${editingSocial ? '取消修改' : '✏️ 修改目前平台內容'}</button>
            <button id="btn-delete-social" class="btn btn-outline btn-sm" style="color: #DC2626;">🗑️ 刪除</button>
          ` : ''}
          <button id="btn-export-social-pkg" class="btn btn-export btn-sm" title="一鍵打包下載整合 Markdown 並存入紀錄">📦 匯出 .md 存檔</button>
          <button id="btn-generate-multiplier" class="btn btn-accent btn-sm" ${state.isProcessing ? 'disabled' : ''} style="white-space: nowrap;">
            ${state.isProcessing ? '⏳ 生成中...' : (outputs.length ? '🔄 重新生成' : '✨ 生成各平台內容')}
          </button>
        </div>
      </div>

      ${isStale ? `<div class="source-banner cite-warn" style="margin-bottom: 14px;">⚠️ 這些內容是在母文章修改之前產生的，建議重新生成。</div>` : ''}

      ${outputs.length === 0 ? `
        <div style="text-align: center; padding: 80px 20px; border: 2px dashed var(--border); border-radius: 10px;">
          <p style="font-size: 15px; font-weight: 600; color: var(--primary);">尚未生成社群內容</p>
        </div>
      ` : `
        <div class="podcast-mode-tabs" style="margin-bottom: 20px;">
          ${[['ig', '📷 Instagram'], ['fb', '📘 Facebook'], ['threads', '🧵 Threads'], ['blog', '🌐 Blog']]
            .map(([k, l]) => `<button class="mode-tab-btn ${sub === k ? 'active' : ''}" data-subtab="${k}">${l}</button>`).join('')}
        </div>

        ${sub === 'ig' && ig ? `
          ${ig.visual_theme ? `<div class="source-banner cite-ok" style="margin-bottom: 12px;">🎨 <strong>本篇輪播視覺主題：</strong>${esc(ig.visual_theme)}</div>` : ''}
          <div class="info-card" style="margin-bottom: 16px; padding: 12px 16px; background: #FAF9F6; border-left: 4px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span style="font-size: 13px; font-weight: 600; color: var(--primary);">🎨 Gemini 生圖指令（貼在同一對話框依序生成，風格一致）</span>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button id="btn-copy-cover-prompt" class="btn btn-primary btn-sm" style="white-space: nowrap;">① 複製「封面圖」指令</button>
                <button id="btn-copy-inner-bg" class="btn btn-accent btn-sm" style="white-space: nowrap;">② 複製「內頁共用圖」指令</button>
                <button id="btn-copy-outro-prompt" class="btn btn-outline btn-sm" style="white-space: nowrap;">③ 複製「封底圖」指令</button>
              </div>
            </div>
          </div>

          ${editingSocial ? `
            <div class="info-card" style="margin-bottom: 16px; border: 2px solid var(--primary);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-weight: 700; color: var(--primary);">✏️ 修改 IG 輪播卡片與 Caption</span>
                <button type="button" id="btn-add-ig-slide" class="btn btn-outline btn-sm">➕ 新增一頁卡片</button>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; margin-bottom: 12px;">
                ${(ig.slides || []).map((s, i) => `
                  <div style="border: 1px solid var(--border); border-radius: 8px; padding: 10px; background: #F9FAFB;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <span class="slide-num-badge">P.${i + 1}</span>
                      <button type="button" class="btn btn-outline btn-xs btn-del-ig-slide" data-i="${i}" style="color: #DC2626;">🗑️ 刪除</button>
                    </div>
                    <input type="text" class="form-input inp-ig-slide-title" data-i="${i}" value="${esc(s.title || '')}" placeholder="標題" style="margin-bottom: 6px; font-size: 13px;">
                    <textarea class="form-textarea inp-ig-slide-sub" data-i="${i}" placeholder="內文" style="min-height: 70px; font-size: 12.5px;">${esc(s.subtitle || '')}</textarea>
                  </div>
                `).join('')}
              </div>
              <div class="form-group">
                <label class="form-label">📝 IG Caption</label>
                <textarea id="inp-ig-caption" class="form-textarea" style="min-height: 150px;">${esc(ig.caption || '')}</textarea>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px;">
                <button type="button" class="btn btn-outline btn-sm btn-cancel-social-edit">取消</button>
                <button type="button" id="btn-save-ig" class="btn btn-primary btn-sm">💾 確定儲存 IG 修改</button>
              </div>
            </div>
          ` : `
            <div class="carousel-deck">
              ${(ig.slides || []).map((s, i) => {
                const isCover = i === 0;
                const isOutro = i === (ig.slides.length - 1) && ig.slides.length > 1;
                return `
                <div class="carousel-slide-card">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                      <span class="slide-num-badge">P.${esc(s.slide_num)}</span>
                      <span style="font-size: 11px; color: var(--text-muted);">${isCover ? '🌟 封面' : (isOutro ? '🎯 封底' : '📝 內頁')}</span>
                    </div>
                    <div class="slide-title">${esc(s.title)}</div>
                    <div class="slide-body">${esc(s.subtitle)}</div>
                  </div>
                  <button class="btn btn-outline btn-sm btn-block btn-copy-slide-text" data-i="${i}" style="margin-top: 10px;">📋 複製此頁文字</button>
                </div>
              `;
              }).join('')}
            </div>
            <div class="info-card" style="margin-top: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px;">
                <span style="font-weight: 700; color: var(--primary);">📝 Caption ${lengthBadge(ig.caption, LIMITS.igCaption)}</span>
                <button id="btn-copy-ig-caption" class="btn btn-primary btn-sm">📋 複製</button>
              </div>
              <div class="article-view" style="max-height: 250px; font-family: var(--font-sans); font-size: 13.5px;">${esc(ig.caption)}</div>
              ${ig.alt_text ? `<p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;"><strong>替代文字：</strong>${esc(ig.alt_text)}</p>` : ''}
            </div>
          `}
        ` : ''}

        ${sub === 'fb' && fb ? `
          <div class="info-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-weight: 700; color: var(--primary);">📘 Facebook 貼文</span>
              <button id="btn-copy-fb" class="btn btn-primary btn-sm">📋 複製</button>
            </div>
            ${editingSocial ? `
              <textarea id="inp-fb-text" class="form-textarea" style="min-height: 220px;">${esc(fb.post_text || '')}</textarea>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                <button type="button" class="btn btn-outline btn-sm btn-cancel-social-edit">取消</button>
                <button type="button" id="btn-save-fb" class="btn btn-primary btn-sm">💾 確定儲存 FB 修改</button>
              </div>
            ` : `
              <div class="article-view" style="font-family: var(--font-sans); font-size: 14.5px;">${esc(fb.post_text)}</div>
            `}
          </div>
        ` : ''}

        ${sub === 'threads' && Array.isArray(threads) ? `
          ${editingSocial ? `
            <div class="info-card" style="border: 2px solid var(--primary);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 700; color: var(--primary);">✏️ 修改 Threads 貼文組</span>
                <button type="button" id="btn-add-thread" class="btn btn-outline btn-sm">➕ 新增一則 Threads</button>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                ${threads.map((t, i) => `
                  <div style="border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; gap: 6px;">
                      <input type="text" class="form-input inp-thread-label" data-i="${i}" value="${esc(t.label || '')}" style="font-size: 12.5px; font-weight: 700;">
                      <button type="button" class="btn btn-outline btn-xs btn-del-thread" data-i="${i}" style="color: #DC2626;">🗑️</button>
                    </div>
                    <textarea class="form-textarea inp-thread-text" data-i="${i}" style="min-height: 150px; font-size: 13.5px;">${esc(t.text || '')}</textarea>
                  </div>
                `).join('')}
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
                <button type="button" class="btn btn-outline btn-sm btn-cancel-social-edit">取消</button>
                <button type="button" id="btn-save-threads" class="btn btn-primary btn-sm">💾 確定儲存 Threads 修改</button>
              </div>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
              ${threads.map((t, i) => `
                <div class="info-card" style="display: flex; flex-direction: column; justify-content: space-between;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 6px;">
                      <span style="font-weight: 700; font-size: 13px; color: var(--accent);">${esc(t.label)}</span>
                      ${lengthBadge(t.text, LIMITS.threads)}
                    </div>
                    <p style="font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${esc(t.text)}</p>
                  </div>
                  <button class="btn btn-outline btn-sm btn-block btn-copy-thread" data-i="${i}" style="margin-top: 14px;">📋 複製</button>
                </div>
              `).join('')}
            </div>
          `}
        ` : ''}

        ${sub === 'blog' && blog ? `
          <div class="info-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px;">
              <div>
                <h3 style="color: var(--primary);">${esc(blog.seo_title)}</h3>
                <p style="font-size: 12px; color: var(--text-muted);">Meta：${esc(blog.meta_description)}</p>
              </div>
              <button id="btn-copy-blog" class="btn btn-primary btn-sm">📋 複製 Markdown</button>
            </div>
            ${editingSocial ? `
              <div class="form-group">
                <label class="form-label">SEO 標題</label>
                <input type="text" id="inp-blog-title" class="form-input" value="${esc(blog.seo_title || '')}">
              </div>
              <div class="form-group">
                <label class="form-label">Meta 摘要</label>
                <input type="text" id="inp-blog-meta" class="form-input" value="${esc(blog.meta_description || '')}">
              </div>
              <div class="form-group">
                <label class="form-label">Markdown 內文</label>
                <textarea id="inp-blog-md" class="form-textarea" style="min-height: 260px;">${esc(blog.markdown_content || '')}</textarea>
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px;">
                <button type="button" class="btn btn-outline btn-sm btn-cancel-social-edit">取消</button>
                <button type="button" id="btn-save-blog" class="btn btn-primary btn-sm">💾 確定儲存 Blog 修改</button>
              </div>
            ` : `
              <div class="article-view markdown-body">${renderMarkdown(blog.markdown_content)}</div>
            `}
          </div>
        ` : ''}
      `}

      ${renderMdArchiveSection(detail?.exports || [], currentIdea, state)}
    </div>
  `;

  container.querySelectorAll('.mode-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.socialTab = btn.dataset.subtab;
      app.render();
    });
  });

  container.querySelector('#btn-toggle-social-edit')?.addEventListener('click', () => {
    state.ui.editingSocial = !state.ui.editingSocial;
    app.render();
  });
  container.querySelectorAll('.btn-cancel-social-edit').forEach(b => b.addEventListener('click', () => {
    state.ui.editingSocial = false;
    app.render();
  }));
  container.querySelector('#btn-delete-social')?.addEventListener('click', async () => {
    const platMap = { ig: 'instagram', fb: 'facebook', threads: 'threads', blog: 'blog' };
    const p = platMap[sub] || 'all';
    if (confirm(`確定要刪除目前平台（${p}）的內容嗎？`)) {
      await app.deleteSocialPlatform(currentIdea.id, p);
    }
  });

  // IG Edit actions
  container.querySelector('#btn-add-ig-slide')?.addEventListener('click', async () => {
    const slides = [...(ig?.slides || [])];
    slides.push({ slide_num: slides.length + 1, type: 'content', title: '新頁面標題', subtitle: '新頁面內文', visual_prompt: ig?.inner_page_bg_prompt || '' });
    await app.saveSocialPlatform(currentIdea.id, 'instagram', { ...ig, slides }, true);
  });
  container.querySelectorAll('.btn-del-ig-slide').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.i);
      const slides = (ig?.slides || []).filter((_, i) => i !== idx).map((s, i) => ({ ...s, slide_num: i + 1 }));
      await app.saveSocialPlatform(currentIdea.id, 'instagram', { ...ig, slides }, true);
    });
  });
  container.querySelector('#btn-save-ig')?.addEventListener('click', async () => {
    const titles = Array.from(container.querySelectorAll('.inp-ig-slide-title'));
    const subs = Array.from(container.querySelectorAll('.inp-ig-slide-sub'));
    const slides = (ig?.slides || []).map((s, i) => ({
      ...s,
      slide_num: i + 1,
      title: titles[i]?.value || '',
      subtitle: subs[i]?.value || ''
    }));
    const caption = container.querySelector('#inp-ig-caption')?.value || '';
    await app.saveSocialPlatform(currentIdea.id, 'instagram', { ...ig, slides, caption });
  });

  // FB Edit action
  container.querySelector('#btn-save-fb')?.addEventListener('click', async () => {
    const post_text = container.querySelector('#inp-fb-text')?.value || '';
    await app.saveSocialPlatform(currentIdea.id, 'facebook', { post_text });
  });

  // Threads Edit actions
  container.querySelector('#btn-add-thread')?.addEventListener('click', async () => {
    const next = [...(threads || []), { type: 'custom', label: `④ 補充篇`, text: '' }];
    await app.saveSocialPlatform(currentIdea.id, 'threads', next, true);
  });
  container.querySelectorAll('.btn-del-thread').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset.i);
      const next = (threads || []).filter((_, i) => i !== idx);
      await app.saveSocialPlatform(currentIdea.id, 'threads', next, true);
    });
  });
  container.querySelector('#btn-save-threads')?.addEventListener('click', async () => {
    const labels = Array.from(container.querySelectorAll('.inp-thread-label'));
    const texts = Array.from(container.querySelectorAll('.inp-thread-text'));
    const next = (threads || []).map((t, i) => ({
      ...t,
      label: labels[i]?.value || t.label,
      text: texts[i]?.value || ''
    }));
    await app.saveSocialPlatform(currentIdea.id, 'threads', next);
  });

  // Blog Edit action
  container.querySelector('#btn-save-blog')?.addEventListener('click', async () => {
    const seo_title = container.querySelector('#inp-blog-title')?.value || '';
    const meta_description = container.querySelector('#inp-blog-meta')?.value || '';
    const markdown_content = container.querySelector('#inp-blog-md')?.value || '';
    await app.saveSocialPlatform(currentIdea.id, 'blog', { seo_title, meta_description, markdown_content });
  });

  container.querySelector('#btn-export-social-pkg')?.addEventListener('click', () => app.exportIdeaPackage(currentIdea.id, { note: '全平台社群完稿' }));
  container.querySelector('#btn-generate-multiplier')?.addEventListener('click', () => app.generateMultiplier(currentIdea.id));

  const copyText = (text, msg) => { navigator.clipboard.writeText(text || ''); app.showToast(msg); };
  container.querySelector('#btn-copy-cover-prompt')?.addEventListener('click', () => {
    const coverRaw = ig?.slides?.[0]?.visual_prompt || '';
    copyText(toGeminiImagePrompt(coverRaw, { isContinuation: false, styleAnchor: ig?.style_anchor }), '已複製「① 封面圖」生圖指令');
  });
  container.querySelector('#btn-copy-inner-bg')?.addEventListener('click', () => {
    const innerRaw = ig?.inner_page_bg_prompt || ig?.slides?.[1]?.visual_prompt || 'clean minimalist textured background';
    copyText(toGeminiImagePrompt(innerRaw, { isContinuation: true, styleAnchor: ig?.style_anchor }), '已複製「② 內頁共用圖」生圖指令');
  });
  container.querySelector('#btn-copy-outro-prompt')?.addEventListener('click', () => {
    const lastSlide = ig?.slides?.[ig.slides.length - 1];
    const outroRaw = (lastSlide?.visual_prompt && !lastSlide.visual_prompt.includes('同上'))
      ? lastSlide.visual_prompt
      : '鏡頭稍微拉遠，呈現同一個房間角落的溫暖靜謐畫面，微光灑在木桌與亞麻單椅邊緣，上方與中央保留大片乾淨柔和的米色牆面留白';
    copyText(toGeminiImagePrompt(outroRaw, { isContinuation: true, styleAnchor: ig?.style_anchor }), '已複製「③ 封底圖」生圖指令');
  });
  container.querySelectorAll('.btn-copy-slide-text').forEach(b => b.addEventListener('click', () => {
    const idx = Number(b.dataset.i);
    const s = ig.slides[idx];
    copyText(`${s.title || ''}\n${s.subtitle || ''}`.trim(), `已複製 P.${s.slide_num} 文字`);
  }));
  container.querySelectorAll('.btn-copy-thread').forEach(b => b.addEventListener('click', () => copyText(threads[b.dataset.i].text, '已複製 Threads 貼文')));
  container.querySelector('#btn-copy-ig-caption')?.addEventListener('click', () => copyText(ig.caption, '已複製 Caption'));
  container.querySelector('#btn-copy-fb')?.addEventListener('click', () => copyText(fb.post_text, '已複製 Facebook 貼文'));
  container.querySelector('#btn-copy-blog')?.addEventListener('click', () => copyText(blog.markdown_content, '已複製 Blog Markdown'));

  bindMdArchiveEvents(container, detail?.exports || [], currentIdea, state, app);
}
