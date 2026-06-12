const API_URL = "https://script.google.com/macros/s/AKfycbwfTj4Yp_jWezxEzae5jeCKEd33RgJ1qGbpKeodE1IlPT713FAwWvKNnQ8x-rywkxcXPw/exec";
let currentUser = null;
let currentDashboard = null;

function rupiah(num){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(num||0));}
function isAdmin(){return String(currentUser?.id_bidang||"").toUpperCase()==="ADMIN";}
function setButtonLoading(id, loadingText, normalText, loading){const btn=document.getElementById(id); if(!btn)return; btn.disabled=loading; btn.innerText=loading?loadingText:normalText;}
async function apiPost(payload){const res=await fetch(API_URL,{method:"POST",body:JSON.stringify(payload)});return await res.json();}
function badge(text){let cls="badge-info"; const t=String(text||"").toUpperCase(); if(t.includes("AMAN")||t.includes("VALID")||t.includes("SETUJUI")||t.includes("LENGKAP")||t.includes("SIAP")||t.includes("SUDAH")||t==="BUKA") cls="badge-aman"; if(t.includes("TOLAK")||t.includes("MELEBIHI")) cls="badge-tolak"; if(t.includes("MENUNGGU")||t.includes("DRAFT")||t.includes("BELUM")||t.includes("PERBAIKAN")||t==="TUTUP") cls="badge-wait"; return `<span class="badge ${cls}">${text||"-"}</span>`;}

async function login(){
  const username=document.getElementById("username").value.trim();
  const password=document.getElementById("password").value.trim();
  const msg=document.getElementById("loginMsg");
  if(!username||!password){msg.innerHTML="Username dan password wajib diisi.";return;}
  msg.innerHTML=""; setButtonLoading("loginBtn","Memproses...","Login",true);
  try{
    const result=await apiPost({action:"login",username,password});
    if(!result.success){msg.innerHTML=result.message;setButtonLoading("loginBtn","Memproses...","Login",false);return;}
    currentUser=result.user; localStorage.setItem("siporbo_user",JSON.stringify(currentUser));
    document.getElementById("loginPage").classList.add("hidden"); document.getElementById("appPage").classList.remove("hidden");
    await loadDashboard(); showMenu(isAdmin()?"monitoring":"anggaran");
  }catch(err){msg.innerHTML="Gagal konek ke server. Cek URL Apps Script / deployment.";console.error(err);} finally{setButtonLoading("loginBtn","Memproses...","Login",false);}
}

async function loadDashboard(){
  try{
    const result=await apiPost({action:"getDashboard",user:currentUser});
    if(!result.success){alert(result.message);return;}
    currentDashboard=result;
    document.getElementById("userInfo").innerText=`${currentUser.nama} - ${currentUser.nama_bidang||currentUser.id_bidang}`;
    document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
    renderSummary(); renderAnggaran(); renderMonitoring(); renderPerencanaan(); renderPencairan(); fillSelects();
  }catch(err){
    console.error(err);
    alert("Gagal memuat dashboard: " + (err.message || err));
  }
}

function showMenu(menu){
  ["monitoring","anggaran","perencanaan","pencairan"].forEach(m=>{
    const page=document.getElementById("page"+m.charAt(0).toUpperCase()+m.slice(1));
    const tab=document.getElementById("tab"+m.charAt(0).toUpperCase()+m.slice(1));
    if(page) page.classList.toggle("hidden",m!==menu);
    if(tab) tab.classList.toggle("active",m===menu);
  });
}

function getBidangName(id){const b=currentDashboard.bidangs.find(x=>String(x.id_bidang).trim()===String(id).trim());return b?b.nama_bidang:id;}
function getKegiatanName(id){const p=currentDashboard.perencanaan.find(x=>String(x.id_kegiatan).trim()===String(id).trim());return p?p.nama_kegiatan:id;}

function renderSummary(){
  if(isAdmin()){
    const totalPagu=currentDashboard.rekap.reduce((s,r)=>s+Number(r.pagu||0),0);
    const total=currentDashboard.rekap.reduce((s,r)=>s+Number(r.total_perencanaan||0),0);
    document.getElementById("paguBidang").innerText=rupiah(totalPagu);
    document.getElementById("totalInput").innerText=rupiah(total);
    document.getElementById("sisaPagu").innerText=rupiah(totalPagu-total);
    document.getElementById("statusAkses").innerText="ADMIN"; return;
  }
  const r=currentDashboard.rekap.find(x=>String(x.id_bidang).trim()===String(currentUser.id_bidang).trim());
  document.getElementById("paguBidang").innerText=rupiah(r?.pagu||0);
  document.getElementById("totalInput").innerText=rupiah(r?.total_perencanaan||0);
  document.getElementById("sisaPagu").innerText=rupiah(r?.sisa_pagu||0);
  document.getElementById("statusAkses").innerText=r?.status_akses||"-";
}

