/**
 * Correctif V1 terrain : mutations sûres quand plusieurs points partagent la même adresse.
 * À coller à la FIN de Sans titre.gs, puis redéployer la Web App.
 * Cette définition remplace aqMutation_ par une version qui cible les lignes via le nom officiel du point,
 * et non via la première occurrence de l'adresse.
 */
function aqMutation_(params) {
  params = params || {};

  var circuit = String(params.circuit || "").trim().toUpperCase();
  var name = String(params.name || "").trim();
  var address = String(params.address || "").trim();
  var status = String(params.status || "").trim();
  var capacityText = String(params.capacity == null ? "" : params.capacity).trim();
  var mutationId = String(params.mutationId || "").trim();

  if (!AQ_CIRCUIT_COUNTS[circuit]) throw new Error("Circuit invalide.");
  if (!name || !address) throw new Error("Point invalide.");

  var statusMap = {
    todo: "⏳ À faire",
    done: "✅ Fait",
    repost: "🔁 À recoller",
    skip: "⏭️ Passé"
  };
  if (!statusMap[status]) throw new Error("État invalide.");

  var capacity = null;
  if (capacityText !== "") {
    capacity = Number(capacityText);
    if ([1, 2, 3, 4].indexOf(capacity) === -1) throw new Error("Capacité invalide.");
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = aqSpreadsheet_();
    var importSheet = ss.getSheetByName("CARTE - IMPORT");
    if (!importSheet) throw new Error("Onglet CARTE - IMPORT introuvable.");

    var officialRows = importSheet.getRange(2, 1, 209, 3).getDisplayValues();
    var globalIndex = -1;
    var localIndex = 0;
    var localCounter = 0;

    for (var i = 0; i < officialRows.length; i++) {
      var rowName = String(officialRows[i][0] || "").trim();
      var rowAddress = String(officialRows[i][1] || "").trim();
      var rowCircuit = String(officialRows[i][2] || "").trim().toUpperCase();

      if (rowCircuit === circuit) localCounter++;
      if (rowName === name && rowAddress === address && rowCircuit === circuit) {
        globalIndex = i;
        localIndex = localCounter;
        break;
      }
    }

    if (globalIndex < 0 || localIndex < 1) {
      throw new Error("Ce point ne fait pas partie de la liste officielle.");
    }

    var circuitSheet = ss.getSheetByName("Circuit " + circuit);
    if (!circuitSheet) throw new Error("Onglet Circuit " + circuit + " introuvable.");
    var circuitRow = 8 + localIndex - 1;

    // Contrôle défensif : la ligne ciblée doit bien porter l'adresse attendue.
    var circuitAddress = String(circuitSheet.getRange(circuitRow, 2).getDisplayValue() || "").trim();
    if (circuitAddress !== address) {
      throw new Error("La ligne du point ne correspond pas à la liste officielle.");
    }

    circuitSheet.getRange(circuitRow, 5).setValue(statusMap[status]);

    if (capacity !== null) {
      var firstPass = ss.getSheetByName("1ER PASSAGE");
      if (!firstPass) throw new Error("Onglet 1ER PASSAGE introuvable.");
      var firstPassRow = 6 + globalIndex;
      var firstPassAddress = String(firstPass.getRange(firstPassRow, 3).getDisplayValue() || "").trim();
      if (firstPassAddress !== address) {
        throw new Error("La ligne du premier passage ne correspond pas à la liste officielle.");
      }
      firstPass.getRange(firstPassRow, 5).setValue(capacity);
      firstPass.getRange(firstPassRow, 6).setValue("✅ Vérifié");
    }

    SpreadsheetApp.flush();
    return {
      ok: true,
      mutationId: mutationId,
      circuit: circuit,
      name: name,
      status: status,
      capacity: capacity
    };
  } finally {
    lock.releaseLock();
  }
}
