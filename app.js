const API_URL = "https://script.google.com/macros/s/AKfycbwfTj4Yp_jWezxEzae5jeCKEd33RgJ1qGbpKeodE1IlPT713FAwWvKNnQ8x-rywkxcXPw/exec";

let currentUser = null;
let dashboard = null;
let activeMenu = "Struktur Anggaran";
let perPage = 10;
let perencanaanPage = 1;
let pencairanPage = 1;
let filters = {
  rencanaBidang: "ALL", rencanaStatus: "ALL", rencanaSearch: "",
  cairBidang: "ALL", cairStatus: "ALL", cairSearch: ""
};
let adminEditRows = {};
let collapseState = { perencanaanInput: false, uploadPencairan: false };

const MENUS_USER = ["Struktur Anggaran", "Perencanaan", "Pencairan"];
const MENUS_ADMIN = ["Dashboard Monitoring", "Struktur Anggaran", "Perencanaan", "Pencairan"];

function isAdmin(){ return String(currentUser?.id_bidang || "").toUpperCase() === "ADMIN"; }
function toNumber(v){
  if(v === null || v === undefined || v === "") return 0;
  if(typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[^0-9,.-]/g, "");
  if(!s) return 0;
  if((s.match(/\./g) || []).length > 1 && !s.includes(",")) s = s.replace(/\./g, "");
  else if(s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if(s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const num = Number(s);
  return isFinite(num) ? num : 0;
}
function rupiah(n){ return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(toNumber(n)); }
function angkaID(n){ return new Intl.NumberFormat("id-ID", {maximumFractionDigits:0}).format(toNumber(n)); }
function formatAngkaInput(el){ const raw = String(el.value || "").replace(/[^0-9]/g, ""); el.value = raw ? angkaID(raw) : ""; }
function setAutoTotal(volumeId="volume", hargaId="harga", totalId="totalPreview"){
  const total = toNumber(document.getElementById(volumeId)?.value) * toNumber(document.getElementById(hargaId)?.value);
  const el = document.getElementById(totalId); if(el) el.value = rupiah(total);
}
function onAngkaInput(el, volumeId="volume", hargaId="harga", totalId="totalPreview"){ formatAngkaInput(el); setAutoTotal(volumeId, hargaId, totalId); }
function esc(v){ return String(v ?? "").replace(/[&<>'"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[s])); }
function showLoading(text="Memproses..."){ document.getElementById("loadingText").innerText = text; document.getElementById("loadingOverlay").classList.remove("hidden"); }
function hideLoading(){ document.getElementById("loadingOverlay").classList.add("hidden"); }
function badge(text){
  const t = String(text || "-").toUpperCase(); let cls = "badge-gray";
  if(["DISETUJUI","VALID","DOKUMEN LENGKAP","SIAP DICAIRKAN","SUDAH DICAIRKAN","BUKA"].includes(t)) cls = "badge-green";
  if(["DIAJUKAN","MENUNGGU","MENUNGGU VERIFIKASI","PERUBAHAN_DIAJUKAN"].includes(t)) cls = "badge-blue";
  if(["DITOLAK","PERBAIKAN","TUTUP"].includes(t)) cls = "badge-red";
  if(["BELUM ADA DOKUMEN","BELUM INPUT"].includes(t)) cls = "badge-orange";
  return `<span class="badge ${cls}">${esc(t)}</span>`;
}
async function apiPost(payload){
  const res = await fetch(API_URL, {method:"POST", body: JSON.stringify(payload)});
  const txt = await res.text();
  try { return JSON.parse(txt); } catch(e){ throw new Error(txt || "Response bukan JSON"); }
}
async function login(){
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("loginMsg");
  if(!username || !password){ msg.innerText = "Username dan password wajib diisi."; return; }
  showLoading("Login...");
  try{
    const r = await apiPost({action:"login", username, password});
    if(!r.success){ msg.innerText = r.message; return; }
    currentUser = r.user;
    localStorage.setItem("siporbo_user", JSON.stringify(currentUser));
    activeMenu = isAdmin() ? "Dashboard Monitoring" : "Struktur Anggaran";
    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("appPage").classList.remove("hidden");
    await loadDashboard(false);
  }catch(err){ msg.innerText = "Gagal konek ke server/API."; console.error(err); }
  finally{ hideLoading(); }
}
async function loadDashboard(withLoader=true){
  if(withLoader) showLoading("Memuat data...");
  try{
    const r = await apiPost({action:"getDashboard", user: currentUser});
    if(!r.success){ alert(r.message || "Gagal memuat dashboard."); return; }
    dashboard = r;
    document.getElementById("userInfo").innerText = `${currentUser.nama || "-"} - ${currentUser.nama_bidang || currentUser.id_bidang || "-"}`;
    renderAll();
  }catch(err){ console.error(err); alert("Gagal memuat dashboard."); }
  finally{ if(withLoader) hideLoading(); }
}
async function refreshData(){ await loadDashboard(true); }
function renderAll(){ renderMenu(); renderSummary(); renderContent(); }
function setMenu(m){ activeMenu=m; perencanaanPage=1; pencairanPage=1; renderAll(); }
function renderMenu(){
  const menus = isAdmin() ? MENUS_ADMIN : MENUS_USER;
  document.getElementById("menuNav").innerHTML = menus.map(m => `<button class="${activeMenu===m?'active':''}" onclick="setMenu('${m}')">${m}</button>`).join("");
}
function card(a,b){ return `<div class="summary-card"><span>${esc(a)}</span><b>${esc(b)}</b></div>`; }
function renderSummary(){
  const wrap = document.getElementById("summaryCards"); if(!dashboard){ wrap.innerHTML=""; return; }
  if(isAdmin()){
    const pagu = dashboard.rekap.reduce((s,r)=>s+toNumber(r.pagu),0);
    const total = dashboard.rekap.reduce((s,r)=>s+toNumber(r.total_perencanaan),0);
    const dok = dashboard.dokumen.length;
    const valid = dashboard.dokumen.filter(d => String(d.status_verifikasi||"").toUpperCase()==="VALID").length;
    wrap.innerHTML = card("Total Pagu", rupiah(pagu))+card("Total Perencanaan", rupiah(total))+card("Sisa Pagu", rupiah(pagu-total))+card("Dokumen Valid", `${valid}/${dok}`);
  } else {
    const r = dashboard.rekap.find(x => String(x.id_bidang)===String(currentUser.id_bidang)) || {};
    wrap.innerHTML = card("Pagu Bidang", rupiah(r.pagu))+card("Total Perencanaan", rupiah(r.total_perencanaan))+card("Sisa Pagu", rupiah(r.sisa_pagu))+card("Status Akses", r.status_akses || "-");
  }
}
function renderContent(){
  if(activeMenu==="Dashboard Monitoring") return renderMonitoring();
  if(activeMenu==="Struktur Anggaran") return renderStruktur();
  if(activeMenu==="Perencanaan") return renderPerencanaan();
  if(activeMenu==="Pencairan") return renderPencairan();
}
function bidangName(id){ return dashboard.bidangMap?.[String(id)] || id || "-"; }
function kegiatanName(id){ const k = dashboard.perencanaan.find(x => String(x.id_kegiatan)===String(id)); return k?.nama_kegiatan || id || "-"; }
function getPencairanStatus(id){ const p = dashboard.pencairan.find(x => String(x.id_kegiatan)===String(id)); return p?.status_pencairan || dashboard.perencanaan.find(k => String(k.id_kegiatan)===String(id))?.status_pencairan || "BELUM ADA DOKUMEN"; }
function aksesPerencanaanTerbuka(){
  if(isAdmin()) return false;
  const r = dashboard?.rekap?.find(x => String(x.id_bidang) === String(currentUser.id_bidang));
  return String(r?.status_akses || currentUser?.status_akses || "").toUpperCase() === "BUKA";
}
function isKegiatanLocked(k){
  const stCair = String(getPencairanStatus(k.id_kegiatan) || "").toUpperCase();
  if(["DOKUMEN LENGKAP","SIAP DICAIRKAN","SUDAH DICAIRKAN"].includes(stCair)) return true;
  const docs = (dashboard.dokumen || []).filter(d => String(d.id_kegiatan) === String(k.id_kegiatan));
  return docs.length > 0 && docs.every(d => String(d.status_verifikasi || "").toUpperCase() === "VALID");
}
function bidangOptions(selected="ALL", includeAll=true){
  return `${includeAll?`<option value="ALL" ${selected==='ALL'?'selected':''}>Semua Bidang</option>`:""}` + dashboard.bidangs.map(b => `<option value="${esc(b.id_bidang)}" ${selected===String(b.id_bidang)?'selected':''}>${esc(b.nama_bidang)}</option>`).join("");
}
function pager(total, page, fn){
  const pages = Math.max(1, Math.ceil(total/perPage));
  return `<div class="table-footer"><small class="muted">Menampilkan ${total?((page-1)*perPage+1):0}-${Math.min(page*perPage,total)} dari ${total} data</small><div class="pager"><button class="btn-soft" ${page<=1?'disabled':''} onclick="${fn}(${page-1})">Sebelumnya</button><b>${page}/${pages}</b><button class="btn-soft" ${page>=pages?'disabled':''} onclick="${fn}(${page+1})">Berikutnya</button></div></div>`;
}
function setPerPage(p){ perPage = Number(p)||10; perencanaanPage=1; pencairanPage=1; renderContent(); }
function goPerencanaanPage(p){ perencanaanPage=p; renderPerencanaan(); }
function goPencairanPage(p){ pencairanPage=p; renderPencairan(); }


function toggleCollapse(key){
  collapseState[key] = !collapseState[key];
  renderContent();
}
function collapseButton(key){
  return `<button class="btn-soft btn-toggle" onclick="toggleCollapse('${key}')">${collapseState[key] ? 'Maximize' : 'Minimize'}</button>`;
}
function setAdminEditRow(id, on){
  adminEditRows[id] = !!on;
  renderStruktur();
}
function onPaguAdminInput(el){
  formatAngkaInput(el);
}
function renderMonitoring(){
  const rows = dashboard.rekap.map(r=>{ const pct=toNumber(r.pagu)?Math.min(100,Math.round(toNumber(r.total_perencanaan)/toNumber(r.pagu)*100)):0; return `<tr><td><b>${esc(r.nama_bidang)}</b><br><small class="muted">${esc(r.id_bidang)}</small></td><td>${rupiah(r.pagu)}</td><td>${rupiah(r.total_perencanaan)}</td><td>${rupiah(r.sisa_pagu)}</td><td><div class="progress-bar"><div style="width:${pct}%"></div></div><small>${pct}%</small></td><td>${esc(r.jumlah_kegiatan||0)}</td><td>${esc(r.dokumen_upload||0)}</td><td>${esc(r.dokumen_valid||0)}</td><td>${badge(r.status_akses)}</td><td>${badge(r.status_progress)}</td></tr>`; }).join("");
  document.getElementById("contentArea").innerHTML = `<section class="panel fade-up"><h3>Dashboard Monitoring Admin</h3><p class="panel-sub">Pantauan perencanaan dan pencairan dari semua bidang.</p><button class="btn-refresh" onclick="refreshData()">Refresh Data</button><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Bidang</th><th>Pagu</th><th>Perencanaan</th><th>Sisa</th><th>%</th><th>Kegiatan</th><th>Dok Upload</th><th>Dok Valid</th><th>Akses</th><th>Progress</th></tr></thead><tbody>${rows || `<tr><td colspan="10" class="empty">Belum ada data</td></tr>`}</tbody></table></div></section>`;
}
function renderStruktur(){
  if(isAdmin()){
    const rows = dashboard.rekap.map(r=>{
      const id = String(r.id_bidang);
      const editing = !!adminEditRows[id];
      const paguView = angkaID(r.pagu);
      return `<div class="admin-row premium-row ${editing?'editing':''}">
        <div><b>${esc(r.nama_bidang)}</b><br><small class="muted">${esc(r.id_bidang)}</small><br><small>Total: ${rupiah(r.total_perencanaan)} | Sisa: ${rupiah(r.sisa_pagu)}</small></div>
        <div class="field"><label>Pagu</label>${editing?`<input id="pagu_${esc(r.id_bidang)}" inputmode="numeric" value="${paguView}" oninput="onPaguAdminInput(this)">`:`<div class="readonly-display">Rp ${paguView}</div>`}</div>
        <div class="field"><label>Akses</label>${editing?`<select id="akses_${esc(r.id_bidang)}"><option value="BUKA" ${r.status_akses==='BUKA'?'selected':''}>BUKA</option><option value="TUTUP" ${r.status_akses==='TUTUP'?'selected':''}>TUTUP</option></select>`:`<div class="readonly-display">${esc(r.status_akses || '-')}</div>`}</div>
        <div>${badge(r.status_progress)}</div>
        <div class="admin-actions">${editing?`<button onclick="updateBidang('${esc(r.id_bidang)}')">Simpan</button><button class="btn-soft" onclick="setAdminEditRow('${esc(r.id_bidang)}', false)">Batal</button>`:`<button class="btn-mini" onclick="setAdminEditRow('${esc(r.id_bidang)}', true)">Edit</button>`}</div>
      </div>`;
    }).join("");
    document.getElementById("contentArea").innerHTML = `<section class="panel fade-up premium-panel"><h3>Struktur Anggaran</h3><p class="panel-sub">Admin mengatur pagu dan akses input tiap bidang. Klik Edit dulu untuk mengubah data.</p>${rows || `<p class="muted">Belum ada bidang.</p>`}</section>`;
  } else {
    const r = dashboard.rekap.find(x=>String(x.id_bidang)===String(currentUser.id_bidang)) || {};
    document.getElementById("contentArea").innerHTML = `<section class="panel fade-up premium-panel"><h3>Ringkasan Bidang</h3><p class="panel-sub">Informasi anggaran dan progres bidang.</p><button class="btn-refresh" onclick="refreshData()">Refresh Data</button><div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Bidang</th><th>Pagu</th><th>Total Perencanaan</th><th>Sisa</th><th>Kegiatan</th><th>Dokumen</th><th>Akses</th><th>Progress</th></tr></thead><tbody><tr><td>${esc(r.nama_bidang)}</td><td>${rupiah(r.pagu)}</td><td>${rupiah(r.total_perencanaan)}</td><td>${rupiah(r.sisa_pagu)}</td><td>${esc(r.jumlah_kegiatan||0)}</td><td>${esc(r.dokumen_upload||0)}</td><td>${badge(r.status_akses)}</td><td>${badge(r.status_progress)}</td></tr></tbody></table></div></section>`;
  }
}
function filterBarPerencanaan(){
  return `<div class="filter-card"><div class="toolbar">${isAdmin()?`<div class="field small"><label>Filter Bidang</label><select onchange="filters.rencanaBidang=this.value;perencanaanPage=1;renderPerencanaan()">${bidangOptions(filters.rencanaBidang,true)}</select></div>`:""}<div class="field small"><label>Filter Status</label><select onchange="filters.rencanaStatus=this.value;perencanaanPage=1;renderPerencanaan()"><option value="ALL">Semua Status</option>${["DIAJUKAN","DISETUJUI","DITOLAK","PERUBAHAN_DIAJUKAN"].map(s=>`<option value="${s}" ${filters.rencanaStatus===s?'selected':''}>${s}</option>`).join("")}</select></div><div class="field"><label>Search Nama Kegiatan</label><input value="${esc(filters.rencanaSearch)}" placeholder="Cari nama kegiatan..." oninput="filters.rencanaSearch=this.value;perencanaanPage=1;renderPerencanaan()"></div><div class="field small"><label>Per Halaman</label><select onchange="setPerPage(this.value)"><option ${perPage===10?'selected':''}>10</option><option ${perPage===25?'selected':''}>25</option><option ${perPage===50?'selected':''}>50</option></select></div><button class="btn-refresh" onclick="refreshData()">Refresh</button></div></div>`;
}
function getFilteredRencana(){
  let data = dashboard.perencanaan.filter(k=>k.id_kegiatan);
  if(isAdmin() && filters.rencanaBidang !== "ALL") data = data.filter(k => String(k.id_bidang)===filters.rencanaBidang);
  if(filters.rencanaStatus !== "ALL") data = data.filter(k => String(k.status_perencanaan||"").toUpperCase()===filters.rencanaStatus);
  const q = filters.rencanaSearch.trim().toLowerCase();
  if(q) data = data.filter(k => String(k.nama_kegiatan||"").toLowerCase().includes(q));
  return data;
}
function renderPerencanaan(){
  const data = getFilteredRencana();
  const pageData = data.slice((perencanaanPage-1)*perPage, perencanaanPage*perPage);
  let html = "";
  if(!isAdmin()){
    if(aksesPerencanaanTerbuka()){
      html += `<section class="panel fade-up premium-panel collapsible-panel"><div class="panel-head"><div><h3>Input Perencanaan</h3><p class="panel-sub">Input rencana kegiatan/kebutuhan. Setelah disimpan, status langsung DIAJUKAN ke admin.</p></div>${collapseButton('perencanaanInput')}</div><div class="collapse-body ${collapseState.perencanaanInput?'hidden':''}"><div class="form-grid"><div class="field"><label>Nama Kegiatan</label><input id="namaKegiatan" placeholder="Contoh: Rapat Koordinasi"></div><div class="field"><label>Rincian Kebutuhan</label><input id="rincian" placeholder="Contoh: Konsumsi rapat"></div><div class="field"><label>Keterangan</label><input id="keterangan" placeholder="Opsional"></div><div class="field"><label>Volume</label><input id="volume" inputmode="numeric" placeholder="Contoh: 2" oninput="onAngkaInput(this)"></div><div class="field"><label>Satuan</label><input id="satuan" placeholder="Orang / Paket / Buah"></div><div class="field"><label>Harga Satuan</label><input id="harga" inputmode="numeric" placeholder="Contoh: 500.000" oninput="onAngkaInput(this)"></div><div class="field"><label>Total Otomatis</label><input id="totalPreview" class="readonly-total" value="Rp0" readonly></div></div><button onclick="savePerencanaan()">Simpan & Ajukan</button><div id="saveMsg" class="msg"></div></div></section>`;
    } else {
      html += `<section class="panel fade-up locked-panel"><h3>Perencanaan Ditutup</h3><p class="panel-sub">🔒 Akses perencanaan bidang sedang ditutup oleh admin. Kamu masih bisa membuka menu Pencairan untuk upload/revisi dokumen.</p></section>`;
    }
  }
  const rows = pageData.map(k=>renderPerencanaanRow(k)).join("");
  html += `<section class="panel fade-up"><h3>${isAdmin()?"Persetujuan Perencanaan":"Data Perencanaan"}</h3><p class="panel-sub">${isAdmin()?"Admin menyetujui/menolak perencanaan bidang.":"Daftar rencana kegiatan bidang sendiri."}</p>${filterBarPerencanaan()}<div class="table-wrap"><table><thead><tr><th>ID</th><th>Bidang</th><th>Nama Kegiatan</th><th>Rincian</th><th>Vol</th><th>Satuan</th><th>Harga</th><th>Jumlah</th><th>Status</th><th>Alasan / Riwayat</th><th>Aksi</th></tr></thead><tbody>${rows || `<tr><td colspan="11" class="empty">Belum ada data</td></tr>`}</tbody></table></div>${pager(data.length, perencanaanPage, 'goPerencanaanPage')}</section>`;
  document.getElementById("contentArea").innerHTML = html;
}

function renderPerencanaanRow(k){
  const st = String(k.status_perencanaan||"DIAJUKAN").toUpperCase();
  const locked = isKegiatanLocked(k);
  const aksesBuka = aksesPerencanaanTerbuka();
  const note = `${k.alasan_penolakan?`<div class="reason-box"><b>Alasan ditolak:</b><br>${esc(k.alasan_penolakan)}</div>`:""}${k.alasan_perubahan?`<div class="history-box"><b>Alasan perubahan:</b><br>${esc(k.alasan_perubahan)}</div>`:""}${k.riwayat_perubahan?`<div class="history-box"><b>Riwayat:</b><br>${esc(k.riwayat_perubahan).replace(/\n/g,'<br>')}</div>`:""}` || `<span class="muted">-</span>`;
  let aksi = "";
  if(isAdmin()){
    if(st === "DIAJUKAN" || st === "PERUBAHAN_DIAJUKAN") aksi = `<button class="btn-mini btn-green" onclick="setujui('${esc(k.id_kegiatan)}')">Setujui</button><button class="btn-mini btn-orange" onclick="tolak('${esc(k.id_kegiatan)}')">Tolak</button>`;
    else aksi = `<span class="muted">-</span>`;
  } else if(locked){
    aksi = `<span class="lock-badge">🔒 Selesai</span>`;
  } else if(!aksesBuka){
    aksi = `<span class="lock-badge">🔒 Akses perencanaan ditutup</span>`;
  } else {
    if(st === "DIAJUKAN" || st === "DITOLAK") aksi = `<button class="btn-mini" onclick="openEditModal('${esc(k.id_kegiatan)}','normal')">Edit</button><button class="btn-mini btn-red" onclick="hapusPerencanaan('${esc(k.id_kegiatan)}')">Hapus</button>`;
    else if(st === "DISETUJUI") aksi = `<button class="btn-mini btn-orange" onclick="openEditModal('${esc(k.id_kegiatan)}','change')">Ajukan Perubahan</button>`;
    else aksi = `<span class="muted">Menunggu admin</span>`;
  }
  const perubahan = toNumber(k.perubahan_ke) ? `<br><small class="muted">Perubahan Ke-${toNumber(k.perubahan_ke)}</small>` : "";
  return `<tr><td>${esc(k.id_kegiatan)}</td><td>${esc(bidangName(k.id_bidang))}</td><td><b>${esc(k.nama_kegiatan)}</b>${perubahan}</td><td>${esc(k.rincian_kebutuhan)}</td><td>${esc(k.volume)}</td><td>${esc(k.satuan)}</td><td>${rupiah(k.harga_satuan)}</td><td><b>${rupiah(k.jumlah || (toNumber(k.volume)*toNumber(k.harga_satuan)))}</b></td><td>${badge(st)}</td><td class="note-cell">${note}</td><td class="nowrap">${aksi}</td></tr>`;
}

function filterBarPencairan(){
  return `<div class="filter-card"><div class="toolbar">${isAdmin()?`<div class="field small"><label>Filter Bidang</label><select onchange="filters.cairBidang=this.value;pencairanPage=1;renderPencairan()">${bidangOptions(filters.cairBidang,true)}</select></div>`:""}<div class="field small"><label>Filter Status Dokumen</label><select onchange="filters.cairStatus=this.value;pencairanPage=1;renderPencairan()"><option value="ALL">Semua Status</option>${["MENUNGGU","VALID","DITOLAK","PERBAIKAN"].map(s=>`<option value="${s}" ${filters.cairStatus===s?'selected':''}>${s}</option>`).join("")}</select></div><div class="field"><label>Search Nama Kegiatan</label><input value="${esc(filters.cairSearch)}" placeholder="Cari nama kegiatan..." oninput="filters.cairSearch=this.value;pencairanPage=1;renderPencairan()"></div><button class="btn-refresh" onclick="refreshData()">Refresh</button></div></div>`;
}
function renderPencairan(){
  let html = "";
  if(!isAdmin()){
    const approved = dashboard.perencanaan.filter(k => String(k.status_perencanaan||"").toUpperCase()==="DISETUJUI");
    html += `<section class="panel fade-up premium-panel collapsible-panel"><div class="panel-head"><div><h3>Upload Dokumen Pencairan</h3><p class="panel-sub">Satu kegiatan bisa upload lebih dari satu dokumen. Tambah baris file jika dokumennya lebih dari satu.</p></div>${collapseButton('uploadPencairan')}</div><div class="collapse-body ${collapseState.uploadPencairan?'hidden':''}"><div class="form-grid"><div class="field"><label>Pilih Kegiatan</label><select id="dokKegiatan">${approved.map(k=>`<option value="${esc(k.id_kegiatan)}">${esc(k.nama_kegiatan)}</option>`).join("")}</select></div></div><div id="uploadRows"><div class="doc-upload-row"><div class="field"><label>Jenis Dokumen</label><select class="jenisDok"><option>Berita Acara</option><option>Daftar Hadir</option><option>Dokumentasi</option><option>Kwitansi</option><option>Surat Tugas</option><option>Dokumen Lainnya</option></select></div><div class="field"><label>File Dokumen</label><input type="file" class="fileDok"></div><button class="btn-red" onclick="removeUploadRow(this)" type="button">Hapus</button></div></div><button class="btn-soft" onclick="addUploadRow()" type="button">+ Tambah File Dokumen</button> <button onclick="uploadDokumen()">Upload Semua Dokumen</button><div id="uploadMsg" class="msg">${approved.length?"":"Belum ada kegiatan yang DISETUJUI admin."}</div></div></section>`;
  }
  let docs = dashboard.dokumen || [];
  if(isAdmin() && filters.cairBidang !== "ALL") docs = docs.filter(d => String(d.id_bidang)===filters.cairBidang);
  if(filters.cairStatus !== "ALL") docs = docs.filter(d => String(d.status_verifikasi||"").toUpperCase()===filters.cairStatus);
  const q = filters.cairSearch.trim().toLowerCase();
  if(q) docs = docs.filter(d => kegiatanName(d.id_kegiatan).toLowerCase().includes(q));
  const pageData = docs.slice((pencairanPage-1)*perPage, pencairanPage*perPage);
  const rows = pageData.map(d=>renderDokumenRow(d)).join("");
  html += `<section class="panel fade-up"><h3>Data Dokumen & Pencairan</h3><p class="panel-sub">${isAdmin()?"Admin memverifikasi dokumen dan memperbarui status pencairan.":"Daftar dokumen yang sudah diupload."}</p>${filterBarPencairan()}<div class="table-wrap"><table><thead><tr><th>Bidang</th><th>Kegiatan</th><th>Jenis Dokumen</th><th>File</th><th>Status Dokumen</th><th>Status Pencairan</th><th>Catatan</th><th>Aksi Admin</th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="empty">Belum ada dokumen</td></tr>`}</tbody></table></div>${pager(docs.length, pencairanPage, 'goPencairanPage')}</section>`;
  document.getElementById("contentArea").innerHTML = html;
}
function renderDokumenRow(d){
  const st = String(d.status_verifikasi || 'MENUNGGU').toUpperCase();
  let aksi = `<span class="muted">-</span>`;
  if(isAdmin()){
    aksi = `<button class="btn-mini btn-green" onclick="verifDok('${esc(d.id_dokumen)}','VALID')">Valid</button>` +
           `<button class="btn-mini btn-orange" onclick="mintaPerbaikanDok('${esc(d.id_dokumen)}')">Perbaikan</button>`;
  } else if(st === 'PERBAIKAN' || st === 'DITOLAK'){
    aksi = `<div class="revision-box"><input type="file" id="revisi_${esc(d.id_dokumen)}"><button class="btn-mini" onclick="revisiDokumen('${esc(d.id_dokumen)}')">Upload Revisi</button></div>`;
  }
  return `<tr><td>${esc(bidangName(d.id_bidang))}</td><td>${esc(kegiatanName(d.id_kegiatan))}</td><td>${esc(d.jenis_dokumen)}</td><td>${d.url_file?`<a href="${esc(d.url_file)}" target="_blank">${esc(d.nama_file||'Buka file')}</a>`:esc(d.nama_file)}</td><td>${badge(d.status_verifikasi || 'MENUNGGU')}</td><td>${badge(getPencairanStatus(d.id_kegiatan))}</td><td class="note-cell">${esc(d.catatan_admin||'-')}</td><td>${aksi}</td></tr>`;
}
function addUploadRow(){
  const wrap = document.getElementById("uploadRows");
  const div = document.createElement("div");
  div.className = "doc-upload-row";
  div.innerHTML = `<div class="field"><label>Jenis Dokumen</label><select class="jenisDok"><option>Berita Acara</option><option>Daftar Hadir</option><option>Dokumentasi</option><option>Kwitansi</option><option>Surat Tugas</option><option>Dokumen Lainnya</option></select></div><div class="field"><label>File Dokumen</label><input type="file" class="fileDok"></div><button class="btn-red" onclick="removeUploadRow(this)" type="button">Hapus</button>`;
  wrap.appendChild(div);
}
function removeUploadRow(btn){ const rows = document.querySelectorAll(".doc-upload-row"); if(rows.length <= 1) return; btn.closest(".doc-upload-row").remove(); }
async function updateBidang(id){
  showLoading("Menyimpan bidang...");
  try{
    const r = await apiPost({action:"updateBidang", user:currentUser, id_bidang:id, pagu:toNumber(document.getElementById(`pagu_${id}`).value), status_akses:document.getElementById(`akses_${id}`).value});
    alert(r.message);
    if(r.success){ adminEditRows[id] = false; await loadDashboard(false); }
  }catch(e){alert(e.message)}finally{hideLoading();}
}
async function savePerencanaan(){
  if(!aksesPerencanaanTerbuka()){ alert("Akses perencanaan bidang sedang ditutup admin. Menu pencairan tetap bisa digunakan."); return; }
  showLoading("Mengajukan perencanaan...");
  const data = {nama_kegiatan:document.getElementById("namaKegiatan").value, rincian_kebutuhan:document.getElementById("rincian").value, keterangan:document.getElementById("keterangan").value, volume:toNumber(document.getElementById("volume").value), satuan:document.getElementById("satuan").value, harga_satuan:toNumber(document.getElementById("harga").value)};
  try{ const r = await apiPost({action:"savePerencanaan", user:currentUser, data}); document.getElementById("saveMsg").innerText = r.message; if(r.success) await loadDashboard(false); }catch(e){alert(e.message)}finally{hideLoading();}
}
function openEditModal(id, mode){
  const k = dashboard.perencanaan.find(x => String(x.id_kegiatan)===String(id)); if(!k) return;
  if(isKegiatanLocked(k)){ alert("Kegiatan sudah selesai sampai validasi pencairan, perencanaan terkunci."); return; }
  if(!aksesPerencanaanTerbuka()){ alert("Akses perencanaan bidang sedang ditutup admin. Menu pencairan tetap bisa digunakan."); return; }
  document.getElementById("editMode").value = mode; document.getElementById("editIdKegiatan").value = k.id_kegiatan;
  document.getElementById("editNamaKegiatan").value = k.nama_kegiatan || ""; document.getElementById("editRincian").value = k.rincian_kebutuhan || ""; document.getElementById("editKeterangan").value = k.keterangan || ""; document.getElementById("editVolume").value = angkaID(k.volume); document.getElementById("editSatuan").value = k.satuan || ""; document.getElementById("editHarga").value = angkaID(k.harga_satuan); document.getElementById("editAlasanPerubahan").value = "";
  document.getElementById("editModalTitle").innerText = mode === "change" ? `Ajukan Perubahan Perencanaan` : "Edit Perencanaan";
  document.getElementById("editModalSub").innerText = mode === "change" ? `Perubahan akan masuk sebagai Perubahan Ke-${toNumber(k.perubahan_ke)+1} dan menunggu admin.` : "Data akan diajukan kembali ke admin.";
  document.getElementById("alasanPerubahanWrap").classList.toggle("hidden", mode !== "change");
  setAutoTotal("editVolume","editHarga","editTotalPreview");
  document.getElementById("editModal").classList.remove("hidden");
}
function closeEditModal(){ document.getElementById("editModal").classList.add("hidden"); }
async function submitEditPerencanaan(){
  showLoading("Menyimpan perubahan...");
  const mode = document.getElementById("editMode").value;
  const data = {id_kegiatan:document.getElementById("editIdKegiatan").value, mode, nama_kegiatan:document.getElementById("editNamaKegiatan").value, rincian_kebutuhan:document.getElementById("editRincian").value, keterangan:document.getElementById("editKeterangan").value, volume:toNumber(document.getElementById("editVolume").value), satuan:document.getElementById("editSatuan").value, harga_satuan:toNumber(document.getElementById("editHarga").value), alasan_perubahan:document.getElementById("editAlasanPerubahan").value};
  try{ const r = await apiPost({action:"updatePerencanaan", user:currentUser, data}); alert(r.message); if(r.success){ closeEditModal(); await loadDashboard(false); } }catch(e){alert(e.message)}finally{hideLoading();}
}
async function hapusPerencanaan(id){ const k=dashboard.perencanaan.find(x=>String(x.id_kegiatan)===String(id)); if(k && isKegiatanLocked(k)){ alert("Kegiatan sudah terkunci karena dokumen pencairan sudah divalidasi."); return; } if(!aksesPerencanaanTerbuka()){ alert("Akses perencanaan bidang sedang ditutup admin."); return; } if(!confirm("Hapus perencanaan ini?")) return; showLoading("Menghapus..."); try{ const r = await apiPost({action:"deletePerencanaan", user:currentUser, id_kegiatan:id}); alert(r.message); if(r.success) await loadDashboard(false); }catch(e){alert(e.message)}finally{hideLoading();} }
async function setujui(id){ showLoading("Menyetujui..."); try{ const r = await apiPost({action:"setujuiPerencanaan", user:currentUser, id_kegiatan:id}); alert(r.message); if(r.success) await loadDashboard(false); }catch(e){alert(e.message)}finally{hideLoading();} }
async function tolak(id){ const catatan = prompt("Alasan penolakan wajib diisi:"); if(!catatan) return; showLoading("Menolak..."); try{ const r = await apiPost({action:"tolakPerencanaan", user:currentUser, id_kegiatan:id, catatan}); alert(r.message); if(r.success) await loadDashboard(false); }catch(e){alert(e.message)}finally{hideLoading();} }
function fileToBase64(file){ return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(String(reader.result).split(',')[1]); reader.onerror=reject; reader.readAsDataURL(file); }); }
async function uploadDokumen(){
  const idKegiatan = document.getElementById("dokKegiatan")?.value; if(!idKegiatan){ alert("Pilih kegiatan dulu."); return; }
  const rows = [...document.querySelectorAll(".doc-upload-row")];
  const items = rows.map(row => ({jenis:row.querySelector(".jenisDok").value, file:row.querySelector(".fileDok").files[0]})).filter(x=>x.file);
  if(!items.length){ alert("Pilih minimal 1 file dokumen."); return; }
  showLoading(`Upload 1/${items.length} dokumen...`);
  try{
    for(let i=0;i<items.length;i++){
      document.getElementById("loadingText").innerText = `Upload ${i+1}/${items.length} dokumen...`;
      const base64 = await fileToBase64(items[i].file);
      const r = await apiPost({action:"uploadDokumen", user:currentUser, id_kegiatan:idKegiatan, jenis_dokumen:items[i].jenis, file_name:items[i].file.name, mime_type:items[i].file.type, file_base64:base64});
      if(!r.success) throw new Error(r.message);
    }
    alert("Dokumen berhasil diupload."); await loadDashboard(false);
  }catch(e){ alert(e.message || "Gagal upload dokumen."); }
  finally{ hideLoading(); }
}
async function verifDok(id, status){
  showLoading("Verifikasi dokumen...");
  try{
    const r=await apiPost({action:"verifyDokumen", user:currentUser, id_dokumen:id, status_verifikasi:status, catatan_admin:""});
    alert(r.message); if(r.success) await loadDashboard(false);
  }catch(e){alert(e.message)}finally{hideLoading();}
}
async function mintaPerbaikanDok(id){
  const catatan = prompt("Alasan perbaikan dokumen wajib diisi:");
  if(!catatan) return;
  showLoading("Mengirim status perbaikan...");
  try{
    const r=await apiPost({action:"verifyDokumen", user:currentUser, id_dokumen:id, status_verifikasi:"PERBAIKAN", catatan_admin:catatan});
    alert(r.message); if(r.success) await loadDashboard(false);
  }catch(e){alert(e.message)}finally{hideLoading();}
}
async function revisiDokumen(idDokumen){
  const input = document.getElementById(`revisi_${idDokumen}`);
  const file = input?.files?.[0];
  if(!file){ alert("Pilih file revisi dulu."); return; }
  showLoading("Upload revisi dokumen...");
  try{
    const base64 = await fileToBase64(file);
    const r = await apiPost({action:"revisiDokumen", user:currentUser, id_dokumen:idDokumen, file_name:file.name, mime_type:file.type, file_base64:base64});
    alert(r.message); if(r.success) await loadDashboard(false);
  }catch(e){ alert(e.message || "Gagal upload revisi dokumen."); }
  finally{ hideLoading(); }
}
async function updateCair(id, status){
  // fungsi lama dibiarkan untuk kompatibilitas, tapi tombolnya sudah tidak ditampilkan
  const cat = prompt("Catatan status pencairan (opsional):") || "";
  showLoading("Update pencairan...");
  try{ const r=await apiPost({action:"updateStatusPencairan", user:currentUser, id_kegiatan:id, status_pencairan:status, catatan_admin:cat}); alert(r.message); if(r.success) await loadDashboard(false); }catch(e){alert(e.message)}finally{hideLoading();}
}
function logout(){ localStorage.removeItem("siporbo_user"); currentUser=null; dashboard=null; document.getElementById("appPage").classList.add("hidden"); document.getElementById("loginPage").classList.remove("hidden"); }
window.onload = async function(){ const saved = localStorage.getItem("siporbo_user"); if(saved){ currentUser=JSON.parse(saved); activeMenu=isAdmin()?"Dashboard Monitoring":"Struktur Anggaran"; document.getElementById("loginPage").classList.add("hidden"); document.getElementById("appPage").classList.remove("hidden"); await loadDashboard(true); } };

/* =========================
   SIPORBO v11 behavior overrides
   ========================= */
function isPencairanComplete(idKegiatan){
  const st = String(getPencairanStatus(idKegiatan) || "").toUpperCase();
  if(["DOKUMEN LENGKAP","SIAP DICAIRKAN","SUDAH DICAIRKAN"].includes(st)) return true;
  const docs = (dashboard?.dokumen || []).filter(d => String(d.id_kegiatan) === String(idKegiatan));
  return docs.length > 0 && docs.every(d => String(d.status_verifikasi || "").toUpperCase() === "VALID");
}
function isKegiatanLocked(k){ return isPencairanComplete(k.id_kegiatan); }
function getApprovedOpenKegiatan(){
  return (dashboard?.perencanaan || []).filter(k =>
    String(k.status_perencanaan || "").toUpperCase() === "DISETUJUI" && !isPencairanComplete(k.id_kegiatan)
  );
}
function groupedDocs(){
  const docs = dashboard?.dokumen || [];
  const groups = {};
  docs.forEach(d => {
    const key = String(d.id_kegiatan || "");
    if(!groups[key]){
      const keg = (dashboard?.perencanaan || []).find(k => String(k.id_kegiatan) === key) || {};
      groups[key] = {id_kegiatan:key, id_bidang:d.id_bidang || keg.id_bidang, kegiatan:keg, docs:[]};
    }
    groups[key].docs.push(d);
  });
  return Object.values(groups);
}
function groupDocStatus(g){
  const docs = g.docs || [];
  if(!docs.length) return "BELUM ADA DOKUMEN";
  if(docs.some(d => ["PERBAIKAN","DITOLAK"].includes(String(d.status_verifikasi||"").toUpperCase()))) return "PERBAIKAN";
  if(docs.every(d => String(d.status_verifikasi||"").toUpperCase() === "VALID")) return "VALID";
  return "MENUNGGU";
}
function filterBarPencairan(){
  return `<div class="filter-card"><div class="toolbar">${isAdmin()?`<div class="field small"><label>Filter Bidang</label><select onchange="filters.cairBidang=this.value;pencairanPage=1;renderPencairan()">${bidangOptions(filters.cairBidang,true)}</select></div>`:""}<div class="field small"><label>Filter Status Dokumen</label><select onchange="filters.cairStatus=this.value;pencairanPage=1;renderPencairan()"><option value="ALL">Semua Status</option>${["MENUNGGU","VALID","PERBAIKAN"].map(s=>`<option value="${s}" ${filters.cairStatus===s?'selected':''}>${s}</option>`).join("")}</select></div><div class="field"><label>Search Nama Kegiatan</label><input value="${esc(filters.cairSearch)}" placeholder="Cari nama kegiatan..." oninput="filters.cairSearch=this.value;pencairanPage=1;renderPencairan()"></div><button class="btn-refresh" onclick="refreshData()">Refresh</button></div></div>`;
}
function renderPencairan(){
  let html = "";
  if(!isAdmin()){
    const approved = getApprovedOpenKegiatan();
    html += `<section class="panel fade-up premium-panel collapsible-panel"><div class="panel-head"><div><h3>Upload Dokumen Pencairan</h3><p class="panel-sub">Satu kegiatan bisa upload lebih dari satu dokumen. Kegiatan yang sudah valid/selesai tidak muncul lagi di pilihan upload.</p></div>${collapseButton('uploadPencairan')}</div><div class="collapse-body ${collapseState.uploadPencairan?'hidden':''}"><div class="form-grid"><div class="field"><label>Pilih Kegiatan</label><select id="dokKegiatan">${approved.map(k=>`<option value="${esc(k.id_kegiatan)}">${esc(k.nama_kegiatan)}</option>`).join("")}</select></div></div><div id="uploadRows"><div class="doc-upload-row"><div class="field"><label>Jenis Dokumen</label><select class="jenisDok"><option>Berita Acara</option><option>Daftar Hadir</option><option>Dokumentasi</option><option>Kwitansi</option><option>Surat Tugas</option><option>Dokumen Lainnya</option></select></div><div class="field"><label>File Dokumen</label><input type="file" class="fileDok"></div><button class="btn-red" onclick="removeUploadRow(this)" type="button">Hapus</button></div></div><button class="btn-soft" onclick="addUploadRow()" type="button">+ Tambah File Dokumen</button> <button onclick="uploadDokumen()">Upload Semua Dokumen</button><div id="uploadMsg" class="msg">${approved.length?"":"Tidak ada kegiatan yang bisa diupload. Kegiatan harus DISETUJUI dan belum selesai validasi pencairan."}</div></div></section>`;
  }

  let groups = groupedDocs();
  if(isAdmin() && filters.cairBidang !== "ALL") groups = groups.filter(g => String(g.id_bidang)===filters.cairBidang);
  if(filters.cairStatus !== "ALL") groups = groups.filter(g => groupDocStatus(g) === filters.cairStatus);
  const q = filters.cairSearch.trim().toLowerCase();
  if(q) groups = groups.filter(g => kegiatanName(g.id_kegiatan).toLowerCase().includes(q));
  const pageData = groups.slice((pencairanPage-1)*perPage, pencairanPage*perPage);
  const rows = pageData.map(g=>renderDokumenGroupRow(g)).join("");
  html += `<section class="panel fade-up"><h3>Data Dokumen & Pencairan</h3><p class="panel-sub">${isAdmin()?"Rekap dokumen digabung per kegiatan agar validasi lebih gampang. Kalau dokumen masih kurang, klik Perbaikan dan isi alasan.":"Rekap dokumen digabung per kegiatan agar lebih jelas."}</p>${filterBarPencairan()}<div class="table-wrap grouped"><table class="group-table"><thead><tr><th>Rekap Kegiatan</th></tr></thead><tbody>${rows || `<tr><td class="empty">Belum ada dokumen</td></tr>`}</tbody></table></div>${pager(groups.length, pencairanPage, 'goPencairanPage')}</section>`;
  document.getElementById("contentArea").innerHTML = html;
}
function renderDokumenGroupRow(g){
  const stGroup = groupDocStatus(g);
  const stCair = getPencairanStatus(g.id_kegiatan);
  const docsHtml = (g.docs || []).map(d => {
    const st = String(d.status_verifikasi || 'MENUNGGU').toUpperCase();
    let rev = "";
    if(!isAdmin() && (st === 'PERBAIKAN' || st === 'DITOLAK')){
      rev = `<div class="doc-action-box"><input type="file" id="revisi_${esc(d.id_dokumen)}"><button class="btn-mini" onclick="revisiDokumen('${esc(d.id_dokumen)}')">Upload Revisi</button></div>`;
    }
    return `<div class="doc-item"><div><b>${esc(d.jenis_dokumen || '-')}</b><br><small class="muted">${esc(d.nama_file || '-')}</small></div><div>${d.url_file?`<a href="${esc(d.url_file)}" target="_blank">Buka File</a>`:esc(d.nama_file || '-')}</div><div>${badge(d.status_verifikasi || 'MENUNGGU')}</div><div>${d.catatan_admin?`<div class="group-reason"><b>Catatan:</b> ${esc(d.catatan_admin)}</div>`:rev || `<span class="muted">-</span>`}</div></div>`;
  }).join("");
  let actions = `<span class="muted">-</span>`;
  if(isAdmin()){
    actions = `<div class="group-actions"><button class="btn-mini btn-green btn-wide" onclick="validKegiatanDokumen('${esc(g.id_kegiatan)}')">Valid</button><button class="btn-mini btn-orange btn-wide" onclick="perbaikanKegiatanDokumen('${esc(g.id_kegiatan)}')">Perbaikan</button></div>`;
  }
  return `<tr><td class="doc-group-card"><div class="doc-group-head"><div class="doc-group-title"><b>${esc(kegiatanName(g.id_kegiatan))}</b><small>${esc(g.id_kegiatan)}</small></div><div><small class="muted">Bidang</small><br><b>${esc(bidangName(g.id_bidang))}</b></div><div><small class="muted">Status Dokumen</small><br>${badge(stGroup)}</div><div><small class="muted">Status Pencairan</small><br>${badge(stCair)}</div></div><div class="doc-list">${docsHtml}</div><div class="doc-group-head" style="border-top:1px solid #e8f1f7;border-bottom:0"><div class="group-reason"><b>Total dokumen:</b> ${(g.docs||[]).length} file</div><div></div><div></div>${actions}</div></td></tr>`;
}
async function validKegiatanDokumen(idKegiatan){
  const docs = (dashboard?.dokumen || []).filter(d => String(d.id_kegiatan) === String(idKegiatan));
  if(!docs.length){ alert('Belum ada dokumen untuk kegiatan ini.'); return; }
  showLoading('Memvalidasi dokumen kegiatan...');
  try{
    for(const d of docs){
      if(String(d.status_verifikasi || '').toUpperCase() !== 'VALID'){
        const r = await apiPost({action:'verifyDokumen', user:currentUser, id_dokumen:d.id_dokumen, status_verifikasi:'VALID', catatan_admin:''});
        if(!r.success) throw new Error(r.message);
      }
    }
    alert('Dokumen kegiatan sudah dinyatakan valid.');
    await loadDashboard(false);
  }catch(e){ alert(e.message || 'Gagal validasi dokumen.'); }
  finally{ hideLoading(); }
}
async function perbaikanKegiatanDokumen(idKegiatan){
  const catatan = prompt('Alasan perbaikan dokumen wajib diisi:');
  if(!catatan) return;
  const docs = (dashboard?.dokumen || []).filter(d => String(d.id_kegiatan) === String(idKegiatan));
  if(!docs.length){ alert('Belum ada dokumen untuk kegiatan ini.'); return; }
  showLoading('Mengirim status perbaikan kegiatan...');
  try{
    for(const d of docs){
      const r = await apiPost({action:'verifyDokumen', user:currentUser, id_dokumen:d.id_dokumen, status_verifikasi:'PERBAIKAN', catatan_admin:catatan});
      if(!r.success) throw new Error(r.message);
    }
    alert('Status perbaikan sudah dikirim ke bidang.');
    await loadDashboard(false);
  }catch(e){ alert(e.message || 'Gagal mengirim perbaikan.'); }
  finally{ hideLoading(); }
}
function addUploadRow(){
  const wrap = document.getElementById("uploadRows");
  const div = document.createElement("div");
  div.className = "doc-upload-row";
  div.innerHTML = `<div class="field"><label>Jenis Dokumen</label><select class="jenisDok"><option>Berita Acara</option><option>Daftar Hadir</option><option>Dokumentasi</option><option>Kwitansi</option><option>Surat Tugas</option><option>Dokumen Lainnya</option></select></div><div class="field"><label>File Dokumen</label><input type="file" class="fileDok"></div><button class="btn-red" onclick="removeUploadRow(this)" type="button">Hapus</button>`;
  wrap.appendChild(div);
}
