/* =========================================================
Constants and Configurations For The APi
========================================================= */

const BASE_URL = "https://genshin.jmp.blue";
const PAGE_SIZE = 24;
const MIN_LOADING_MS = 250;

const CATEGORIES = {
  all: ["characters", "weapons", "artifacts"],
  characters: ["characters"],
  weapons: ["weapons"],
  artifacts: ["artifacts"],
};

/* =========================
   DOM ELEMENTS
========================= */
const searchForm = document.getElementById("searchForm");
const searchWrap = document.getElementById("searchWrap");
const searchPill = document.getElementById("searchPill");
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");

const searchPanel = document.getElementById("searchPanel");
const spScope = document.getElementById("spScope");
const spMatch = document.getElementById("spMatch");
const spSort = document.getElementById("spSort");
const spClose = document.getElementById("spClose");
const spError = document.getElementById("spError");

const loadMoreBtn = document.getElementById("loadMoreBtn");
const randomBtn = document.getElementById("randomBtn");

const resultsEl = document.getElementById("results");
const errorBox = document.getElementById("errorBox");
const statusBar = document.getElementById("statusBar");

const navIconButtons = document.querySelectorAll(".navicons__item");
const sortPills = document.querySelectorAll(".pill");

const themeToggle = document.getElementById("themeToggle");
const docsBtn = document.getElementById("docsBtn");

const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalPrimary = document.getElementById("modalPrimary");
const modalTitle = document.getElementById("modalTitle");
const modalSubtitle = document.getElementById("modalSubtitle");
const modalBody = document.getElementById("modalBody");

const docsOverlay = document.getElementById("docsOverlay");
const docsClose = document.getElementById("docsClose");
const docsPrimary = document.getElementById("docsPrimary");

const quickButtons = document.querySelectorAll("[data-quick]");

/* =========================
   STATE of the elements(diff categories, sort, query, etc)
========================= */
let activeCategory = "characters";
let activeSort = "az";
let currentQuery = "";
let currentMatchMode = "contains"; // contains | starts

const listCache = new Map(); // type -> [ids]
let filteredItems = [];
let renderedCount = 0;

let isLoading = false;
let loadingStartedAt = 0;

/* NEW: Vision cache so we fetch each character detail once */
const visionCache = new Map(); // id -> "cryo" | "pyro" | ...

/* =========================
   UTILITIES
========================= */
function normalizeQuery(q) {
  return q.trim().replace(/\s+/g, " ");
}

