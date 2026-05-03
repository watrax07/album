const DATA_URL = "panini_mundial_2026_base_corregida.json";
const STORAGE_KEY_PREFIX = "mundial-2026-album-state";

const state = {
  stickers: [],
  owned: new Set(),
  view: "missing",
  search: "",
  user: null,
  client: null,
  saving: false
};

const els = {
  setupPanel: document.querySelector("#setupPanel"),
  authPanel: document.querySelector("#authPanel"),
  appPanel: document.querySelector("#appPanel"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authMessage: document.querySelector("#authMessage"),
  signupButton: document.querySelector("#signupButton"),
  logoutButton: document.querySelector("#logoutButton"),
  userEmail: document.querySelector("#userEmail"),
  ownedCount: document.querySelector("#ownedCount"),
  totalCount: document.querySelector("#totalCount"),
  searchInput: document.querySelector("#searchInput"),
  resultCount: document.querySelector("#resultCount"),
  viewTitle: document.querySelector("#viewTitle"),
  stickerList: document.querySelector("#stickerList"),
  template: document.querySelector("#stickerTemplate"),
  downloadWord: document.querySelector("#downloadWord"),
  downloadPdf: document.querySelector("#downloadPdf"),
  resetAll: document.querySelector("#resetAll")
};

init();

async function init() {
  bindEvents();

  if (!hasSupabaseConfig()) {
    showSetup();
    return;
  }

  state.client = window.supabase.createClient(
    window.ALBUM_SUPABASE.url,
    window.ALBUM_SUPABASE.anonKey
  );

  const { data } = await state.client.auth.getSession();
  state.user = data.session?.user || null;

  state.client.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    await loadForCurrentUser();
  });

  await loadForCurrentUser();
}

function hasSupabaseConfig() {
  return Boolean(
    window.supabase &&
    window.ALBUM_SUPABASE?.url &&
    window.ALBUM_SUPABASE?.anonKey &&
    !window.ALBUM_SUPABASE.url.includes("TU-PROYECTO") &&
    !window.ALBUM_SUPABASE.anonKey.includes("TU-ANON-KEY")
  );
}

async function loadForCurrentUser() {
  if (!state.user) {
    showAuth();
    return;
  }

  showApp();
  els.userEmail.textContent = state.user.email || "";
  els.resultCount.textContent = "Cargando...";

  try {
    await loadCatalog();
    await loadOwnedFromCloud();
    render();
  } catch (error) {
    els.resultCount.textContent = "Error";
    els.stickerList.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function loadCatalog() {
  if (state.stickers.length) return;

  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error("No se pudo cargar el catalogo");
  const data = await response.json();
  state.stickers = data.map(normalizeSticker);
}

async function loadOwnedFromCloud() {
  const { data, error } = await state.client
    .from("user_stickers")
    .select("sticker_code")
    .eq("owned", true);

  if (error) throw error;
  state.owned = new Set((data || []).map((row) => row.sticker_code));
  localStorage.setItem(getLocalKey(), JSON.stringify({ owned: [...state.owned] }));
}

function normalizeSticker(item) {
  const code = String(item.codigo);
  const country = String(item.pais || "Sin pais");
  const number = Number(item.numero_global);

  return {
    id: code,
    number,
    code,
    sigla: String(item.sigla || ""),
    country,
    group: String(item.grupo || ""),
    type: String(item.tipo || ""),
    page: Number(item.pagina_estimada || 0),
    title: compactCode(code)
  };
}

function bindEvents() {
  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await signIn();
  });

  els.signupButton.addEventListener("click", signUp);
  els.logoutButton.addEventListener("click", signOut);

  els.searchInput.addEventListener("input", () => {
    state.search = els.searchInput.value.trim().toLowerCase();
    render();
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item === button));
      render();
    });
  });

  els.stickerList.addEventListener("click", async (event) => {
    const row = event.target.closest(".sticker-chip");
    if (!row || state.saving) return;
    await toggleOwned(row.dataset.id);
  });

  els.downloadWord.addEventListener("click", downloadWord);
  els.downloadPdf.addEventListener("click", downloadPdf);

  els.resetAll.addEventListener("click", async () => {
    if (!confirm("Reiniciar tu avance?")) return;
    await clearOwned();
  });
}

async function signIn() {
  setAuthMessage("");
  const { error } = await state.client.auth.signInWithPassword({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value
  });

  if (error) setAuthMessage(error.message);
}

