// ------------------------------------
// CONFIGURACIÓN
// ------------------------------------
// URL pública del proxy en Railway (rama Proxy)
const PROXY_URL = "https://pdvmodelez-production.up.railway.app";
const PDV_URL = `${PROXY_URL}/api/mondelez/pdv`;
const CLIENTE = "MONDELEZ";
const MAX_RESULTS = 20;

// Posibles nombres de columna para cada campo (se buscan sin importar mayúsculas)
const FIELD_MAP = {
    nombre: ["NOMBRE_PDV", "NOMBRE", "PDV", "RAZON_SOCIAL", "NOMBRE_ESTABLECIMIENTO"],
    codigo: ["SAP", "CODIGO_PDV", "CODIGO", "COD_PDV", "ID_PDV"],
    direccion: ["DIRECCION", "DIRECCION_PDV", "DIR"],
    barrio: ["BARRIO"],
    municipio: ["MUNICIPIO"],
    ciudad: ["CIUDAD", "MUNICIPIO"],
    departamento: ["DEPARTAMENTO", "DEPTO"],
    canal: ["CANAL"],
    supervisor: ["SUPERVISOR"],
    vendedor: ["VENDEDOR"],
    estado: ["ESTADO"],
    telefono: ["TELEFONO", "CELULAR", "TEL"],
    latitud: ["LATITUD", "LAT"],
    longitud: ["LONGITUD", "LNG", "LON"],
};

let pdvs = [];
let fuse = null;

// ------------------------------------
// UTILIDADES
// ------------------------------------
function getField(row, keys) {
    const lowerMap = {};
    for (const k of Object.keys(row)) lowerMap[k.toLowerCase()] = row[k];
    for (const key of keys) {
        const value = lowerMap[key.toLowerCase()];
        const text = value === undefined || value === null ? "" : String(value).trim();
        if (text !== "" && text.toUpperCase() !== "NA") {
            return String(value).trim();
        }
    }
    return "";
}

function mapPdv(row) {
    const pdv = {};
    for (const [campo, keys] of Object.entries(FIELD_MAP)) {
        pdv[campo] = getField(row, keys);
    }
    return pdv;
}

// El backend puede devolver un arreglo o un objeto que lo contiene
function extractRows(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
        for (const key of ["result", "data", "results", "rows", "items"]) {
            if (Array.isArray(data[key])) return data[key];
        }
    }
    return [];
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function setStatus(html, type = "") {
    const status = document.getElementById("status");
    status.className = `status ${type}`.trim();
    status.innerHTML = html;
}

// ------------------------------------
// CARGA DE PDVs
// ------------------------------------
async function loadPdvs() {
    const searchInput = document.getElementById("searchInput");
    searchInput.disabled = true;
    searchInput.placeholder = "Cargando PDVs...";
    setStatus("Cargando puntos de venta...");

    try {
        const response = await fetch(PDV_URL);
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error((data && data.error) || `Error ${response.status}`);
        }

        pdvs = extractRows(data).map(mapPdv);

        if (pdvs.length === 0) {
            searchInput.placeholder = "Sin puntos de venta";
            setStatus(
                `<span class="material-icons">info</span>De momento no hay puntos de venta disponibles.`,
                "empty"
            );
            return;
        }

        fuse = new Fuse(pdvs, {
            keys: [
                { name: "nombre", weight: 0.4 },
                { name: "codigo", weight: 0.2 },
                { name: "direccion", weight: 0.2 },
                { name: "barrio", weight: 0.1 },
                { name: "ciudad", weight: 0.1 },
                { name: "municipio", weight: 0.1 },
                { name: "canal", weight: 0.05 },
                { name: "supervisor", weight: 0.05 },
                { name: "vendedor", weight: 0.05 },
            ],
            threshold: 0.35,
            ignoreLocation: true,
        });

        searchInput.disabled = false;
        searchInput.placeholder = "Buscar por nombre, SAP, dirección, ciudad o vendedor...";
        searchInput.focus();
        setStatus(`${pdvs.length} puntos de venta cargados.`);
    } catch (err) {
        console.error("❌ Error cargando PDVs:", err);
        searchInput.placeholder = "No se pudieron cargar los PDVs";
        setStatus(
            `<span class="material-icons">error_outline</span>No se pudieron cargar los puntos de venta. Intente de nuevo más tarde.`,
            "error"
        );
    }
}