function validateQuery(q) {
  if (!q) return { ok: false, message: "Invalid input: search field is empty." };
  const allowed = /^[a-zA-Z0-9\s\-']+$/;
  if (!allowed.test(q)) {
    return {
      ok: false,
      message: "Invalid input: only letters, numbers, spaces, hyphen (-), apostrophe (') are allowed.",
    };
  }
  return { ok: true, message: "" };
}

function showError(msg) {
  errorBox.hidden = false;
  errorBox.textContent = msg;
}
function clearError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function showSpError(msg) {
  spError.hidden = false;
  spError.textContent = msg;
}
function clearSpError() {
  spError.hidden = true;
  spError.textContent = "";
}

function setStatus(text) {
  if (!isLoading) statusBar.textContent = text;
}

function prettyName(id) {
  return id
    .split("-")
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function normVision(v) {
  if (!v) return "";
  return String(v).trim().toLowerCase();
}

/* =========================
   LOADING (forced paint + min duration)
========================= */
function setLoadingOn(text = "Loading…") {
  isLoading = true;
  loadingStartedAt = performance.now();

  searchInput.disabled = true;
  clearBtn.disabled = true;
  loadMoreBtn.disabled = true;
  randomBtn.disabled = true;
  navIconButtons.forEach(b => (b.disabled = true));
  quickButtons.forEach(b => (b.disabled = true));

  statusBar.innerHTML = "";
  const sp = document.createElement("div");
  sp.className = "spinner";
  const t = document.createElement("div");
  t.textContent = text;
  statusBar.appendChild(sp);
  statusBar.appendChild(t);
}

async function setLoadingOff() {
  const elapsed = performance.now() - loadingStartedAt;
  const remain = Math.max(0, MIN_LOADING_MS - elapsed);
  if (remain > 0) await new Promise(r => setTimeout(r, remain));

  isLoading = false;
  searchInput.disabled = false;
  clearBtn.disabled = false;
  loadMoreBtn.disabled = false;
  randomBtn.disabled = false;
  navIconButtons.forEach(b => (b.disabled = false));
  quickButtons.forEach(b => (b.disabled = false));
}

/* =========================
   IMAGES
========================= */
const PLACEHOLDER_SVG =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
    <rect width="100%" height="100%" rx="28" ry="28" fill="rgba(255,255,255,0.10)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
      fill="rgba(255,255,255,0.70)" font-family="system-ui" font-weight="800" font-size="16">
      No Image
    </text>
  </svg>`);

function getAssetUrl(type, id) {
  if (type === "artifacts") return `${BASE_URL}/${type}/${id}/flower-of-life`;
  return `${BASE_URL}/${type}/${id}/icon`;
}

function getModalImageUrl(type, id) {
  if (type === "characters") return `${BASE_URL}/${type}/${id}/card`;
  if (type === "artifacts") return `${BASE_URL}/${type}/${id}/flower-of-life`;
  return `${BASE_URL}/${type}/${id}/icon`;
}

/* =========================
   API, This module provides reusable asynchronous
    helper functions for interacting with a RESTful API. 
    It standardizes how list and detail data are retrieved 
    while incorporating basic error handling and client-side 
    caching to improve performance and reduce redundant network requests.
========================= */
async function fetchList(type) {
  const res = await fetch(`${BASE_URL}/${type}`);
  if (!res.ok) throw new Error(`Failed API call: ${type} list (${res.status})`);
  return res.json();
}

async function fetchDetail(type, id) {
  const res = await fetch(`${BASE_URL}/${type}/${id}`);
  if (!res.ok) throw new Error(`Failed API call: ${type}/${id} (${res.status})`);
  return res.json();
}

async function ensureList(type) {
  if (listCache.has(type)) return listCache.get(type);
  const ids = await fetchList(type);
  listCache.set(type, ids);
  return ids;
}

/* =========================
   DATA PIPELINE, This section defines the core logic used to 
   (1) build a unified list of display items from one or more API resource types, 
   (2) apply user search filtering, 
   (3) apply alphabetical sorting, and 
   (4) load and render results with proper loading and error handling.
========================= */
async function buildItemsForCategory(category) {
  const types = CATEGORIES[category] || CATEGORIES.characters;
  const lists = await Promise.all(types.map((t) => ensureList(t)));

  const items = [];
  types.forEach((type, idx) => {
    const ids = lists[idx] || [];
    ids.forEach((id) => {
      items.push({
        type,
        id,
        label: prettyName(id),
        image: getAssetUrl(type, id),
      });
    });
  });

  return items;
}

function matchesQuery(item, query, mode) {
  if (!query) return true;
  const q = query.toLowerCase();
  const id = item.id.toLowerCase();
  const label = item.label.toLowerCase();
  if (mode === "starts") return id.startsWith(q) || label.startsWith(q);
  return id.includes(q) || label.includes(q);
}

function applyQueryFilter(items, query, mode) {
  if (!query) return items;
  return items.filter((x) => matchesQuery(x, query, mode));
}

function applySort(items) {
  const copy = [...items];
  copy.sort((a, b) => a.id.localeCompare(b.id));
  if (activeSort === "za") copy.reverse();
  return copy;
}

async function loadAndShow(category, query, matchMode, statusLabel) {
  clearError();
  setLoadingOn(statusLabel);

  await new Promise(r => requestAnimationFrame(r));

  try {
    const base = await buildItemsForCategory(category);
    const filtered = applyQueryFilter(base, query, matchMode);
    const sorted = applySort(filtered);

    filteredItems = sorted;

    await setLoadingOff();

    if (!filteredItems.length) {
      resultsEl.innerHTML = "";
      loadMoreBtn.hidden = true;
      showError("No results found. Try a different keyword or scope.");
      return;
    }

    renderedCount = 0;
    renderNextPage();
  } catch (err) {
    await setLoadingOff();
    resultsEl.innerHTML = "";
    loadMoreBtn.hidden = true;
    showError(err.message || "Failed API call.");
  }
}

/* =========================
   ELEMENT AURA (CHARACTERS)
========================= */
function setAuraClass(auraEl, vision) {
  auraEl.classList.remove(
    "aura--cryo","aura--pyro","aura--hydro","aura--electro","aura--dendro","aura--anemo","aura--geo"
  );
  if (!vision) return;

  const cls = `aura--${vision}`;
  auraEl.classList.add(cls);
}

async function ensureVision(id) {
  if (visionCache.has(id)) return visionCache.get(id);

  const data = await fetchDetail("characters", id);
  const v = normVision(data?.vision);
  visionCache.set(id, v || "");
  return v || "";
}

/* When hovering a character card, fetch vision once and apply aura class */
function attachAuraBehavior(card, auraEl, item) {
  if (item.type !== "characters") return;

  // Token prevents old hover fetch from applying if user already left
  let hoverToken = 0;

  card.addEventListener("pointerenter", async () => {
    hoverToken++;
    const token = hoverToken;

    // If already set, done
    const cached = visionCache.get(item.id);
    if (cached) {
      setAuraClass(auraEl, cached);
      return;
    }

    // Optional: show nothing until loaded (keeps it “clean”)
    // If you want a default aura while loading, you could setAuraClass(auraEl, "cryo") etc.

    try {
      const vision = await ensureVision(item.id);
      if (token !== hoverToken) return; // user already left / re-entered
      setAuraClass(auraEl, vision);
    } catch {
      // Ignore vision failure (no aura)
    }
  });

  card.addEventListener("pointerleave", () => {
    hoverToken++;
    // Keep aura class (so next hover is instant) OR clear it:
    // If you want to clear each time, uncomment:
    // setAuraClass(auraEl, "");
  });
}

/* =========================
   DOM RENDER (CARDS + PAGINATION),
   This section is responsible for converting normalized
    item objects into interactive DOM cards, 
    rendering them into the results container, 
    and supporting progressive pagination (“Load More”) for performance and usability.
========================= */
function makeCard(item) {
  const card = document.createElement("article");
  card.className = "card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${item.label}`);

  const media = document.createElement("div");
  media.className = "card__media";

  // NEW: aura overlay layer (only becomes meaningful for characters)
  const aura = document.createElement("div");
  aura.className = "auraLayer";
  media.appendChild(aura);

  const img = document.createElement("img");
  img.className = "card__img";
  img.alt = item.label;
  img.src = item.image;
  img.addEventListener("error", () => (img.src = PLACEHOLDER_SVG));
  media.appendChild(img);

  const body = document.createElement("div");
  body.className = "card__body";

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = item.label;

  const meta = document.createElement("div");
  meta.className = "card__meta";

  const badgeType = document.createElement("span");
  badgeType.className = "badge";
  badgeType.textContent = item.type.toUpperCase();

  const badgeId = document.createElement("span");
  badgeId.className = "badge";
  badgeId.textContent = item.id;

  meta.appendChild(badgeType);
  meta.appendChild(badgeId);

  body.appendChild(title);
  body.appendChild(meta);

  card.appendChild(media);
  card.appendChild(body);

  // NEW: attach aura behavior
  attachAuraBehavior(card, aura, item);

  card.addEventListener("click", () => openDetailModal(item.type, item.id));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openDetailModal(item.type, item.id);
  });

  return card;
}