function renderAnggaran(){
  const panel=document.getElementById("adminAnggaranPanel");
  const list=document.getElementById("bidangList");
  if(isAdmin()){
    panel.classList.remove("hidden"); list.innerHTML="";
    currentDashboard.rekap.forEach(b=>{
      const row=document.createElement("div"); row.className="bidang-row";
      row.innerHTML=`<div><b>${b.nama_bidang}</b><small>${b.id_bidang}</small><br><small>Total: ${rupiah(b.total_perencanaan)} | Sisa: ${rupiah(b.sisa_pagu)} | Kegiatan: ${b.jumlah_kegiatan}</small><br>${badge(b.status_pagu)}</div><div class="input-group"><label>Pagu</label><input type="number" value="${b.pagu}" id="pagu_${b.id_bidang}"></div><div class="input-group"><label>Akses</label><select id="akses_${b.id_bidang}"><option value="BUKA" ${b.status_akses==="BUKA"?"selected":""}>BUKA</option><option value="TUTUP" ${b.status_akses==="TUTUP"?"selected":""}>TUTUP</option></select></div><button onclick="updateBidang('${b.id_bidang}')">Simpan</button>`;
      list.appendChild(row);
    });
  } else panel.classList.add("hidden");
  const r=isAdmin()?null:currentDashboard.rekap.find(x=>String(x.id_bidang).trim()===String(currentUser.id_bidang).trim());
  document.getElementById("ringkasanBidang").innerHTML = isAdmin()?`<div class="detail-item"><span>Mode</span><b>Admin</b></div><div class="detail-item"><span>Jumlah Bidang</span><b>${currentDashboard.rekap.length}</b></div><div class="detail-item"><span>Total Kegiatan</span><b>${currentDashboard.perencanaan.length}</b></div>`:`<div class="detail-item"><span>Bidang</span><b>${r?.nama_bidang||"-"}</b></div><div class="detail-item"><span>Jumlah Kegiatan</span><b>${r?.jumlah_kegiatan||0}</b></div><div class="detail-item"><span>Dokumen Upload</span><b>${r?.jumlah_dokumen||0}</b></div><div class="detail-item"><span>Dokumen Valid</span><b>${r?.dokumen_valid||0}</b></div><div class="detail-item"><span>Status Perencanaan</span><b>${r?.status_progress_perencanaan||"-"}</b></div><div class="detail-item"><span>Status Pencairan</span><b>${r?.status_progress_pencairan||"-"}</b></div>`;
}

function renderMonitoring(){
  const wrap=document.getElementById("monitoringCards"); if(!isAdmin()){wrap.innerHTML="";return;}
  wrap.innerHTML="";
  currentDashboard.rekap.forEach(r=>{
    const pctPagu = r.pagu>0 ? Math.min(100, Math.round((Number(r.total_perencanaan||0)/Number(r.pagu))*100)) : 0;
    const pctDok = r.jumlah_dokumen>0 ? Math.round((Number(r.dokumen_valid||0)/Number(r.jumlah_dokumen))*100) : 0;
    const card=document.createElement("div"); card.className="monitor-card";
    card.innerHTML=`<div class="monitor-head"><div><div class="monitor-title">${r.nama_bidang}</div><small>${r.id_bidang}</small></div>${badge(r.status_akses)}</div><div class="progress-wrap"><div class="progress-label"><span>Perencanaan</span><span>${pctPagu}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pctPagu}%"></div></div></div><div class="progress-wrap"><div class="progress-label"><span>Dokumen Valid</span><span>${pctDok}%</span></div><div class="progress-bar"><div class="progress-fill" style="width:${pctDok}%"></div></div></div><p><b>Pagu:</b> ${rupiah(r.pagu)}<br><b>Total Rencana:</b> ${rupiah(r.total_perencanaan)}<br><b>Sisa:</b> ${rupiah(r.sisa_pagu)}<br><b>Kegiatan:</b> ${r.jumlah_kegiatan} | <b>Disetujui:</b> ${r.kegiatan_disetujui}<br><b>Progress:</b> ${r.status_progress_perencanaan}<br><b>Pencairan:</b> ${r.status_progress_pencairan}</p>`;
    wrap.appendChild(card);
  });
}

