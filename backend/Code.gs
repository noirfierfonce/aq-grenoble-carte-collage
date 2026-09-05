const APP_SYNC_SHEET = 'APP-SYNC';

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
  const payload = handleMutation_(params);
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