async function signUp() {
  setAuthMessage("");
  const { data, error } = await state.client.auth.signUp({
    email: els.authEmail.value.trim(),
    password: els.authPassword.value,
    options: {
      emailRedirectTo: window.location.href
    }
  });

  if (error) {
    setAuthMessage(error.message);
    return;
  }

  if (!data.session) {
    setAuthMessage("Cuenta creada. Revisa tu correo para confirmar el acceso.");
  }
}

async function signOut() {
  await state.client.auth.signOut();
  state.owned.clear();
  render();
}

function setAuthMessage(message) {
  els.authMessage.textContent = message;
}

function showSetup() {
  els.setupPanel.classList.remove("hidden");
  els.authPanel.classList.add("hidden");
  els.appPanel.classList.add("hidden");
}

function showAuth() {
  els.setupPanel.classList.add("hidden");
  els.authPanel.classList.remove("hidden");
  els.appPanel.classList.add("hidden");
}

function showApp() {
  els.setupPanel.classList.add("hidden");
  els.authPanel.classList.add("hidden");
  els.appPanel.classList.remove("hidden");
}

function render() {
  if (!state.stickers.length) return;

  const visible = getVisibleStickers();
  const owned = state.owned.size;
  const total = state.stickers.length;

  els.ownedCount.textContent = owned;
  els.totalCount.textContent = `/ ${total}`;
  els.viewTitle.textContent = getViewLabel();
  els.resultCount.textContent = `${visible.length} estampas`;

  renderList(visible);
}

function renderList(stickers) {
  els.stickerList.innerHTML = "";

  if (!stickers.length) {
    const message = state.view === "missing"
      ? "No hay faltantes con esta busqueda."
      : state.view === "owned"
        ? "Todavia no has marcado estampas aqui."
        : "No hay estampas con esta busqueda.";
    els.stickerList.innerHTML = `<div class="empty">${message}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  groupByCountry(stickers).forEach(({ country, items }) => {
    const section = document.createElement("section");
    section.className = "country-section";

    const title = document.createElement("h3");
    title.className = "country-title";
    title.innerHTML = `<strong>${escapeHtml(country)}</strong><span>${items.length}</span>`;

    const grid = document.createElement("div");
    grid.className = "chip-grid";

    items.forEach((sticker) => {
      const node = els.template.content.firstElementChild.cloneNode(true);
      const owned = state.owned.has(sticker.id);
      node.dataset.id = sticker.id;
      node.classList.toggle("owned", owned);
      node.querySelector("strong").textContent = sticker.title;
      node.querySelector(".sticker-text span").textContent = `#${pad(sticker.number)}`;
      grid.append(node);
    });

    section.append(title, grid);
    fragment.append(section);
  });

  els.stickerList.append(fragment);
}

function getVisibleStickers() {
  return state.stickers.filter((sticker) => {
    const owned = state.owned.has(sticker.id);
    if (state.view === "missing" && owned) return false;
    if (state.view === "owned" && !owned) return false;
    if (!state.search) return true;

    return `${sticker.number} ${sticker.code} ${sticker.sigla} ${sticker.country} ${sticker.group} ${sticker.type}`
      .toLowerCase()
      .includes(state.search);
  });
}

