const fs = require('fs'); let h = fs.readFileSync('src/index.src.html', 'utf8');
function rep(a, b) { const n = h.split(a).length - 1; if (n !== 1) throw new Error('count ' + n + ': ' + a.slice(0, 100)); h = h.replace(a, () => b); }

// ---- 6. warning count on the BOM button, and a tap on a warning that names a pipe selects that pipe ----
rep("    renderBom(); showInsp(); updateEgz();", "    renderBom(); showInsp(); updateEgz();\n    $('bomBtn').textContent = warns.length ? 'BOM · ' + warns.length : 'BOM';");
rep("warns.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('')", "warns.map(function (w) { var m = /\\b[Pp]ipes? ([0-9]+)/.exec(w); return '<li' + (m ? ' data-pipe=\"' + (m[1] - 1) + '\" style=\"cursor:pointer\" title=\"Tap to select this pipe\"' : '') + '>' + esc(w) + '</li>'; }).join('')");
rep("  $('bomBtn').onclick = function () {", `  $('bom').addEventListener('click', function (e) {                // a warning that names a pipe: select it and bring the view to it
    var li = e.target.closest ? e.target.closest('li[data-pipe]') : null; if (!li) return;
    var pi = +li.getAttribute('data-pipe'), p = model.pipes[pi]; if (!p) return;
    setTool('sel'); sel = { kind: 'pipe', i: pi }; target.set((p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2, (p.a[2] + p.b[2]) / 2); rebuild();
  });
  $('bomBtn').onclick = function () {`);

// ---- 8, 9. file names from the project, and a reminder to keep a copy outside Safari ----
rep("  function saveBlob(name, blob) {", `  function fname(kind, ext) {                                       // project_drawing_kind_revN_date.ext, so files in the Files app tell themselves apart
    var T0 = model.title || {}, clean = function (s) { return String(s == null ? '' : s).trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''); };
    var parts = [clean(T0.project) || 'pipedraft']; if (clean(T0.drawing)) parts.push(clean(T0.drawing)); if (kind) parts.push(kind);
    parts.push('rev' + (clean(T0.rev) || '0')); parts.push(new Date().toISOString().slice(0, 10));
    return parts.join('_') + '.' + ext;
  }
  function saveBlob(name, blob) {`);
rep("saveBlob('pipedraft-bom-by-line.csv',", "saveBlob(fname('bom-by-line', 'csv'),");
rep("saveBlob('pipedraft-linelist.csv',", "saveBlob(fname('line-list', 'csv'),");
rep("$('fab-csv').onclick = function () { saveBlob('pipedraft-cutlist.csv',", "$('fab-csv').onclick = function () { saveBlob(fname('cut-list', 'csv'),");
rep("$('f-fab').onclick = function () { saveBlob('pipedraft-cutlist.csv',", "$('f-fab').onclick = function () { saveBlob(fname('cut-list', 'csv'),");
rep("$('f-save').onclick = function () { saveBlob('pipedraft.json',", "$('f-save').onclick = function () { try { localStorage.setItem('pipedraft.lastExport', String(Date.now())); } catch (e) {} saveBlob(fname('project', 'json'),");
rep("$('f-csv').onclick = function () { saveBlob('pipedraft-bom.csv',", "$('f-csv').onclick = function () { saveBlob(fname('bom', 'csv'),");
rep("$('f-dxf').onclick = function () { saveBlob('pipedraft.dxf',", "$('f-dxf').onclick = function () { saveBlob(fname('drawing', 'dxf'),");
rep("if (b) saveBlob('pipedraft.png', b);", "if (b) saveBlob(fname('view', 'png'), b);");
rep("  updateUi(); resize();\n  (function loop()", "  updateUi(); resize();\n  setTimeout(function () {                                          // browsers can clear a site's data: remind about a copy in Files now and then\n    try {\n      var last = Number(localStorage.getItem('pipedraft.lastExport')) || 0;\n      if (!sample && model.pipes.length > 3 && Date.now() - last > 3 * 864e5) toast('Keep a copy outside Safari: ⋯, File, Save project');\n    } catch (e) {}\n  }, 6000);\n  (function loop()");
rep("    selectEq: function (i)", "    fname: fname,\n    selectEq: function (i)");
fs.writeFileSync('src/index.src.html', h);
console.log('ok next2');