function renderNextPage() {
  const next = filteredItems.slice(renderedCount, renderedCount + PAGE_SIZE);
  if (renderedCount === 0) resultsEl.innerHTML = "";

  const frag = document.createDocumentFragment();
  next.forEach((it) => frag.appendChild(makeCard(it)));
  resultsEl.appendChild(frag);

  renderedCount += next.length;

  loadMoreBtn.hidden = renderedCount >= filteredItems.length || filteredItems.length === 0;
  setStatus(`Showing ${Math.min(renderedCount, filteredItems.length)} of ${filteredItems.length} in ${activeCategory.toUpperCase()}.`);
}

/* =========================
   MODALS, This module manages an accessible detail
    modal that loads resource-specific data from the API
     and renders it into a structured “hero + key-values + extra section” layout.
      It also enforces loading states, error fallback content, and image fallback behavior.
========================= */
function showModal(overlay) {
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
}
function hideModal(overlay) {
  overlay.hidden = true;
  document.body.style.overflow = "";
}

async function openDetailModal(type, id) {
  clearError();
  showModal(modalOverlay);

  modalTitle.textContent = "Loading…";
  modalSubtitle.textContent = `${type}/${id}`;
  modalBody.innerHTML = `<div class="statusbar"><div class="spinner"></div><div>Loading details…</div></div>`;

  try {
    const data = await fetchDetail(type, id);

    modalTitle.textContent = data.name || prettyName(id);
    modalSubtitle.textContent = `From ${BASE_URL}/${type}/${id}`;

    modalBody.innerHTML = "";

    const hero = document.createElement("div");
    hero.className = "hero";

    const img = document.createElement("img");
    img.className = "hero__img";
    img.alt = modalTitle.textContent;
    img.src = getModalImageUrl(type, id);
    img.addEventListener("error", () => (img.src = PLACEHOLDER_SVG));

    const heroText = document.createElement("div");
    heroText.className = "hero__text";

    const h3 = document.createElement("h3");
    h3.textContent = modalTitle.textContent;

    const desc = document.createElement("p");
    desc.textContent = pickDescription(type, data);

    heroText.appendChild(h3);
    heroText.appendChild(desc);

    hero.appendChild(img);
    hero.appendChild(heroText);
    modalBody.appendChild(hero);

    const kv = document.createElement("div");
    kv.className = "kv";

    pickKeyValues(type, data).forEach(({ k, v }) => {
      const box = document.createElement("div");
      box.className = "kv__item";
      box.innerHTML = `<div class="kv__k">${k}</div><div class="kv__v">${String(v)}</div>`;
      kv.appendChild(box);
    });

    modalBody.appendChild(kv);

    const extra = pickExtraSection(type, data);
    if (extra) {
      const section = document.createElement("div");
      section.className = "section";
      section.innerHTML = `<h4>${extra.title}</h4><p>${extra.text}</p>`;
      modalBody.appendChild(section);
    }

    // NEW: cache vision if character, so hover becomes instant later
    if (type === "characters") {
      const v = normVision(data?.vision);
      if (v) visionCache.set(id, v);
    }
  } catch (err) {
    modalTitle.textContent = "Error";
    modalBody.innerHTML = `<div class="section"><h4>Failed API call</h4><p>${err.message || "Could not load details."}</p></div>`;
  }
}