function fillSelects(){
  const inputBidang=document.getElementById("inputBidang"); inputBidang.innerHTML="";
  currentDashboard.bidangs.forEach(b=>{const o=document.createElement("option");o.value=b.id_bidang;o.textContent=b.nama_bidang;inputBidang.appendChild(o);});
  const dok=document.getElementById("dokKegiatan"); dok.innerHTML="";
  const allowed=currentDashboard.perencanaan.filter(p=>String(p.status_perencanaan).toUpperCase()==="DISETUJUI" || isAdmin());
  allowed.forEach(p=>{const o=document.createElement("option");o.value=p.id_kegiatan;o.textContent=`${getBidangName(p.id_bidang)} - ${p.nama_kegiatan}`;dok.appendChild(o);});
}

function renderPerencanaan(){
  const tbody=document.getElementById("perencanaanBody"); tbody.innerHTML="";
  if(!currentDashboard.perencanaan.length){tbody.innerHTML=`<tr><td colspan="10" class="empty">Belum ada data perencanaan</td></tr>`;return;}
  currentDashboard.perencanaan.forEach(p=>{
    const adminActions=isAdmin()?`<button class="btn-small btn-ok" onclick="updatePerencanaanStatus('${p.id_kegiatan}','DISETUJUI')">Setujui</button><button class="btn-small btn-warn" onclick="updatePerencanaanStatus('${p.id_kegiatan}','DITOLAK')">Tolak</button>`:`${String(p.status_perencanaan).toUpperCase()==="DRAFT"?`<button class="btn-small" onclick="updatePerencanaanStatus('${p.id_kegiatan}','DIAJUKAN')">Ajukan</button>`:""}`;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${p.id_kegiatan||""}</td><td>${getBidangName(p.id_bidang)}</td><td>${p.nama_kegiatan||""}</td><td>${p.rincian_kebutuhan||""}</td><td>${p.volume||""}</td><td>${p.satuan||""}</td><td>${rupiah(p.harga_satuan||0)}</td><td><b>${rupiah(p.jumlah||0)}</b></td><td>${badge(p.status_perencanaan||"DRAFT")}</td><td>${adminActions}</td>`;
    tbody.appendChild(tr);
  });
}

function renderPencairan(){
  const tbody=document.getElementById("dokumenBody"); tbody.innerHTML="";
  if(!currentDashboard.dokumen.length){tbody.innerHTML=`<tr><td colspan="8" class="empty">Belum ada dokumen</td></tr>`;return;}
  currentDashboard.dokumen.forEach(d=>{
    const penc=currentDashboard.pencairan.find(p=>String(p.id_kegiatan).trim()===String(d.id_kegiatan).trim());
    const actions=isAdmin()?`<button class="btn-small btn-ok" onclick="verifikasiDokumen('${d.id_dokumen}','VALID')">Valid</button><button class="btn-small btn-warn" onclick="verifikasiDokumen('${d.id_dokumen}','PERBAIKAN')">Perbaikan</button><button class="btn-small btn-warn" onclick="verifikasiDokumen('${d.id_dokumen}','DITOLAK')">Tolak</button><button class="btn-small btn-ok" onclick="updatePencairan('${d.id_kegiatan}','SIAP DICAIRKAN')">Siap</button><button class="btn-small btn-ok" onclick="updatePencairan('${d.id_kegiatan}','SUDAH DICAIRKAN')">Sudah Cair</button>`:"-";
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${getBidangName(d.id_bidang)}</td><td>${getKegiatanName(d.id_kegiatan)}</td><td>${d.jenis_dokumen||""}</td><td><a class="file-link" href="${d.url_file}" target="_blank">${d.nama_file||"Buka File"}</a></td><td>${badge(d.status_verifikasi||"MENUNGGU")}</td><td>${badge(penc?.status_pencairan||"MENUNGGU VERIFIKASI")}</td><td>${d.catatan_admin||penc?.catatan_admin||"-"}</td><td>${actions}</td>`;
    tbody.appendChild(tr);
  });
}

