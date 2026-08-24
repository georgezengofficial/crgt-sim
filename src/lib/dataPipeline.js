import * as XLSX from 'xlsx';

export const CANONICAL_FIELDS = [
  {
    key: 'ratId',
    label: 'Rat / Subject ID',
    required: true,
    keywords: ['ratid', 'rat', 'subjectid', 'subject', 'animalid', 'animal', 'id']
  },
  {
    key: 'cohort',
    label: 'Cohort / Group',
    required: false,
    keywords: ['cohort', 'group', 'condition', 'treatment']
  },
  {
    key: 'sex',
    label: 'Sex',
    required: false,
    keywords: ['sex', 'gender']
  },
  {
    key: 'session',
    label: 'Session #',
    required: false,
    keywords: ['session', 'day', 'sessionnum', 'sessionnumber']
  },
  {
    key: 'trial',
    label: 'Trial #',
    required: true,
    keywords: ['trial', 'trialnum', 'trialnumber', 'trialindex']
  },
  {
    key: 'choice',
    label: 'Choice / Option',
    required: true,
    keywords: ['choice', 'option', 'hole', 'response', 'selection', 'lever', 'choiceoption']
  },
  {
    key: 'outcome',
    label: 'Outcome (win/loss)',
    required: true,
    keywords: ['outcome', 'result', 'winloss', 'win', 'reward', 'rewarded']
  },
  {
    key: 'premature',
    label: 'Premature Response',
    required: false,
    keywords: ['premature', 'impulsive', 'prematureresponse', 'earlyresponse']
  }
];

export function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function guessColumnMapping(headers) {
  const mapping = {};
  const usedHeaders = new Set();

  for (const field of CANONICAL_FIELDS) {
    let bestHeader = null;
    let bestScore = 0;

    for (const h of headers) {
      if (usedHeaders.has(h)) continue;
      const norm = normalizeHeader(h);

      for (const kw of field.keywords) {
        let score = 0;
        if (norm === kw) score = 100;
        else if (norm.includes(kw)) score = 60 + kw.length;
        else if (kw.includes(norm) && norm.length >= 2) score = 40;

        if (score > bestScore) {
          bestScore = score;
          bestHeader = h;
        }
      }
    }

    if (bestHeader && bestScore >= 40) {
      mapping[field.key] = bestHeader;
      usedHeaders.add(bestHeader);
    }
  }

  return mapping;
}

export function normalizeChoice(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();

  let m = s.match(/^p?\s*([1-4])$/);
  if (m) return parseInt(m[1], 10) - 1;

  m = s.match(/^([a-d])$/);
  if (m) return m[1].charCodeAt(0) - 'a'.charCodeAt(0);

  m = s.match(/^([0-3])$/);
  if (m) return parseInt(m[1], 10);

  return null;
}

export function normalizeOutcome(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();

  if (['win', 'won', 'reward', 'rewarded', '1', 'true', 'yes'].includes(s)) return 'win';
  if (['loss', 'lose', 'lost', 'timeout', 'punish', 'punished', '0', 'false', 'no'].includes(s)) return 'loss';

  const num = parseFloat(s);
  if (!isNaN(num)) return num > 0 ? 'win' : 'loss';

  return null;
}

export function normalizePremature(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  const s = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(s)) return 1;
  return 0;
}

export function parseCSVText(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return { headers: [], data: [] };

  const headers = rows[0].map(h => h.trim());
  const data = rows
    .slice(1)
    .filter(r => r.some(v => v !== ''))
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = r[i] !== undefined ? r[i].trim() : '';
      });
      return obj;
    });

  return { headers, data };
}

export function parseUploadedFile(file) {
  return new Promise((resolve, reject) => {
    const name = file.name.toLowerCase();
    const reader = new FileReader();

    if (name.endsWith('.csv') || name.endsWith('.txt')) {
      reader.onload = e => {
        try {
          resolve(parseCSVText(e.target.result));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    } else {
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
          const headers = json.length > 0 ? Object.keys(json[0]) : [];
          const data = json.map(row => {
            const obj = {};
            headers.forEach(h => {
              obj[h] = String(row[h]).trim();
            });
            return obj;
          });
          resolve({ headers, data });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    }
  });
}

export function applyMapping(rawHeaders, rawData, mapping) {
  const dropped = { noRatId: 0, noTrial: 0, badChoice: 0, badOutcome: 0 };
  const records = [];

  for (const row of rawData) {
    const ratId = mapping.ratId ? row[mapping.ratId] : null;
    const trialRaw = mapping.trial ? row[mapping.trial] : null;
    const choiceRaw = mapping.choice ? row[mapping.choice] : null;
    const outcomeRaw = mapping.outcome ? row[mapping.outcome] : null;

    if (!ratId) {
      dropped.noRatId++;
      continue;
    }
    if (trialRaw === null || trialRaw === '') {
      dropped.noTrial++;
      continue;
    }

    const choice = normalizeChoice(choiceRaw);
    if (choice === null) {
      dropped.badChoice++;
      continue;
    }

    const outcome = normalizeOutcome(outcomeRaw);
    if (outcome === null) {
      dropped.badOutcome++;
      continue;
    }

    records.push({
      ratId: String(ratId),
      cohort: mapping.cohort ? row[mapping.cohort] : 'unspecified',
      sex: mapping.sex ? row[mapping.sex] : 'unspecified',
      session: mapping.session ? parseFloat(row[mapping.session]) || 0 : 0,
      trial: parseFloat(trialRaw) || 0,
      choice,
      outcome,
      premature: mapping.premature ? normalizePremature(row[mapping.premature]) : null
    });
  }

  records.sort(
    (a, b) => a.ratId.localeCompare(b.ratId) || a.session - b.session || a.trial - b.trial
  );

  const byRat = {};
  for (const r of records) {
    if (!byRat[r.ratId]) byRat[r.ratId] = [];
    byRat[r.ratId].push(r);
  }

  return { byRat, dropped, totalParsed: records.length, totalRaw: rawData.length };
}