async function toggleOwned(id) {
  const wasOwned = state.owned.has(id);
  state.saving = true;

  if (wasOwned) {
    state.owned.delete(id);
  } else {
    state.owned.add(id);
  }
  render();

  const { error } = wasOwned
    ? await state.client.from("user_stickers").delete().eq("sticker_code", id)
    : await state.client.from("user_stickers").upsert({
      user_id: state.user.id,
      sticker_code: id,
      owned: true,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,sticker_code" });

  state.saving = false;

  if (error) {
    if (wasOwned) state.owned.add(id);
    else state.owned.delete(id);
    render();
    alert(`No se pudo guardar: ${error.message}`);
    return;
  }

  localStorage.setItem(getLocalKey(), JSON.stringify({ owned: [...state.owned] }));
}

async function clearOwned() {
  const previous = new Set(state.owned);
  state.owned.clear();
  render();

  const { error } = await state.client.from("user_stickers").delete().neq("sticker_code", "");

  if (error) {
    state.owned = previous;
    render();
    alert(`No se pudo reiniciar: ${error.message}`);
    return;
  }

  localStorage.removeItem(getLocalKey());
}

function groupByCountry(stickers) {
  const grouped = new Map();
  stickers.forEach((sticker) => {
    if (!grouped.has(sticker.country)) grouped.set(sticker.country, []);
    grouped.get(sticker.country).push(sticker);
  });

  return [...grouped.entries()].map(([country, items]) => ({ country, items }));
}

function getLocalKey() {
  return `${STORAGE_KEY_PREFIX}-${state.user?.id || "guest"}`;
}

function downloadWord() {
  const report = buildReportRows();
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; color: #18231d; }
          h1 { color: #117c55; }
          table { width: 100%; border-collapse: collapse; }
          td, th { border: 1px solid #ddd; padding: 6px; font-size: 11px; }
          th { background: #117c55; color: #fff; }
          tr.owned td { color: #117c55; font-weight: bold; }
          tr.missing td { color: #c4483a; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Album Mundial 2026</h1>
        <p>Tengo ${state.owned.size} de ${state.stickers.length}. Vista exportada: ${getViewLabel()}.</p>
        <table>
          <thead><tr><th>#</th><th>Estampa</th><th>Seccion</th><th>Estado</th></tr></thead>
          <tbody>${report.map((row) => `<tr class="${row.owned ? "owned" : "missing"}"><td>${pad(row.number)}</td><td>${escapeHtml(row.code)}</td><td>${escapeHtml(row.country)}</td><td>${row.status}</td></tr>`).join("")}</tbody>
        </table>
      </body>
    </html>
  `;
  downloadBlob(new Blob([html], { type: "application/msword" }), "album-mundial-2026.doc");
}

function downloadPdf() {
  const rows = buildReportRows();
  const lines = [
    { text: "Album Mundial 2026", color: "black", size: 16 },
    { text: `Tengo ${state.owned.size} de ${state.stickers.length}`, color: "black", size: 11 },
    { text: `Vista: ${getViewLabel()}`, color: "black", size: 11 },
    { text: "", color: "black", size: 10 },
    ...rows.map((row) => ({
      text: `${row.status}  #${pad(row.number)}  ${row.code}  ${row.country}`,
      color: row.owned ? "green" : "red",
      size: 10
    }))
  ];
  downloadBlob(new Blob([createPdf(lines)], { type: "application/pdf" }), "album-mundial-2026.pdf");
}

function buildReportRows() {
  return getVisibleStickers().map((sticker) => ({
    number: sticker.number,
    code: sticker.code,
    country: sticker.country,
    owned: state.owned.has(sticker.id),
    status: state.owned.has(sticker.id) ? "Tengo" : "Falta"
  }));
}

function createPdf(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 42;
  const lineHeight = 14;
  const maxLines = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pages = [];

  for (let i = 0; i < lines.length; i += maxLines) {
    pages.push(lines.slice(i, i + maxLines));
  }

  const objects = [];
  const addObject = (content) => {
    objects.push(content);
    return objects.length;
  };

  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];

  pages.forEach((pageLines) => {
    const commands = ["BT", `${margin} ${pageHeight - margin} Td`];
    pageLines.forEach((line, index) => {
      const item = typeof line === "string" ? { text: line, color: "black", size: 10 } : line;
      if (index > 0) commands.push(`0 -${lineHeight} Td`);
      commands.push(`${pdfColor(item.color)} rg`);
      commands.push(`/F1 ${item.size || 10} Tf`);
      commands.push(`(${escapePdf(item.text)}) Tj`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });

  const pagesId = addObject("");
  pageIds.forEach((pageId) => {
    objects[pageId - 1] = objects[pageId - 1].replace("/Parent 0 0 R", `/Parent ${pagesId} 0 R`);
  });
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getViewLabel() {
  if (state.view === "missing") return "Me faltan";
  if (state.view === "owned") return "Ya tengo";
  return "Todas";
}

function pdfColor(color) {
  if (color === "green") return "0.07 0.49 0.33";
  if (color === "red") return "0.77 0.22 0.18";
  return "0.09 0.14 0.11";
}

function compactCode(code) {
  const match = String(code).match(/^([A-Za-z]+)(\d.*)$/);
  return match ? `${match[1].toUpperCase()} ${match[2]}` : String(code).toUpperCase();
}

function pad(value) {
  return String(value).padStart(3, "0");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapePdf(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\()]/g, "\\$&")
    .slice(0, 105);
}
