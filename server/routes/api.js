const express = require('express');
const router = express.Router();
const { getDb, saveDb, getSetting, setSetting } = require('../db');
const frameworksData = require('../knowledge/psychology_frameworks.json');
const brandConfig = require('../config/brand.json');
const { generateResearchPack } = require('../services/research_service');
const { generateMasterArticle, runClearReview, countVerifyMarkers } = require('../services/master_service');
const { generatePodcastPackage } = require('../services/podcast_service');
const { generateSocialMultiplier } = require('../services/multiplier_service');
const { fetchFormRows, isPublishedCsvUrl } = require('../services/inbox_sync');
const { extractLessons } = require('../services/learning_service');
const { buildExportMarkdown, exportFileName, validateExportDir, writeExport } = require('../services/export_service');
const { runJob, getJob } = require('../progress');

// ---------- helpers ----------

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function generateId(prefix = 'CL') {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${rand}`;
}

function getOne(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

function getAll(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function sendError(res, error) {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ success: false, error: error.message, code: error.code });
}

function getIdeaOr404(id) {
  const idea = getOne('SELECT * FROM ideas WHERE id = ?', [id]);
  if (!idea) throw new HttpError(404, '找不到此靈感記錄');
  idea.research_pack = parseJson(idea.research_pack);
  return idea;
}

function getMaster(ideaId) {
  const master = getOne('SELECT * FROM content_masters WHERE idea_id = ?', [ideaId]);
  if (master) {
    master.interview_answers = parseJson(master.interview_answers, {});
    master.clear_review = parseJson(master.clear_review);
  }
  return master;
}

function saveVersion(masterId, content, origin) {
  getDb().run('INSERT INTO master_versions (master_id, content, origin) VALUES (?, ?, ?)', [masterId, content, origin]);
}

/** One auto-captured library entry per (category, source); replaced on update, keeps is_active. */
function upsertLibrary(category, sourceId, title, content, tags) {
  const db = getDb();
  const existing = getOne('SELECT id FROM learning_library WHERE category = ? AND source_id = ?', [category, sourceId]);
  if (existing) {
    db.run('UPDATE learning_library SET title = ?, content = ?, tags = ? WHERE id = ?', [title, content, tags, existing.id]);
  } else {
    db.run(
      'INSERT INTO learning_library (id, category, title, content, tags, source_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [generateId('LIB'), category, title, content, tags, sourceId]
    );
  }
}

/**
 * Server-side approval gate: downstream generation is only allowed from an
 * APPROVED master article with no remaining [VERIFY] markers.
 */
function requireApprovedMaster(ideaId) {
  const idea = getIdeaOr404(ideaId);
  const master = getMaster(ideaId);
  if (!master || !master.master_article) {
    throw new HttpError(409, '母文章尚未生成', 'NO_MASTER');
  }
  if (!master.is_approved) {
    throw new HttpError(409, '母文章尚未核准（APPROVED），不能生成播客或社群內容', 'NOT_APPROVED');
  }
  const markers = countVerifyMarkers(master.master_article);
  if (markers > 0) {
    throw new HttpError(409, `母文章仍有 ${markers} 處 [VERIFY] 未處理`, 'VERIFY_REMAINING');
  }
  if (!idea.research_pack) {
    throw new HttpError(409, '缺少研究包', 'NO_RESEARCH');
  }
  return { idea, master };
}

// ---------- config & settings ----------

router.get('/frameworks', (req, res) => {
  res.json({ success: true, data: frameworksData.frameworks });
});

router.get('/brand-config', (req, res) => {
  res.json({ success: true, data: brandConfig });
});

router.get('/settings', (req, res) => {
  const key = getSetting('gemini_api_key');
  res.json({
    success: true,
    data: {
      has_gemini_key: !!(key || process.env.GEMINI_API_KEY),
      masked_key: key ? `${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}` : null,
      inbox_sheet_csv_url: getSetting('inbox_sheet_csv_url') || '',
      export_dir: getSetting('export_dir') || ''
    }
  });
});

router.post('/settings', (req, res) => {
  try {
    const { gemini_api_key, inbox_sheet_csv_url, export_dir } = req.body;
    if (gemini_api_key !== undefined) setSetting('gemini_api_key', gemini_api_key.trim());
    if (export_dir !== undefined) setSetting('export_dir', export_dir.trim());
    if (inbox_sheet_csv_url !== undefined) {
      const url = inbox_sheet_csv_url.trim();
      if (url && !isPublishedCsvUrl(url)) {
        throw new HttpError(400, '請貼上 Google 試算表「發布到網路 → CSV」的連結（網址含 output=csv）');
      }
      setSetting('inbox_sheet_csv_url', url);
    }
    res.json({ success: true, message: '設定已更新' });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- mobile inbox sync (Google Form → Sheet → CSV) ----------

router.post('/inbox/sync', async (req, res) => {
  try {
    const csvUrl = getSetting('inbox_sheet_csv_url');
    if (!csvUrl) return res.json({ success: true, data: { imported: 0, configured: false } });

    const rows = await fetchFormRows(csvUrl);
    const db = getDb();
    let imported = 0;
    rows.forEach(r => {
      if (getOne('SELECT row_key FROM inbox_imports WHERE row_key = ?', [r.row_key])) return;
      const id = generateId('ID');
      db.run(`
        INSERT INTO ideas (id, title, source_type, source_url, author, raw_notes, content_pillar, status)
        VALUES (?, ?, ?, ?, '', ?, ?, 'INBOX')
      `, [id, r.title, r.source_type, r.source_url, r.raw_notes, r.content_pillar]);
      db.run('INSERT INTO inbox_imports (row_key, idea_id) VALUES (?, ?)', [r.row_key, id]);
      imported++;
    });
    if (imported) saveDb();
    res.json({ success: true, data: { imported, configured: true } });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- trusted sources ----------

router.get('/trusted-sources', (req, res) => {
  try {
    res.json({ success: true, data: getAll('SELECT * FROM trusted_sources ORDER BY id ASC') });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/trusted-sources', (req, res) => {
  try {
    const { citation, note } = req.body;
    if (!citation || !citation.trim()) throw new HttpError(400, '請輸入文獻引用');
    getDb().run('INSERT INTO trusted_sources (citation, note) VALUES (?, ?)', [citation.trim(), (note || '').trim()]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/trusted-sources/:id', (req, res) => {
  try {
    getDb().run('DELETE FROM trusted_sources WHERE id = ?', [Number(req.params.id)]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- ideas ----------

router.get('/ideas', (req, res) => {
  try {
    // Subqueries instead of JOINs so each idea appears exactly once
    const list = getAll(`
      SELECT i.id, i.title, i.source_type, i.source_url, i.content_pillar, i.status, i.created_at, i.updated_at,
             (SELECT is_approved FROM content_masters WHERE idea_id = i.id LIMIT 1) AS is_approved,
             (SELECT id FROM content_masters WHERE idea_id = i.id LIMIT 1) AS master_id
      FROM ideas i
      ORDER BY i.created_at DESC
    `);
    res.json({ success: true, data: list });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/ideas', (req, res) => {
  try {
    const { title, source_type, source_url, author, raw_notes, content_pillar } = req.body;
    if (!title || !title.trim()) throw new HttpError(400, '主題標題為必填欄位');

    const id = generateId('ID');
    getDb().run(`
      INSERT INTO ideas (id, title, source_type, source_url, author, raw_notes, content_pillar, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'INBOX')
    `, [id, title.trim(), source_type || 'Observation', (source_url || '').trim(), author || '', raw_notes || '', content_pillar || 'clarity']);
    saveDb();
    res.json({ success: true, data: { id, title } });
  } catch (error) {
    sendError(res, error);
  }
});

function loadIdeaBundle(id) {
  const idea = getIdeaOr404(id);
  const master = getMaster(idea.id);

  let podcast = null;
  let outputs = [];

  if (master) {
    podcast = getOne('SELECT * FROM podcasts WHERE master_id = ? ORDER BY created_at DESC LIMIT 1', [master.id]);
    if (podcast) {
      ['titles', 'talking_points', 'show_notes', 'references_list'].forEach(k => {
        podcast[k] = parseJson(podcast[k], podcast[k]);
      });
      // Outputs generated before the latest master edit are stale
      podcast.is_stale = !!(master.updated_at && podcast.created_at < master.updated_at);
    }

    outputs = getAll('SELECT * FROM platform_outputs WHERE master_id = ?', [master.id]).map(o => ({
      ...o,
      content_payload: parseJson(o.content_payload, o.content_payload),
      is_stale: !!(master.updated_at && o.created_at < master.updated_at)
    }));

    master.verify_markers = countVerifyMarkers(master.master_article);
    master.version_count = getOne('SELECT COUNT(*) AS c FROM master_versions WHERE master_id = ?', [master.id])?.c || 0;
  }

  const performance = getAll('SELECT * FROM performance_logs WHERE idea_id = ? ORDER BY created_at DESC', [idea.id]);
  return { idea, master, podcast, outputs, performance, job: getJob(idea.id) };
}

router.get('/ideas/:id', (req, res) => {
  try {
    res.json({ success: true, data: loadIdeaBundle(req.params.id) });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/progress/:id', (req, res) => {
  res.json({ success: true, data: getJob(req.params.id) });
});

// ---------- research ----------

router.post('/research/:id', async (req, res) => {
  try {
    const idea = getIdeaOr404(req.params.id);
    const trusted = getAll('SELECT * FROM trusted_sources');

    const researchPack = await runJob(idea.id, '研究', async onProgress => {
      console.log(`[Research] 「${idea.title}」讀取來源、學理對齊、查證引用中...`);
      return generateResearchPack(idea, trusted, onProgress);
    });

    getDb().run(`
      UPDATE ideas SET research_pack = ?, status = 'RESEARCHED', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `, [JSON.stringify(researchPack), idea.id]);
    saveDb();
    res.json({ success: true, data: researchPack });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- interview ----------

router.post('/interview/:id', (req, res) => {
  try {
    const idea = getIdeaOr404(req.params.id);
    const { answers } = req.body;
    const db = getDb();
    const master = getMaster(idea.id);

    let masterId = master?.id;
    if (masterId) {
      db.run('UPDATE content_masters SET interview_answers = ? WHERE id = ?', [JSON.stringify(answers || {}), masterId]);
    } else {
      masterId = generateId('CM');
      db.run('INSERT INTO content_masters (id, idea_id, interview_answers) VALUES (?, ?, ?)', [masterId, idea.id, JSON.stringify(answers || {})]);
    }
    if (['INBOX', 'RESEARCHED'].includes(idea.status)) {
      db.run("UPDATE ideas SET status = 'INTERVIEWED' WHERE id = ?", [idea.id]);
    }

    // Betty's own example → story bank (one per topic, replaced when she edits it)
    const story = (answers?.q2_experience || '').trim();
    if (story) {
      upsertLibrary('story', idea.id, idea.title, story, 'interview');
    }
    saveDb();
    res.json({ success: true, data: { master_id: masterId } });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- master article ----------

router.post('/master/:id', async (req, res) => {
  try {
    const idea = getIdeaOr404(req.params.id);
    if (!idea.research_pack) throw new HttpError(400, '請先生成 Research Pack');
    const db = getDb();
    const master = getMaster(idea.id);
    const interviewAnswers = master?.interview_answers || {};

    const { masterArticle, clearReview } = await runJob(idea.id, '撰寫母文章', async onProgress => {
      onProgress(1, 2, '撰寫母文章（12 步架構）');
      const article = await generateMasterArticle(idea, idea.research_pack, interviewAnswers);
      onProgress(2, 2, 'CLEAR 品質與倫理審查');
      const review = await runClearReview(article);
      return { masterArticle: article, clearReview: review };
    });

    let masterId = master?.id;
    if (masterId) {
      db.run(`
        UPDATE content_masters
        SET master_article = ?, clear_review = ?, is_approved = 0, approved_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [masterArticle, JSON.stringify(clearReview), masterId]);
    } else {
      masterId = generateId('CM');
      db.run(`
        INSERT INTO content_masters (id, idea_id, interview_answers, master_article, clear_review, is_approved)
        VALUES (?, ?, ?, ?, ?, 0)
      `, [masterId, idea.id, JSON.stringify(interviewAnswers), masterArticle, JSON.stringify(clearReview)]);
    }
    saveVersion(masterId, masterArticle, 'ai');
    db.run("UPDATE ideas SET status = 'MASTER_DRAFTED' WHERE id = ?", [idea.id]);
    saveDb();

    res.json({ success: true, data: { master_id: masterId, master_article: masterArticle, clear_review: clearReview } });
  } catch (error) {
    sendError(res, error);
  }
});

