const APP_SYNC_SHEET = 'APP-SYNC';
const APP_ANALYTICS_SHEET = 'APP-ANALYTICS';

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = String(params.callback || 'callback').replace(/[^a-zA-Z0-9_.$]/g, '');
  const payload = handleSnapshot_(params);
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  const payload = String(params.action || '') === 'analytics'
    ? handleAnalytics_(params)
    : handleMutation_(params);
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupBackend(spreadsheetId, accessCode) {
  PropertiesService.getScriptProperties().setProperties({
    SPREADSHEET_ID: String(spreadsheetId),
    ACCESS_CODE: String(accessCode)
  }, false);
  ensureSyncSheet_();
  ensureAnalyticsSheet_();
}

function handleSnapshot_(params) {
  try {
    assertAccess_(params.key);
    const sheet = ensureSyncSheet_();
    const lastRow = sheet.getLastRow();
    const tracking = {};
    if (lastRow >= 2) {
      const rows = sheet.getRange(2, 1, lastRow - 1, 9).getValues();
      rows.forEach(row => {
        const [id, circuit, name, address, status, capacity, updatedAt, mutationId] = row;
        if (!id) return;
        tracking[id] = {
          circuit,
          name,
          address,
          status: status || 'todo',
          capacity: capacity ? Number(capacity) : null,
          updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
          mutationId: mutationId || ''
        };
      });
    }
    return { ok: true, tracking, serverTime: new Date().toISOString() };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  }
}

