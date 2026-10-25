import { esc, renderMarkdown } from '../utils.js';

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

  container.innerHTML = `
    <div class="main-panel" style="max-width: 1200px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 12px;">
        <div>
          <h2>📱 社群多平台矩陣</h2>
          <div style="font-size: 13.5px; color: var(--text-muted); margin-top: 4px;">Instagram 輪播 · Facebook · Threads × 3 · Blog</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button id="btn-export-social-pkg" class="btn btn-export btn-sm" ${!outputs.length ? 'disabled' : ''} title="一鍵打包下載整合 Markdown">📦 匯出成果</button>
          <button id="btn-generate-multiplier" class="btn btn-accent" ${state.isProcessing ? 'disabled' : ''} style="white-space: nowrap;">
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
          <div class="info-card" style="margin-bottom: 16px; background: #FAF9F6; border-left: 4px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
              <div>
                <strong style="font-size: 13.5px; color: var(--primary);">🔗 讓前後圖片風格 100% 統一的用法（同一個 Gemini 對話框兩步法）</strong>
                <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
                  先點「① 複製封面圖指令」貼到 Gemini 生出第 1 張圖；接著<strong>在同一個 Gemini 對話框</strong>點「② 複製內頁延續指令」貼上，Gemini 就會沿用同一個房間、光線與色調拍出第 2 張內頁共用底圖！
                </p>
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button id="btn-copy-cover-prompt" class="btn btn-primary btn-sm" style="white-space: nowrap;">① 複製「封面圖」指令</button>
                <button id="btn-copy-inner-bg" class="btn btn-accent btn-sm" style="white-space: nowrap;">② 複製「內頁共用圖」延續指令</button>
              </div>
            </div>
          </div>
          <div class="carousel-deck">
            ${(ig.slides || []).map((s, i) => {
              const isCover = i === 0;
              const rawPrompt = (s.visual_prompt && !s.visual_prompt.includes('同上')) ? s.visual_prompt : (ig.inner_page_bg_prompt || s.visual_prompt);
              const displayPrompt = toGeminiImagePrompt(rawPrompt, { isContinuation: !isCover, styleAnchor: ig.style_anchor });
              return `
              <div class="carousel-slide-card">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span class="slide-num-badge">P.${esc(s.slide_num)}</span>
                    <span style="font-size: 11px; color: var(--text-muted);">${isCover ? '🌟 鏡位 1：視覺封面' : (i === (ig.slides.length - 1) ? '🎯 鏡位 3：封底收尾' : '📝 鏡位 2：文字內頁（共用底圖）')}</span>
                  </div>
                  <div class="slide-title">${esc(s.title)}</div>
                  <div class="slide-body">${esc(s.subtitle)}</div>
                </div>
                <div>
                  <div class="slide-prompt-box"><strong>🎨 Gemini 生圖指令 (4:5)：</strong><br>${esc(displayPrompt)}</div>
                  <button class="btn btn-outline btn-sm btn-block btn-copy-slide" data-i="${i}" style="margin-top: 6px;">📋 複製此頁生圖指令</button>
                </div>
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
        ` : ''}

        ${sub === 'fb' && fb ? `
          <div class="info-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <span style="font-weight: 700; color: var(--primary);">📘 Facebook 貼文</span>
              <button id="btn-copy-fb" class="btn btn-primary btn-sm">📋 複製</button>
            </div>
            <div class="article-view" style="font-family: var(--font-sans); font-size: 14.5px;">${esc(fb.post_text)}</div>
          </div>
        ` : ''}

        ${sub === 'threads' && Array.isArray(threads) ? `
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
            <div class="article-view markdown-body">${renderMarkdown(blog.markdown_content)}</div>
          </div>
        ` : ''}
      `}
    </div>
  `;

  container.querySelectorAll('.mode-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.ui.socialTab = btn.dataset.subtab;
      app.render();
    });
  });

  container.querySelector('#btn-export-social-pkg')?.addEventListener('click', () => app.exportIdeaPackage(currentIdea.id));
  container.querySelector('#btn-generate-multiplier')?.addEventListener('click', () => app.generateMultiplier(currentIdea.id));

  const copyText = (text, msg) => { navigator.clipboard.writeText(text || ''); app.showToast(msg); };
  container.querySelector('#btn-copy-cover-prompt')?.addEventListener('click', () => {
    const coverRaw = ig?.slides?.[0]?.visual_prompt || '';
    copyText(toGeminiImagePrompt(coverRaw, { isContinuation: false, styleAnchor: ig?.style_anchor }), '已複製「① 封面圖」生圖指令');
  });
  container.querySelector('#btn-copy-inner-bg')?.addEventListener('click', () => {
    const innerRaw = ig?.inner_page_bg_prompt || ig?.slides?.[1]?.visual_prompt || 'clean minimalist textured background';
    copyText(toGeminiImagePrompt(innerRaw, { isContinuation: true, styleAnchor: ig?.style_anchor }), '已複製「② 內頁共用圖（延續上一張風格）」指令');
  });
  container.querySelectorAll('.btn-copy-slide').forEach(b => b.addEventListener('click', () => {
    const idx = Number(b.dataset.i);
    const s = ig.slides[idx];
    const rawPrompt = (s.visual_prompt && !s.visual_prompt.includes('同上')) ? s.visual_prompt : (ig.inner_page_bg_prompt || s.visual_prompt);
    copyText(toGeminiImagePrompt(rawPrompt, { isContinuation: idx > 0, styleAnchor: ig?.style_anchor }), '已複製生圖指令');
  }));
  container.querySelectorAll('.btn-copy-thread').forEach(b => b.addEventListener('click', () => copyText(threads[b.dataset.i].text, '已複製 Threads 貼文')));
  container.querySelector('#btn-copy-ig-caption')?.addEventListener('click', () => copyText(ig.caption, '已複製 Caption'));
  container.querySelector('#btn-copy-fb')?.addEventListener('click', () => copyText(fb.post_text, '已複製 Facebook 貼文'));
  container.querySelector('#btn-copy-blog')?.addEventListener('click', () => copyText(blog.markdown_content, '已複製 Blog Markdown'));
}