// Betty edits the master article — the edited text becomes the source of truth
router.put('/master/:id', (req, res) => {
  try {
    const idea = getIdeaOr404(req.params.id);
    const master = getMaster(idea.id);
    if (!master) throw new HttpError(404, '母文章不存在');

    const { master_article } = req.body;
    if (!master_article || !master_article.trim()) throw new HttpError(400, '母文章內容不可為空');
    if (master_article === master.master_article) {
      return res.json({ success: true, data: { unchanged: true } });
    }

    const review = master.clear_review ? { ...master.clear_review, stale: true } : null;
    const db = getDb();
    db.run(`
      UPDATE content_masters
      SET master_article = ?, clear_review = ?, is_approved = 0, approved_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [master_article, review ? JSON.stringify(review) : null, master.id]);
    saveVersion(master.id, master_article, 'edit');
    db.run("UPDATE ideas SET status = 'MASTER_DRAFTED' WHERE id = ?", [idea.id]);
    saveDb();

    res.json({ success: true, data: { verify_markers: countVerifyMarkers(master_article) } });
  } catch (error) {
    sendError(res, error);
  }
});

// Re-run CLEAR on the current (possibly edited) text
router.post('/master/:id/review', async (req, res) => {
  try {
    const idea = getIdeaOr404(req.params.id);
    const master = getMaster(idea.id);
    if (!master?.master_article) throw new HttpError(404, '母文章不存在');

    const review = await runClearReview(master.master_article);
    getDb().run('UPDATE content_masters SET clear_review = ? WHERE id = ?', [JSON.stringify(review), master.id]);
    saveDb();
    res.json({ success: true, data: review });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/master/:id/versions', (req, res) => {
  try {
    const master = getMaster(req.params.id);
    if (!master) return res.json({ success: true, data: [] });
    const versions = getAll(
      'SELECT id, origin, created_at, content FROM master_versions WHERE master_id = ? ORDER BY id DESC LIMIT 30',
      [master.id]
    );
    res.json({ success: true, data: versions });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/master/:id/approve', (req, res) => {
  try {
    const idea = getIdeaOr404(req.params.id);
    const master = getMaster(idea.id);
    if (!master?.master_article) throw new HttpError(404, '母文章不存在');
    const { is_approved } = req.body;
    const db = getDb();
    let voiceCaptured = false;

    if (is_approved) {
      const markers = countVerifyMarkers(master.master_article);
      if (markers > 0) {
        db.run("UPDATE ideas SET status = 'NEEDS_ATTENTION' WHERE id = ?", [idea.id]);
        saveDb();
        throw new HttpError(409, `仍有 ${markers} 處 [VERIFY] 未處理，請編輯母文章補上或刪除後再核准`, 'VERIFY_REMAINING');
      }
      db.run(`
        UPDATE content_masters SET is_approved = 1, approved_at = CURRENT_TIMESTAMP WHERE id = ?
      `, [master.id]);
      db.run("UPDATE ideas SET status = 'APPROVED' WHERE id = ?", [idea.id]);

      // If Betty edited the article herself, the approved text is a sample of her real voice
      const edited = getOne("SELECT id FROM master_versions WHERE master_id = ? AND origin = 'edit' LIMIT 1", [master.id]);
      if (edited) {
        upsertLibrary('voice', master.id, idea.title, master.master_article, 'approved-edit');
        voiceCaptured = true;
      }
    } else {
      db.run('UPDATE content_masters SET is_approved = 0, approved_at = NULL WHERE id = ?', [master.id]);
      db.run("UPDATE ideas SET status = 'MASTER_DRAFTED' WHERE id = ?", [idea.id]);
    }
    saveDb();
    res.json({ success: true, is_approved: !!is_approved, voice_captured: voiceCaptured });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- podcast ----------

router.post('/podcast/:id', async (req, res) => {
  try {
    const { idea, master } = requireApprovedMaster(req.params.id);

    const pkg = await runJob(idea.id, '製作播客', onProgress =>
      generatePodcastPackage(idea, idea.research_pack, master.master_article, onProgress)
    );

    const db = getDb();
    // One podcast package per master — replace the previous one
    db.run('DELETE FROM podcasts WHERE master_id = ?', [master.id]);
    db.run(`
      INSERT INTO podcasts (id, master_id, titles, hook, talking_points, full_script, show_notes, references_list, notebooklm_markdown, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY')
    `, [
      generateId('POD'),
      master.id,
      JSON.stringify(pkg.titles || {}),
      pkg.opening_hook || '',
      JSON.stringify(pkg.talking_points || []),
      pkg.full_script || '',
      JSON.stringify(pkg.show_notes || {}),
      JSON.stringify(pkg.show_notes?.psychology_references || []),
      pkg.notebooklm_export || ''
    ]);
    saveDb();
    res.json({ success: true, data: pkg });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- social multiplier ----------

router.post('/multiplier/:id', async (req, res) => {
  try {
    const { idea, master } = requireApprovedMaster(req.params.id);

    const pkg = await runJob(idea.id, '生成社群內容', onProgress =>
      generateSocialMultiplier(idea, idea.research_pack, master.master_article, onProgress)
    );

    const db = getDb();
    db.run('DELETE FROM platform_outputs WHERE master_id = ?', [master.id]);

    const insert = (platform, variant, payload, copy) => db.run(`
      INSERT INTO platform_outputs (id, master_id, platform, variant_type, content_payload, copy_text)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [generateId('OUT'), master.id, platform, variant, JSON.stringify(payload), copy]);

    if (pkg.instagram) insert('instagram', 'carousel', pkg.instagram, pkg.instagram.caption || '');
    if (pkg.facebook) insert('facebook', 'post', { post_text: pkg.facebook.post_text }, pkg.facebook.post_text || '');
    if (pkg.threads.length) insert('threads', 'trio', pkg.threads, pkg.threads.map(t => `${t.label}\n${t.text}`).join('\n\n---\n\n'));
    if (pkg.blog_article) insert('blog', 'article', pkg.blog_article, pkg.blog_article.markdown_content || '');

    db.run("UPDATE ideas SET status = 'MULTIPLIED' WHERE id = ?", [idea.id]);
    saveDb();
    res.json({ success: true, data: pkg });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- learning library ----------

const LIBRARY_CATEGORIES = ['rule', 'voice', 'story', 'lesson'];

router.get('/library', (req, res) => {
  try {
    res.json({ success: true, data: getAll('SELECT * FROM learning_library ORDER BY created_at DESC') });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/library', (req, res) => {
  try {
    const { category, title, content } = req.body;
    if (!LIBRARY_CATEGORIES.includes(category)) throw new HttpError(400, '分類不正確');
    if (!content || !content.trim()) throw new HttpError(400, '內容不可為空');
    const id = generateId('LIB');
    getDb().run(`
      INSERT INTO learning_library (id, category, title, content, tags, source_id, is_active) VALUES (?, ?, ?, ?, 'manual', '', 1)
    `, [id, category, (title || '').trim(), content.trim()]);
    saveDb();
    res.json({ success: true, data: { id } });
  } catch (error) {
    sendError(res, error);
  }
});

router.put('/library/:id', (req, res) => {
  try {
    const item = getOne('SELECT * FROM learning_library WHERE id = ?', [req.params.id]);
    if (!item) throw new HttpError(404, '找不到此項目');
    const { title, content, is_active } = req.body;
    if (content !== undefined && !content.trim()) throw new HttpError(400, '內容不可為空');
    getDb().run('UPDATE learning_library SET title = ?, content = ?, is_active = ? WHERE id = ?', [
      title !== undefined ? title.trim() : item.title,
      content !== undefined ? content.trim() : item.content,
      is_active !== undefined ? (is_active ? 1 : 0) : item.is_active,
      item.id
    ]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/library/:id', (req, res) => {
  try {
    getDb().run('DELETE FROM learning_library WHERE id = ?', [req.params.id]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- performance logs (feedback loop) ----------

const PLATFORMS = ['instagram', 'facebook', 'threads', 'blog', 'podcast'];
const toCount = v => Math.max(0, parseInt(v, 10) || 0);

router.get('/performance', (req, res) => {
  try {
    res.json({
      success: true,
      data: getAll(`
        SELECT p.*, i.title, i.content_pillar
        FROM performance_logs p JOIN ideas i ON i.id = p.idea_id
        ORDER BY p.created_at DESC
      `)
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/performance/:id', (req, res) => {
  try {
    const idea = getIdeaOr404(req.params.id);
    const { platform, published_url, reach, saves, shares, comments, notes } = req.body;
    if (!PLATFORMS.includes(platform)) throw new HttpError(400, '平台不正確');
    getDb().run(`
      INSERT INTO performance_logs (idea_id, platform, published_url, reach, saves, shares, comments, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [idea.id, platform, (published_url || '').trim(), toCount(reach), toCount(saves), toCount(shares), toCount(comments), (notes || '').trim()]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/performance/log/:logId', (req, res) => {
  try {
    getDb().run('DELETE FROM performance_logs WHERE id = ?', [Number(req.params.logId)]);
    saveDb();
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/library/extract-lessons', async (req, res) => {
  try {
    const logs = getAll(`
      SELECT p.*, i.title, i.content_pillar
      FROM performance_logs p JOIN ideas i ON i.id = p.idea_id
      ORDER BY p.created_at DESC LIMIT 40
    `).map(l => {
      // Attach the opening of what was actually posted, so the model can relate style to results
      let excerpt = '';
      if (l.platform === 'podcast') {
        excerpt = getOne(`SELECT pod.hook AS t FROM podcasts pod JOIN content_masters m ON m.id = pod.master_id WHERE m.idea_id = ? LIMIT 1`, [l.idea_id])?.t || '';
      } else {
        excerpt = getOne(`SELECT o.copy_text AS t FROM platform_outputs o JOIN content_masters m ON m.id = o.master_id WHERE m.idea_id = ? AND o.platform = ? LIMIT 1`, [l.idea_id, l.platform])?.t || '';
      }
      return { ...l, excerpt };
    });

    const existing = getAll("SELECT content FROM learning_library WHERE category = 'lesson'").map(r => r.content);
    const lessons = await extractLessons(logs, existing);

    lessons.forEach(l => {
      getDb().run(
        "INSERT INTO learning_library (id, category, title, content, tags, source_id, is_active) VALUES (?, 'lesson', ?, ?, 'auto', '', 1)",
        [generateId('LIB'), (l.title || '').slice(0, 40), l.content]
      );
    });
    if (lessons.length) saveDb();
    res.json({ success: true, data: { added: lessons.length, lessons } });
  } catch (error) {
    sendError(res, error);
  }
});

// ---------- export ----------

router.post('/export/:id', (req, res) => {
  try {
    const bundle = loadIdeaBundle(req.params.id);
    if (!bundle.master?.master_article) throw new HttpError(409, '尚未生成母文章，沒有內容可匯出');
    const markdown = buildExportMarkdown(bundle);
    const fileName = exportFileName(bundle.idea);
    const dir = getSetting('export_dir');
    const savedPath = dir ? writeExport(dir, fileName, markdown) : null;
    res.json({ success: true, data: { file_name: fileName, saved_path: savedPath, markdown } });
  } catch (error) {
    sendError(res, error);
  }
});

module.exports = router;
