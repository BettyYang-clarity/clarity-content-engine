const fs = require('fs');
const path = require('path');

const DEFAULT_EXPORT_DIR = path.join(__dirname, '..', 'data', 'exports');
if (!fs.existsSync(DEFAULT_EXPORT_DIR)) {
  fs.mkdirSync(DEFAULT_EXPORT_DIR, { recursive: true });
}

/** Windows-safe file name. */
function safeName(s) {
  return (s || 'untitled').replace(/[\\/:*?"<>|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function list(items) {
  return (items || []).filter(Boolean).map(i => `- ${i}`).join('\n');
}

/**
 * Build one Markdown document with everything produced for an idea.
 */
function buildExportMarkdown({ idea, master, podcast, outputs = [] }) {
  const out = [];
  const grounding = idea.research_pack?.psychology_grounding || {};
  const find = p => outputs.find(o => o.platform === p)?.content_payload;

  out.push(`# ${idea.title}`, '');
  out.push(`- 狀態：${idea.status}${master?.is_approved ? '（已核准）' : ''}`);
  if (idea.source_type) out.push(`- 來源類型：${idea.source_type}`);
  if (idea.source_url) out.push(`- 來源連結：${idea.source_url}`);
  if (idea.author) out.push(`- 作者/來源：${idea.author}`);
  out.push(`- 匯出時間：${new Date().toLocaleString('zh-TW')}`, '');

  if (idea.raw_notes) {
    out.push('## 原始靈感筆記', '', idea.raw_notes, '');
  }

  if (idea.research_pack) {
    out.push('---', '', '## 研究摘要', '', `**核心洞見：**${idea.research_pack.central_insight || ''}`, '');
    if (idea.research_pack.source_summary) {
      out.push(`**來源摘要：**${idea.research_pack.source_summary}`, '');
    }
    const cites = (grounding.citations || []).map(c => `${c.citation}（${c.status}）`);
    if (cites.length) out.push('**文獻：**', list(cites), '');
  }

  if (master?.interview_answers?.free_notes) {
    out.push('---', '', '## 洞見草稿與個人筆記', '', master.interview_answers.free_notes, '');
  }

  if (master?.master_article) {
    out.push('---', '', '## 母文章', '', master.master_article, '');
  }

  if (podcast) {
    const sn = podcast.show_notes || {};
    out.push('---', '', '## Podcast', '');
    out.push('**標題候選：**', list([podcast.titles?.catchy_title, podcast.titles?.reflective_title, podcast.titles?.academic_title]), '');
    if (podcast.hook) out.push(`**開場 Hook：**${podcast.hook}`, '');
    if (podcast.full_script) out.push('### 逐字講稿', '', podcast.full_script, '');
    out.push('### Show Notes', '', sn.summary || '', '', list(sn.timestamps), '');
    const refs = sn.references || sn.psychology_references || [];
    if (refs.length) out.push('**參考資料：**', list(refs), '');
    if (sn.reflection_question_for_listener) out.push(`**延伸思考：**${sn.reflection_question_for_listener}`, '');
    if (podcast.notebooklm_markdown) out.push('### NotebookLM 筆記', '', podcast.notebooklm_markdown, '');
  }

  const ig = find('instagram');
  const fb = find('facebook');
  const threads = find('threads');
  const blog = find('blog');
  if (ig || fb || threads || blog) out.push('---', '', '## 社群內容', '');
  if (ig) {
    out.push('### Instagram 輪播', '');
    (ig.slides || []).forEach(s => out.push(`**P${s.slide_num}｜${s.title}**  `, `${s.subtitle || ''}  `, ''));
    out.push('**Caption：**', '', ig.caption || '', '');
  }
  if (fb) out.push('### Facebook', '', fb.post_text || '', '');
  if (Array.isArray(threads)) {
    out.push('### Threads', '');
    threads.forEach(t => out.push(`**${t.label}**`, '', t.text || '', ''));
  }
  if (blog) out.push('### Blog', '', `**${blog.seo_title || ''}**`, '', `> ${blog.meta_description || ''}`, '', blog.markdown_content || '', '');

  return out.join('\n');
}

function exportFileName(idea, suffix = '') {
  const sfx = suffix ? `_${safeName(suffix)}` : '';
  return `${new Date().toISOString().slice(0, 10)}_${safeName(idea.title)}${sfx}.md`;
}

/** Validate an export folder; returns normalised absolute path. */
function validateExportDir(dir) {
  const abs = path.resolve(dir);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
    const err = new Error(`找不到資料夾：${abs}`);
    err.status = 400;
    throw err;
  }
  return abs;
}

function writeExport(dir, fileName, markdown) {
  // Always save to built-in exports archive folder
  const defaultTarget = path.join(DEFAULT_EXPORT_DIR, fileName);
  fs.writeFileSync(defaultTarget, markdown, 'utf8');

  if (dir && dir.trim()) {
    const customTarget = path.join(validateExportDir(dir), fileName);
    fs.writeFileSync(customTarget, markdown, 'utf8');
    return customTarget;
  }
  return defaultTarget;
}

module.exports = { buildExportMarkdown, exportFileName, validateExportDir, writeExport, DEFAULT_EXPORT_DIR };