function handleMutation_(params) {
  const lock = LockService.getScriptLock();
  try {
    assertAccess_(params.key);
    lock.waitLock(10000);
    const circuit = String(params.circuit || '').trim().toUpperCase();
    const name = String(params.name || '').trim();
    const address = String(params.address || '').trim();
    const status = String(params.status || '').trim();
    const mutationId = String(params.mutationId || '').trim();
    const capacityRaw = String(params.capacity || '').trim();
    const capacity = capacityRaw ? Number(capacityRaw) : null;
    if (!/^[A-M]$/.test(circuit) || !name || !address) throw new Error('Point invalide.');
    if (!['todo', 'done', 'vandalized', 'covered'].includes(status)) throw new Error('État invalide.');
    if (capacity !== null && ![1,2,3,4].includes(capacity)) throw new Error('Capacité invalide.');

    const syncSheet = ensureSyncSheet_();
    const id = circuit + '|' + name;
    const row = findSyncRow_(syncSheet, id);
    const now = new Date();
    const values = [[id, circuit, name, address, status, capacity || '', now, mutationId, Session.getActiveUser().getEmail() || '']];
    if (row) syncSheet.getRange(row, 1, 1, 9).setValues(values);
    else syncSheet.appendRow(values[0]);

    applyToOperationalSheets_(circuit, address, status, capacity);
    SpreadsheetApp.flush();
    return { ok: true, id, mutationId, updatedAt: now.toISOString() };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handleAnalytics_(params) {
  const lock = LockService.getScriptLock();
  try {
    const event = cleanAnalyticsValue_(params.event, 32).toLowerCase();
    const allowed = ['open', 'view', 'route', 'share', 'affiches'];
    if (!allowed.includes(event)) throw new Error('Événement invalide.');

    const visitorId = cleanAnalyticsId_(params.visitorId);
    const sessionId = cleanAnalyticsId_(params.sessionId);
    if (!visitorId || !sessionId) throw new Error('Identifiant analytique manquant.');

    const view = cleanAnalyticsValue_(params.view, 16).toUpperCase();
    const mode = cleanAnalyticsValue_(params.mode, 16).toLowerCase();
    const path = cleanAnalyticsValue_(params.path, 160);

    lock.waitLock(10000);
    const sheet = ensureAnalyticsSheet_();
    const row = findAnalyticsRow_(sheet, visitorId);
    const now = new Date();

    if (!row) {
      const circuits = event === 'view' && /^[A-M]$/.test(view) ? view : '';
      sheet.appendRow([
        visitorId,
        now,
        now,
        1,
        event === 'open' ? 1 : 0,
        circuits,
        circuits ? 1 : 0,
        event === 'route' ? 1 : 0,
        event === 'share' ? 1 : 0,
        event === 'affiches' ? 1 : 0,
        mode,
        path,
        sessionId
      ]);
    } else {
      const values = sheet.getRange(row, 1, 1, 13).getValues()[0];
      const sessions = splitList_(values[12]);
      const circuits = splitList_(values[5]);

      if (!sessions.includes(sessionId)) sessions.push(sessionId);
      if (event === 'view' && /^[A-M]$/.test(view) && !circuits.includes(view)) circuits.push(view);

      sheet.getRange(row, 1, 1, 13).setValues([[
        visitorId,
        values[1] || now,
        now,
        sessions.length,
        Number(values[4] || 0) + (event === 'open' ? 1 : 0),
        circuits.join(', '),
        circuits.length,
        Number(values[7] || 0) + (event === 'route' ? 1 : 0),
        Number(values[8] || 0) + (event === 'share' ? 1 : 0),
        Number(values[9] || 0) + (event === 'affiches' ? 1 : 0),
        mode || values[10] || '',
        path || values[11] || '',
        sessions.join(',')
      ]]);
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error && error.message ? error.message : error) };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function ensureAnalyticsSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(APP_ANALYTICS_SHEET);
  if (!sheet) sheet = ss.insertSheet(APP_ANALYTICS_SHEET);

  const currentHeader = String(sheet.getRange('A1').getValue() || '').trim();
  if (currentHeader === 'date_heure') migrateLegacyAnalytics_(sheet);

  if (String(sheet.getRange('A1').getValue() || '').trim() !== 'visiteur_anonyme') {
    writeAnalyticsHeaders_(sheet);
  }

  return sheet;
}

function writeAnalyticsHeaders_(sheet) {
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 13).setValues([[
    'visiteur_anonyme',
    'premiere_visite',
    'derniere_activite',
    'sessions',
    'ouvertures',
    'circuits_consultes',
    'nb_circuits',
    'itineraires',
    'partages',
    'affiches',
    'mode',
    'dernier_chemin',
    'sessions_ids'
  ]]);
  sheet.setFrozenRows(1);
  sheet.getRange('B:C').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sheet.autoResizeColumns(1, 12);
  sheet.hideColumns(13);
}

function migrateLegacyAnalytics_(sheet) {
  const lastRow = sheet.getLastRow();
  const rows = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 8).getValues() : [];
  const byVisitor = {};

  rows.forEach(r => {
    const date = r[0] instanceof Date ? r[0] : new Date(r[0]);
    const event = String(r[1] || '').trim().toLowerCase();
    const visitorId = String(r[2] || '').trim();
    const sessionId = String(r[3] || '').trim();
    const view = String(r[4] || '').trim().toUpperCase();
    const mode = String(r[6] || '').trim();
    const path = String(r[7] || '').trim();
    if (!visitorId) return;

    if (!byVisitor[visitorId]) {
      byVisitor[visitorId] = {
        first: date,
        last: date,
        sessions: [],
        opens: 0,
        circuits: [],
        routes: 0,
        shares: 0,
        affiches: 0,
        mode: mode,
        path: path
      };
    }

    const a = byVisitor[visitorId];
    if (date < a.first) a.first = date;
    if (date > a.last) a.last = date;
    if (sessionId && !a.sessions.includes(sessionId)) a.sessions.push(sessionId);
    if (event === 'open') a.opens++;
    if (event === 'view' && /^[A-M]$/.test(view) && !a.circuits.includes(view)) a.circuits.push(view);
    if (event === 'route') a.routes++;
    if (event === 'share') a.shares++;
    if (event === 'affiches') a.affiches++;
    if (mode) a.mode = mode;
    if (path) a.path = path;
  });

  writeAnalyticsHeaders_(sheet);
  const output = Object.keys(byVisitor).map(visitorId => {
    const a = byVisitor[visitorId];
    return [
      visitorId,
      a.first,
      a.last,
      a.sessions.length,
      a.opens,
      a.circuits.join(', '),
      a.circuits.length,
      a.routes,
      a.shares,
      a.affiches,
      a.mode,
      a.path,
      a.sessions.join(',')
    ];
  });
  if (output.length) sheet.getRange(2, 1, output.length, 13).setValues(output);
}

function findAnalyticsRow_(sheet, visitorId) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const finder = sheet.getRange(2, 1, last - 1, 1).createTextFinder(visitorId).matchEntireCell(true).findNext();
  return finder ? finder.getRow() : null;
}