function pickDescription(type, data) {
  if (!data || typeof data !== "object") return "No description available.";
  if (type === "characters") return data.description || "No description available.";
  if (type === "weapons") return data.description || data.passiveDesc || "No description available.";
  if (type === "artifacts") return data["2-piece_bonus"] || data.description || "No description available.";
  return data.description || "No description available.";
}

function pickKeyValues(type, data) {
  if (!data || typeof data !== "object") return [];
  if (type === "characters") {
    return [
      { k: "Title", v: data.title || "—" },
      { k: "Vision", v: data.vision || "—" },
      { k: "Weapon", v: data.weapon || "—" },
      { k: "Nation", v: data.nation || "—" },
      { k: "Rarity", v: data.rarity ?? "—" },
      { k: "Affiliation", v: data.affiliation || "—" },
    ];
  }
  if (type === "weapons") {
    return [
      { k: "Type", v: data.type || "—" },
      { k: "Rarity", v: data.rarity ?? "—" },
      { k: "Base Attack", v: data.baseAttack ?? "—" },
      { k: "Sub Stat", v: data.subStat || "—" },
      { k: "Passive", v: data.passiveName || "—" },
      { k: "Location", v: data.location || "—" },
    ];
  }
  if (type === "artifacts") {
    return [
      { k: "Rarity", v: Array.isArray(data.rarity) ? data.rarity.join(", ") : (data.rarity ?? "—") },
      { k: "2-Piece Bonus", v: data["2-piece_bonus"] || "—" },
      { k: "4-Piece Bonus", v: data["4-piece_bonus"] || "—" },
      { k: "Circlet", v: data.circlet?.name || "—" },
      { k: "Goblet", v: data.goblet?.name || "—" },
      { k: "Plume", v: data.plume?.name || "—" },
    ];
  }
  return [];
}