// ------------------------------------
// BÚSQUEDA
// ------------------------------------
function handleInput() {
    const query = document.getElementById("searchInput").value.trim();
    const results = document.getElementById("results");

    if (!fuse || query.length < 2) {
        results.innerHTML = "";
        return;
    }

    const found = fuse.search(query, { limit: MAX_RESULTS }).map(r => r.item);

    if (found.length === 0) {
        results.innerHTML = `<div class="status empty">No se encontraron resultados para "${escapeHtml(query)}".</div>`;
        return;
    }

    results.innerHTML = found.map(renderPdv).join("");
}

function renderPdv(pdv, index) {
    const lugar = [...new Set([pdv.barrio, pdv.municipio, pdv.ciudad, pdv.departamento].filter(Boolean))].join(", ");
    const tags = [CLIENTE, pdv.canal, pdv.estado].filter(Boolean);

    const copyIcon = text =>
        `<span class="material-icons copy-icon" title="Copiar" data-copy="${escapeHtml(text)}" onclick="copyText(this)">content_copy</span>`;

    const items = [];
    if (pdv.codigo) items.push(`<li><span class="material-icons icon-tipo">tag</span><strong>SAP:</strong> ${escapeHtml(pdv.codigo)}${copyIcon(pdv.codigo)}</li>`);
    if (pdv.direccion) items.push(`<li><span class="material-icons icon-tipo">place</span><strong>Dirección:</strong> ${escapeHtml(pdv.direccion)}${copyIcon(pdv.direccion)}</li>`);
    if (lugar) items.push(`<li><span class="material-icons icon-tipo">location_city</span>${escapeHtml(lugar)}</li>`);
    if (pdv.telefono) items.push(`<li><span class="material-icons icon-tipo">phone</span>${escapeHtml(pdv.telefono)}${copyIcon(pdv.telefono)}</li>`);
    if (pdv.supervisor) items.push(`<li><span class="material-icons icon-tipo">supervisor_account</span><strong>Supervisor:</strong> ${escapeHtml(pdv.supervisor)}</li>`);
    if (pdv.vendedor) items.push(`<li><span class="material-icons icon-tipo">person</span><strong>Vendedor:</strong> ${escapeHtml(pdv.vendedor)}</li>`);
    if (pdv.latitud && pdv.longitud) {
        const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(pdv.latitud)},${encodeURIComponent(pdv.longitud)}`;
        items.push(`<li><a class="map-link" href="${mapsUrl}" target="_blank" rel="noopener"><span class="material-icons">map</span>Ver en Google Maps</a></li>`);
    }

    return `
        <div class="result-item pdv" style="animation-delay: ${index * 0.03}s">
            <h3><span class="material-icons icon-tipo">storefront</span>${escapeHtml(pdv.nombre || "PDV sin nombre")}</h3>
            <div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
            <ul>${items.join("")}</ul>
        </div>`;
}

function copyText(el) {
    const text = el.dataset.copy;
    navigator.clipboard.writeText(text).then(() => {
        el.textContent = "check";
        setTimeout(() => { el.textContent = "content_copy"; }, 1200);
    }).catch(err => console.error("No se pudo copiar:", err));
}

// ------------------------------------
// MODO OSCURO
// ------------------------------------
function toggleDarkMode() {
    const enabled = document.getElementById("darkModeToggle").checked;
    document.body.classList.toggle("dark-mode", enabled);
    document.getElementById("darkModeLabel").textContent = enabled ? "☀️ Modo claro" : "🌙 Modo oscuro";
    try { localStorage.setItem("darkMode", enabled ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
}

(function initDarkMode() {
    let saved = null;
    try { saved = localStorage.getItem("darkMode"); } catch (e) { /* sin almacenamiento */ }
    if (saved === "1") {
        document.getElementById("darkModeToggle").checked = true;
        toggleDarkMode();
    }
})();

// Cargar los PDVs al abrir la página
loadPdvs();