function splitList_(value) {
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function cleanAnalyticsId_(value) {
  const clean = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,80}$/.test(clean) ? clean : '';
}

function cleanAnalyticsValue_(value, maxLength) {
  return String(value || '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function assertAccess_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty('ACCESS_CODE');
  if (!expected) throw new Error('Backend non configuré.');
  if (String(provided || '') !== expected) throw new Error('Code d’accès incorrect.');
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID manquant.');
  return SpreadsheetApp.openById(id);
}

function ensureSyncSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(APP_SYNC_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(APP_SYNC_SHEET);
    sheet.getRange(1, 1, 1, 9).setValues([['id','circuit','point','adresse','status','capacity','updated_at','mutation_id','actor']]);
    sheet.hideSheet();
    seedSyncSheet_(ss, sheet);
  }
  return sheet;
}

function seedSyncSheet_(ss, target) {
  const source = ss.getSheetByName('CARTE - IMPORT');
  if (!source) return;
  const last = source.getLastRow();
  if (last < 2) return;
  const points = source.getRange(2, 1, last - 1, 5).getValues();
  const capacitySheet = ss.getSheetByName('1ER PASSAGE');
  const capacityMap = {};
  if (capacitySheet) {
    const cLast = capacitySheet.getLastRow();
    if (cLast >= 6) {
      capacitySheet.getRange(6, 3, cLast - 5, 4).getValues().forEach(r => {
        const address = String(r[0] || '').trim();
        if (!address) return;
        capacityMap[address] = { capacity: Number(r[2]) || null, verified: r[3] === '✅ Vérifié' };
      });
    }
  }

  const statusMaps = {};
  'ABCDEFGHIJKLM'.split('').forEach(letter => {
    const sh = ss.getSheetByName('Circuit ' + letter);
    statusMaps[letter] = {};
    if (!sh) return;
    const lr = sh.getLastRow();
    if (lr < 8) return;
    sh.getRange(8, 2, lr - 7, 4).getValues().forEach(r => {
      const address = String(r[0] || '').trim();
      const raw = String(r[3] || '').trim();
      if (address) statusMaps[letter][address] = sheetStatusToApp_(raw);
    });
  });

  const now = new Date();
  const rows = points.map(r => {
    const name = String(r[0] || '').trim();
    const address = String(r[1] || '').trim();
    const circuit = String(r[2] || '').trim().toUpperCase();
    const cap = capacityMap[address];
    return [circuit + '|' + name, circuit, name, address, statusMaps[circuit]?.[address] || 'todo', cap && cap.verified ? cap.capacity : '', now, 'seed', ''];
  }).filter(r => r[1] && r[2] && r[3]);
  if (rows.length) target.getRange(2, 1, rows.length, 9).setValues(rows);
}

function findSyncRow_(sheet, id) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const finder = sheet.getRange(2, 1, last - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
  return finder ? finder.getRow() : null;
}

function applyToOperationalSheets_(circuit, address, status, capacity) {
  const ss = getSpreadsheet_();
  const circuitSheet = ss.getSheetByName('Circuit ' + circuit);
  if (circuitSheet) {
    const row = findAddressRow_(circuitSheet, 8, 2, address);
    if (row) circuitSheet.getRange(row, 5).setValue(appStatusToSheet_(status));
  }

  if (capacity !== null) {
    const first = ss.getSheetByName('1ER PASSAGE');
    if (first) {
      const row = findAddressRow_(first, 6, 3, address);
      if (row) {
        first.getRange(row, 5).setValue(capacity);
        first.getRange(row, 6).setValue('✅ Vérifié');
      }
    }
  }
}

function findAddressRow_(sheet, startRow, column, address) {
  const last = sheet.getLastRow();
  if (last < startRow) return null;
  const finder = sheet.getRange(startRow, column, last - startRow + 1, 1).createTextFinder(address).matchEntireCell(true).findNext();
  return finder ? finder.getRow() : null;
}

function appStatusToSheet_(status) {
  if (status === 'done') return '✅ Fait';
  if (status === 'vandalized' || status === 'covered') return '🔁 À recoller';
  return '⏳ À faire';
}

function sheetStatusToApp_(status) {
  if (status === '✅ Fait') return 'done';
  if (status === '🔁 À recoller') return 'covered';
  return 'todo';
}