function pickExtraSection(type, data) {
  if (!data || typeof data !== "object") return null;
  if (type === "weapons" && data.passiveDesc) return { title: "Passive Description", text: data.passiveDesc };
  if (type === "artifacts" && data["4-piece_bonus"]) return { title: "4-Piece Bonus", text: data["4-piece_bonus"] };
  return null;
}

/* =========================
   SEARCH PANEL, These functions manage a compact “search/filter panel” 
   UI that lets users configure scope (category), 
   matching mode, and sorting. It also performs input validation before 
   applying filters and reloading results.
========================= */
function openSearchPanel() {
  clearSpError();
  spScope.value = activeCategory;
  spMatch.value = currentMatchMode;
  spSort.value = activeSort;

  searchPill.classList.add("is-open");
  searchPill.setAttribute("aria-expanded", "true");

  searchPanel.hidden = false;
  searchPanel.classList.remove("is-open");
  void searchPanel.offsetWidth;
  searchPanel.classList.add("is-open");
}

function closeSearchPanel() {
  searchPill.classList.remove("is-open");
  searchPill.setAttribute("aria-expanded", "false");
  searchPanel.classList.remove("is-open");
  searchPanel.hidden = true;
}

async function applySearchPanel() {
  clearSpError();

  const q = normalizeQuery(searchInput.value);
  if (q) {
    const valid = validateQuery(q);
    if (!valid.ok) {
      showSpError(valid.message);
      return;
    }
  }

  activeCategory = spScope.value;
  currentMatchMode = spMatch.value;
  activeSort = spSort.value;

  navIconButtons.forEach(b => b.classList.toggle("is-active", b.dataset.category === activeCategory));
  sortPills.forEach(p => p.classList.toggle("is-active", p.dataset.sort === activeSort));

  currentQuery = q;

  closeSearchPanel();
  await loadAndShow(activeCategory, currentQuery, currentMatchMode, "Loading… applying filters");
}

/* =========================
   PRIMOGEM FIREWORKS, This module implements a lightweight,
    CSS-driven particle burst effect used to provide visual
     feedback for user interactions (e.g., clicks, selections, or hover triggers).
========================= */
function spawnPrimoBurstAt(x, y) {
  const root = document.createElement("div");
  root.className = "primoBurst";
  root.style.left = `${x}px`;
  root.style.top = `${y}px`;

  const count = 22;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "primo";

    const angle = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 140;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - (40 + Math.random() * 60);
    const rot = `${(Math.random() * 360 - 180).toFixed(1)}deg`;

    p.style.setProperty("--dx", `${dx.toFixed(1)}px`);
    p.style.setProperty("--dy", `${dy.toFixed(1)}px`);
    p.style.setProperty("--rot", rot);
    p.style.animationDelay = `${(Math.random() * 120).toFixed(0)}ms`;

    root.appendChild(p);
  }

  document.body.appendChild(root);
  setTimeout(() => root.remove(), 1200);
}

function spawnPrimoBurstFromElement(el) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  spawnPrimoBurstAt(x, y + 6);
}

const burstCooldown = new WeakMap();
function burst(el) {
  const now = performance.now();
  const last = burstCooldown.get(el) || 0;
  if (now - last < 280) return;
  burstCooldown.set(el, now);
  spawnPrimoBurstFromElement(el);
}

/* =========================
   THEME, toggle theme between light and dark modes,
========================= */
function loadTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.body.classList.toggle("is-light", saved === "light");
  themeToggle.textContent = saved === "light" ? "Light" : "Dark";
}
function toggleTheme() {
  const isLight = document.body.classList.toggle("is-light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  themeToggle.textContent = isLight ? "Light" : "Dark";
}

/* =========================
   RANDOM, pick a random item from any category and open its detail modal
========================= */
async function randomPick() {
  clearError();
  setLoadingOn("Loading… picking a random item");
  await new Promise(r => requestAnimationFrame(r));

  try {
    const types = ["characters", "weapons", "artifacts"];
    const type = types[Math.floor(Math.random() * types.length)];
    const list = await ensureList(type);
    if (!Array.isArray(list) || list.length === 0) throw new Error("No results found.");
    const id = list[Math.floor(Math.random() * list.length)];

    await setLoadingOff();
    openDetailModal(type, id);
    setStatus(`Random: ${type.toUpperCase()} → ${id}`);
  } catch (err) {
    await setLoadingOff();
    showError(err.message || "Failed API call.");
  }
}

/* =========================
   EVENTS, This section wires up all user interaction events
    to their corresponding handlers, enabling dynamic behavior
     such as search panel toggling, form submission, category switching,
      sorting, loading more results, random selection, theme toggling,
       and modal management.
========================= */
searchPill.addEventListener("click", () => {
  openSearchPanel();
  searchInput.focus();
});
searchInput.addEventListener("focus", openSearchPanel);

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  applySearchPanel();
});
spClose.addEventListener("click", closeSearchPanel);

