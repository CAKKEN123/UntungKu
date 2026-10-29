const STORAGE_KEY = "untungku-school-app-v1";
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

const defaultState = { materials: [], savedProducts: [], draft: { productName: "", portions: "", sellingPrice: "", packagingCost: 0, otherCost: 0, recipe: {} } };
let state = loadState();
let lastCalculation = null;

const $ = (selector) => document.querySelector(selector);
const numberValue = (value) => Math.max(0, Number(value) || 0);
const currency = (value) => money.format(Math.round(value || 0));

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)), draft: { ...defaultState.draft, ...JSON.parse(localStorage.getItem(STORAGE_KEY)).draft } };
  } catch { return structuredClone(defaultState); }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 2500); }

function convertToBase(quantity, unit) {
  if (unit === "kg") return quantity * 1000;
  if (unit === "liter") return quantity * 1000;
  return quantity;
}
function baseUnit(unit) { return unit === "kg" ? "gram" : unit === "liter" ? "ml" : unit; }

function showPanel(id) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.panel === id));
  document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active", panel.id === id));
}

function renderMaterials() {
  const list = $("#materialList");
  if (!state.materials.length) { list.innerHTML = '<p class="empty">Belum ada bahan. Tambahkan bahan pertamamu di atas.</p>'; return; }
  list.innerHTML = state.materials.map(material => `
    <article class="material-item">
      <div><div class="material-name">${escapeHtml(material.name)}</div><div class="material-meta">${currency(material.price)} / ${formatNumber(material.quantity)} ${material.unit}</div></div>
      <button class="icon-button" data-delete-material="${material.id}" type="button" aria-label="Hapus ${escapeHtml(material.name)}">Hapus</button>
    </article>`).join("");
  document.querySelectorAll("[data-delete-material]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.deleteMaterial;
    state.materials = state.materials.filter(material => material.id !== id);
    delete state.draft.recipe[id]; persist(); renderMaterials(); renderRecipe(); calculate();
  }));
}

function renderRecipe() {
  const list = $("#recipeList");
  if (!state.materials.length) { list.innerHTML = '<p class="empty">Tambahkan bahan terlebih dahulu pada menu Bahan.</p>'; return; }
  list.innerHTML = state.materials.map(material => {
    const unit = baseUnit(material.unit);
    return `<div class="recipe-item"><div><label>${escapeHtml(material.name)}</label><p class="recipe-unit">Harga: ${currency(material.price / convertToBase(material.quantity, material.unit))} per ${unit}</p></div><label>Dipakai<input data-recipe="${material.id}" type="number" min="0" step="0.01" inputmode="decimal" value="${state.draft.recipe[material.id] || ""}" placeholder="0" /><span class="recipe-unit">${unit}</span></label></div>`;
  }).join("");
  document.querySelectorAll("[data-recipe]").forEach(input => input.addEventListener("input", () => { state.draft.recipe[input.dataset.recipe] = input.value; persist(); }));
}

function writeDraftToInputs() {
  $("#productName").value = state.draft.productName; $("#portionCount").value = state.draft.portions;
  $("#sellingPrice").value = state.draft.sellingPrice; $("#packagingCost").value = state.draft.packagingCost;
  $("#otherCost").value = state.draft.otherCost;
}
function captureDraft() {
  state.draft.productName = $("#productName").value.trim(); state.draft.portions = $("#portionCount").value;
  state.draft.sellingPrice = $("#sellingPrice").value; state.draft.packagingCost = $("#packagingCost").value;
  state.draft.otherCost = $("#otherCost").value; persist();
}

