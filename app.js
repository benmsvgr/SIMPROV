const API_URL = "https://script.google.com/macros/s/AKfycbwfTj4Yp_jWezxEzae5jeCKEd33RgJ1qGbpKeodE1IlPT713FAwWvKNnQ8x-rywkxcXPw/exec";

let currentUser = null;
let currentDashboard = null;

function rupiah(num) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(num || 0));
}

function setButtonLoading(buttonId, loadingText, normalText, isLoading) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;

  btn.disabled = isLoading;
  btn.innerText = isLoading ? loadingText : normalText;
}

async function apiPost(payload) {
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return await res.json();
}

async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!username || !password) {
    msg.innerHTML = "Username dan password wajib diisi.";
    return;
  }

  msg.innerHTML = "";
  setButtonLoading("loginBtn", "Memproses...", "Login", true);

  try {
    const result = await apiPost({
      action: "login",
      username,
      password
    });

    if (!result.success) {
      msg.innerHTML = result.message;
      setButtonLoading("loginBtn", "Memproses...", "Login", false);
      return;
    }

    currentUser = result.user;
    localStorage.setItem("siporbo_user", JSON.stringify(currentUser));

    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("appPage").classList.remove("hidden");

    await loadDashboard();

  } catch (err) {
    msg.innerHTML = "Gagal konek ke server. Cek URL Apps Script / deployment.";
    console.error(err);
  }

  setButtonLoading("loginBtn", "Memproses...", "Login", false);
}

async function loadDashboard() {
  try {
    const result = await apiPost({
      action: "getDashboard",
      user: currentUser
    });

    if (!result.success) {
      alert(result.message);
      return;
    }

    currentDashboard = result;

    document.getElementById("userInfo").innerText =
      `${currentUser.nama} - ${currentUser.nama_bidang || currentUser.id_bidang}`;

    renderSummary();
    renderPaket();
    renderAdminPanel();

  } catch (err) {
    alert("Gagal memuat dashboard.");
    console.error(err);
  }
}

function renderSummary() {
  const isAdmin = String(currentUser.id_bidang).toUpperCase() === "ADMIN";

  if (isAdmin) {
    const totalPagu = currentDashboard.rekap.reduce((s, r) => s + Number(r.pagu || 0), 0);
    const totalInput = currentDashboard.rekap.reduce((s, r) => s + Number(r.total_input || 0), 0);

    document.getElementById("paguBidang").innerText = rupiah(totalPagu);
    document.getElementById("totalInput").innerText = rupiah(totalInput);
    document.getElementById("sisaPagu").innerText = rupiah(totalPagu - totalInput);
    document.getElementById("statusAkses").innerText = "ADMIN";
    return;
  }

  const rekap = currentDashboard.rekap.find(r =>
    String(r.id_bidang).trim() === String(currentUser.id_bidang).trim()
  );

  document.getElementById("paguBidang").innerText = rupiah(rekap?.pagu || 0);
  document.getElementById("totalInput").innerText = rupiah(rekap?.total_input || 0);
  document.getElementById("sisaPagu").innerText = rupiah(rekap?.sisa_pagu || 0);
  document.getElementById("statusAkses").innerText = rekap?.status_akses || "-";
}