document.addEventListener("mousedown", (e) => {
  if (searchPanel.hidden) return;
  const inside = searchWrap.contains(e.target);
  if (!inside) closeSearchPanel();
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!searchPanel.hidden) closeSearchPanel();
  if (!modalOverlay.hidden) hideModal(modalOverlay);
  if (!docsOverlay.hidden) hideModal(docsOverlay);
});

clearBtn.addEventListener("click", async () => {
  searchInput.value = "";
  currentQuery = "";
  clearError();
  await loadAndShow(activeCategory, "", currentMatchMode, `Loading ${activeCategory}…`);
});

/* Sort pills */
sortPills.forEach((pill) => {
  pill.addEventListener("click", () => {
    activeSort = pill.dataset.sort;
    sortPills.forEach((p) => p.classList.toggle("is-active", p.dataset.sort === activeSort));

    filteredItems = applySort(filteredItems);
    renderedCount = 0;
    renderNextPage();
  });
});

/* Category icons: hover + click primogems + browse */
navIconButtons.forEach((btn) => {
  btn.addEventListener("pointerenter", () => burst(btn));
  btn.addEventListener("click", async () => {
    burst(btn);

    activeCategory = btn.dataset.category;
    navIconButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.category === activeCategory));

    currentQuery = normalizeQuery(searchInput.value);
    await loadAndShow(activeCategory, currentQuery, currentMatchMode, `Loading ${activeCategory}…`);
  });
});

/* Quick nav 2x2: hover + click primogems + browse */
quickButtons.forEach((btn) => {
  btn.addEventListener("pointerenter", () => burst(btn));
  btn.addEventListener("click", async () => {
    burst(btn);

    activeCategory = btn.dataset.quick;
    navIconButtons.forEach((b) => b.classList.toggle("is-active", b.dataset.category === activeCategory));

    currentQuery = normalizeQuery(searchInput.value);
    await loadAndShow(activeCategory, currentQuery, currentMatchMode, `Loading ${activeCategory}…`);
  });
});

/* Load more */
loadMoreBtn.addEventListener("click", renderNextPage);

/* Random */
randomBtn.addEventListener("click", randomPick);

/* Theme */
themeToggle.addEventListener("click", toggleTheme);

/* Docs modal */
docsBtn.addEventListener("click", () => showModal(docsOverlay));
docsClose.addEventListener("click", () => hideModal(docsOverlay));
docsPrimary.addEventListener("click", () => hideModal(docsOverlay));
docsOverlay.addEventListener("mousedown", (e) => {
  if (e.target === docsOverlay) hideModal(docsOverlay);
});

/* Detail modal close */
modalClose.addEventListener("click", () => hideModal(modalOverlay));
modalPrimary.addEventListener("click", () => hideModal(modalOverlay));
modalOverlay.addEventListener("mousedown", (e) => {
  if (e.target === modalOverlay) hideModal(modalOverlay);
});

/* =========================
   BOOT, Initial setup: load theme, set initial state,
    and load first category (characters)
========================= */
async function boot() {
  modalOverlay.hidden = true;
  docsOverlay.hidden = true;
  closeSearchPanel();
  document.body.style.overflow = "";

  loadTheme();

  activeCategory = "characters";
  currentQuery = "";
  currentMatchMode = "contains";
  activeSort = "az";

  navIconButtons.forEach(b => b.classList.toggle("is-active", b.dataset.category === activeCategory));
  sortPills.forEach(p => p.classList.toggle("is-active", p.dataset.sort === activeSort));

  await loadAndShow(activeCategory, "", currentMatchMode, "Loading characters…");
}
boot();
