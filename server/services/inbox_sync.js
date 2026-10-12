/**
 * Mobile inbox sync — pulls new rows from a Google Form's response Sheet
 * (published to the web as CSV) and turns them into ideas.
 *
 * Pull model on purpose: capture works even when this PC is off, and no
 * write endpoint has to be exposed to the internet.
 */

const PILLAR_KEYS = ['clarity', 'confidence', 'hsp', 'boundaries', 'growth'];

/** RFC 4180-ish CSV parser (quoted fields, escaped quotes, newlines in fields). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some(v => v !== '')) rows.push(row);
  return rows;
}

/** Find a column by any of the given keywords (case-insensitive substring). */
function findColumn(headers, keywords) {
  const lower = headers.map(h => h.toLowerCase());
  return lower.findIndex(h => keywords.some(k => h.includes(k)));
}

function toPillar(value) {
  const v = (value || '').toLowerCase();
  if (v.includes('高敏') || v.includes('hsp')) return 'hsp';
  if (v.includes('自信') || v.includes('confidence')) return 'confidence';
  if (v.includes('邊界') || v.includes('boundar')) return 'boundaries';
  if (v.includes('正向') || v.includes('growth') || v.includes('positive')) return 'growth';
  return PILLAR_KEYS.find(k => v.includes(k)) || 'clarity';
}

function isPublishedCsvUrl(url) {
  return /^https:\/\/docs\.google\.com\/spreadsheets\/.+(output=csv|format=csv)/i.test(url || '');
}

async function fetchFormRows(csvUrl) {
  if (!isPublishedCsvUrl(csvUrl)) {
    throw new Error('網址需為 Google 試算表「發布到網路」的 CSV 連結（含 output=csv）');
  }
  const res = await fetch(csvUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`讀取試算表失敗（HTTP ${res.status}）`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const col = {
    timestamp: findColumn(headers, ['時間戳記', 'timestamp', '時間']),
    title: findColumn(headers, ['標題', '主題', 'title']),
    url: findColumn(headers, ['網址', '連結', 'url', 'link']),
    notes: findColumn(headers, ['筆記', '想法', 'notes']),
    pillar: findColumn(headers, ['支柱', 'pillar'])
  };
  if (col.title < 0) throw new Error('試算表找不到「標題」欄位，請確認表單題目名稱包含「標題」');

  return rows.slice(1).map(r => {
    const get = i => (i >= 0 ? (r[i] || '').trim() : '');
    const url = get(col.url);
    return {
      row_key: `${get(col.timestamp)}|${get(col.title)}`,
      title: get(col.title),
      source_url: url,
      source_type: /youtu\.?be/i.test(url) ? 'YouTube' : (url ? 'Article' : 'Observation'),
      raw_notes: get(col.notes),
      content_pillar: toPillar(get(col.pillar))
    };
  }).filter(r => r.title);
}

module.exports = { fetchFormRows, parseCsv, isPublishedCsvUrl };