function renderPaket() {
  const tbody = document.getElementById("paketBody");
  tbody.innerHTML = "";

  if (!currentDashboard.pakets || currentDashboard.pakets.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty">Belum ada data paket</td>
      </tr>
    `;
    return;
  }

  const bidangMap = {};
  currentDashboard.bidangs.forEach(b => {
    bidangMap[String(b.id_bidang).trim()] = b.nama_bidang;
  });

  currentDashboard.pakets.forEach(p => {
    const idBidang = String(p.id_bidang || "").trim();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id_paket || ""}</td>
      <td>${bidangMap[idBidang] || idBidang}</td>
      <td>${p.rincian_kebutuhan || ""}</td>
      <td>${p.keterangan || ""}</td>
      <td>${p.volume || ""}</td>
      <td>${p.satuan || ""}</td>
      <td>${rupiah(p.harga_satuan || 0)}</td>
      <td><b>${rupiah(p.jumlah || 0)}</b></td>
      <td><span class="badge badge-aman">${p.status || "DRAFT"}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminPanel() {
  const isAdmin = String(currentUser.id_bidang).toUpperCase() === "ADMIN";
  const adminPanel = document.getElementById("adminPanel");
  const bidangList = document.getElementById("bidangList");
  const inputBidang = document.getElementById("inputBidang");

  if (!isAdmin) {
    adminPanel.classList.add("hidden");
    document.querySelectorAll(".admin-only").forEach(el => el.classList.add("hidden"));
    return;
  }

  adminPanel.classList.remove("hidden");
  document.querySelectorAll(".admin-only").forEach(el => el.classList.remove("hidden"));

  bidangList.innerHTML = "";
  inputBidang.innerHTML = "";

  currentDashboard.rekap.forEach(b => {
    const opt = document.createElement("option");
    opt.value = b.id_bidang;
    opt.textContent = b.nama_bidang;
    inputBidang.appendChild(opt);

    const statusClass = b.status_pagu === "MELEBIHI PAGU" ? "badge-lebih" : "badge-aman";

    const row = document.createElement("div");
    row.className = "bidang-row";
    row.innerHTML = `
      <div>
        <b>${b.nama_bidang}</b>
        <small>${b.id_bidang}</small><br>
        <small>Total Input: ${rupiah(b.total_input)} | Sisa: ${rupiah(b.sisa_pagu)}</small><br>
        <span class="badge ${statusClass}">${b.status_pagu}</span>
      </div>

      <div class="input-group">
        <label>Pagu</label>
        <input type="number" value="${b.pagu}" id="pagu_${b.id_bidang}">
      </div>

      <div class="input-group">
        <label>Akses</label>
        <select id="akses_${b.id_bidang}">
          <option value="BUKA" ${b.status_akses === "BUKA" ? "selected" : ""}>BUKA</option>
          <option value="TUTUP" ${b.status_akses === "TUTUP" ? "selected" : ""}>TUTUP</option>
        </select>
      </div>

      <button onclick="updateBidang('${b.id_bidang}')">Simpan</button>
    `;

    bidangList.appendChild(row);
  });
}

async function updateBidang(idBidang) {
  const pagu = document.getElementById(`pagu_${idBidang}`).value;
  const statusAkses = document.getElementById(`akses_${idBidang}`).value;

  try {
    const resPagu = await apiPost({
      action: "updatePaguBidang",
      user: currentUser,
      id_bidang: idBidang,
      pagu
    });

    if (!resPagu.success) {
      alert(resPagu.message);
      return;
    }

    const resStatus = await apiPost({
      action: "updateStatusBidang",
      user: currentUser,
      id_bidang: idBidang,
      status_akses: statusAkses
    });

    if (!resStatus.success) {
      alert(resStatus.message);
      return;
    }

    alert("Bidang berhasil diupdate.");
    await loadDashboard();

  } catch (err) {
    alert("Gagal update bidang.");
    console.error(err);
  }
}

async function savePaket() {
  const isAdmin = String(currentUser.id_bidang).toUpperCase() === "ADMIN";

  const data = {
    id_bidang: isAdmin ? document.getElementById("inputBidang").value : currentUser.id_bidang,
    rincian_kebutuhan: document.getElementById("rincian").value.trim(),
    keterangan: document.getElementById("keterangan").value.trim(),
    volume: document.getElementById("volume").value,
    satuan: document.getElementById("satuan").value.trim(),
    harga_satuan: document.getElementById("harga").value,
    status: "DRAFT"
  };

  const msg = document.getElementById("saveMsg");

  if (!data.rincian_kebutuhan || !data.volume || !data.harga_satuan) {
    msg.innerHTML = "Rincian, volume, dan harga wajib diisi.";
    return;
  }

  msg.innerHTML = "";
  setButtonLoading("saveBtn", "Menyimpan...", "Simpan Paket", true);

  try {
    const result = await apiPost({
      action: "savePaket",
      user: currentUser,
      data
    });

    msg.innerHTML = result.message;

    if (result.success) {
      document.getElementById("rincian").value = "";
      document.getElementById("keterangan").value = "";
      document.getElementById("volume").value = "";
      document.getElementById("satuan").value = "";
      document.getElementById("harga").value = "";

      await loadDashboard();
    }

  } catch (err) {
    msg.innerHTML = "Gagal simpan paket.";
    console.error(err);
  }

  setButtonLoading("saveBtn", "Menyimpan...", "Simpan Paket", false);
}

function logout() {
  localStorage.removeItem("siporbo_user");
  currentUser = null;
  currentDashboard = null;

  document.getElementById("appPage").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");

  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("loginMsg").innerHTML = "";
}

window.onload = async function () {
  const saved = localStorage.getItem("siporbo_user");

  if (saved) {
    currentUser = JSON.parse(saved);

    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("appPage").classList.remove("hidden");

    await loadDashboard();
  }
};