function calculate() {
  captureDraft();
  const portions = numberValue(state.draft.portions), sellingPrice = numberValue(state.draft.sellingPrice);
  const materialTotal = state.materials.reduce((total, material) => {
    const used = numberValue(state.draft.recipe[material.id]);
    const unitPrice = material.price / convertToBase(material.quantity, material.unit);
    return total + (unitPrice * used);
  }, 0);
  const extraTotal = numberValue(state.draft.packagingCost) + numberValue(state.draft.otherCost);
  const batchTotal = materialTotal + extraTotal, hpp = portions ? batchTotal / portions : 0;
  const profit = sellingPrice - hpp, margin = sellingPrice ? (profit / sellingPrice) * 100 : 0;
  lastCalculation = { materialTotal, extraTotal, batchTotal, hpp, sellingPrice, profit, margin, portions };
  $("#materialTotal").textContent = currency(materialTotal); $("#extraTotal").textContent = currency(extraTotal); $("#batchTotal").textContent = currency(batchTotal);
  $("#hppResult").textContent = currency(hpp); $("#sellingResult").textContent = currency(sellingPrice); $("#profitResult").textContent = currency(profit); $("#marginResult").textContent = `${margin.toFixed(1)}%`;
  $("#summaryHpp").textContent = currency(hpp); $("#summaryProfit").textContent = currency(profit); $("#summaryMargin").textContent = `${margin.toFixed(1)}%`;
  $("#resultProductName").textContent = state.draft.productName ? `Perhitungan untuk ${state.draft.productName}` : "Isi data produk terlebih dahulu.";
  const message = $("#resultMessage");
  if (!portions) { message.textContent = "Masukkan hasil produksi agar HPP per porsi dapat dihitung."; message.classList.remove("loss"); }
  else if (profit <= 0) { message.textContent = "Harga jual belum menutup biaya produksi. Coba periksa harga jual atau biaya bahan."; message.classList.add("loss"); }
  else { message.textContent = `Setiap porsi menghasilkan laba kotor sekitar ${currency(profit)}.`; message.classList.remove("loss"); }
  renderSavedProducts(); showPanel("result");
}

function renderSavedProducts() {
  const list = $("#savedProductList");
  if (!state.savedProducts.length) { list.innerHTML = '<p class="empty">Belum ada produk yang disimpan.</p>'; return; }
  list.innerHTML = state.savedProducts.map(product => `<article class="saved-product"><div><div class="material-name">${escapeHtml(product.name)}</div><div class="material-meta">HPP ${currency(product.hpp)} · Laba ${currency(product.profit)}</div></div><button class="icon-button" type="button" data-delete-product="${product.id}">Hapus</button></article>`).join("");
  document.querySelectorAll("[data-delete-product]").forEach(button => button.addEventListener("click", () => { state.savedProducts = state.savedProducts.filter(product => product.id !== button.dataset.deleteProduct); persist(); renderSavedProducts(); toast("Produk dihapus."); }));
}

function saveProduct() {
  if (!lastCalculation || !state.draft.productName || !lastCalculation.portions) { toast("Isi nama produk dan hasil produksi terlebih dahulu."); showPanel("product"); return; }
  state.savedProducts.unshift({ id: crypto.randomUUID(), name: state.draft.productName, ...lastCalculation, savedAt: new Date().toISOString() }); persist(); renderSavedProducts(); toast("Produk berhasil disimpan di browser ini.");
}
function resetDraft() { state.draft = structuredClone(defaultState.draft); persist(); writeDraftToInputs(); renderRecipe(); lastCalculation = null; calculate(); showPanel("product"); toast("Form produk dikosongkan."); }
function formatNumber(value) { return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char])); }

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => showPanel(tab.dataset.panel)));
$("#materialForm").addEventListener("submit", event => { event.preventDefault(); const material = { id: crypto.randomUUID(), name: $("#materialName").value.trim(), price: numberValue($("#materialPrice").value), quantity: numberValue($("#materialQuantity").value), unit: $("#materialUnit").value }; state.materials.push(material); persist(); event.target.reset(); renderMaterials(); renderRecipe(); toast(`${material.name} ditambahkan.`); });
document.querySelectorAll("#productForm input").forEach(input => input.addEventListener("input", captureDraft));
$("#calculateButton").addEventListener("click", calculate); $("#saveProductButton").addEventListener("click", saveProduct); $("#resetButton").addEventListener("click", resetDraft);
writeDraftToInputs(); renderMaterials(); renderRecipe(); renderSavedProducts(); calculate();