async function updateBidang(idBidang){
  const pagu=document.getElementById(`pagu_${idBidang}`).value; const statusAkses=document.getElementById(`akses_${idBidang}`).value;
  const resPagu=await apiPost({action:"updatePaguBidang",user:currentUser,id_bidang:idBidang,pagu}); if(!resPagu.success){alert(resPagu.message);return;}
  const resStatus=await apiPost({action:"updateStatusBidang",user:currentUser,id_bidang:idBidang,status_akses:statusAkses}); if(!resStatus.success){alert(resStatus.message);return;}
  alert("Bidang berhasil diupdate."); await loadDashboard();
}

async function savePerencanaan(status){
  const data={id_bidang:isAdmin()?document.getElementById("inputBidang").value:currentUser.id_bidang,nama_kegiatan:document.getElementById("namaKegiatan").value.trim(),rincian_kebutuhan:document.getElementById("rincian").value.trim(),keterangan:document.getElementById("keterangan").value.trim(),volume:document.getElementById("volume").value,satuan:document.getElementById("satuan").value.trim(),harga_satuan:document.getElementById("harga").value,status_perencanaan:status};
  const msg=document.getElementById("saveMsg"); if(!data.nama_kegiatan||!data.rincian_kebutuhan||!data.volume||!data.harga_satuan){msg.innerHTML="Nama kegiatan, rincian, volume, dan harga wajib diisi.";return;}
  setButtonLoading("saveBtn","Menyimpan...","Simpan Draft",true); setButtonLoading("ajukanBtn","Menyimpan...","Simpan & Ajukan",true);
  const result=await apiPost({action:"savePerencanaan",user:currentUser,data}); msg.innerHTML=result.message;
  setButtonLoading("saveBtn","Menyimpan...","Simpan Draft",false); setButtonLoading("ajukanBtn","Menyimpan...","Simpan & Ajukan",false);
  if(result.success){["namaKegiatan","rincian","keterangan","volume","satuan","harga"].forEach(id=>document.getElementById(id).value=""); await loadDashboard();}
}

async function updatePerencanaanStatus(id,status){
  const result=await apiPost({action:"updatePerencanaanStatus",user:currentUser,id_kegiatan:id,status_perencanaan:status});
  alert(result.message); if(result.success) await loadDashboard();
}

function fileToBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader(); r.onload=()=>resolve(String(r.result).split(",")[1]); r.onerror=reject; r.readAsDataURL(file);});}
async function uploadDokumen(){
  const file=document.getElementById("fileDokumen").files[0]; const msg=document.getElementById("uploadMsg");
  if(!document.getElementById("dokKegiatan").value){msg.innerHTML="Pilih kegiatan dulu.";return;}
  if(!file){msg.innerHTML="Pilih file dulu.";return;}
  setButtonLoading("uploadBtn","Mengupload...","Upload Dokumen",true);
  const base64=await fileToBase64(file);
  const result=await apiPost({action:"uploadDokumen",user:currentUser,id_kegiatan:document.getElementById("dokKegiatan").value,jenis_dokumen:document.getElementById("jenisDokumen").value,file_name:file.name,mime_type:file.type,base64});
  msg.innerHTML=result.message; setButtonLoading("uploadBtn","Mengupload...","Upload Dokumen",false); if(result.success){document.getElementById("fileDokumen").value=""; await loadDashboard();}
}
async function verifikasiDokumen(id,status){const catatan=prompt("Catatan admin (opsional):","")||""; const r=await apiPost({action:"verifikasiDokumen",user:currentUser,id_dokumen:id,status_verifikasi:status,catatan_admin:catatan}); alert(r.message); if(r.success) await loadDashboard();}
async function updatePencairan(id,status){const catatan=prompt("Catatan pencairan (opsional):","")||""; const r=await apiPost({action:"updatePencairanStatus",user:currentUser,id_kegiatan:id,status_pencairan:status,catatan_admin:catatan}); alert(r.message); if(r.success) await loadDashboard();}
function logout(){localStorage.removeItem("siporbo_user"); currentUser=null; currentDashboard=null; document.getElementById("appPage").classList.add("hidden"); document.getElementById("loginPage").classList.remove("hidden"); document.getElementById("username").value=""; document.getElementById("password").value=""; document.getElementById("loginMsg").innerHTML="";}
window.onload=async function(){const saved=localStorage.getItem("siporbo_user"); if(saved){currentUser=JSON.parse(saved); document.getElementById("loginPage").classList.add("hidden"); document.getElementById("appPage").classList.remove("hidden"); await loadDashboard(); showMenu(isAdmin()?"monitoring":"anggaran");}};
