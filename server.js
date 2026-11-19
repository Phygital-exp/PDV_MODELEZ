const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const app = express();

const PORT = process.env.PORT || 3000;
const { API_TOKEN } = process.env;
const PDV_ENDPOINT_URL = "https://botai.smartdataautomation.com/api_backend_ai/dinamic-db/report/119/pdv_mondelez";

// Orígenes permitidos (ej: "https://phygital-exp.github.io"). Separados por coma. Vacío = todos.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

if (!API_TOKEN) {
    console.error("❌ Falta la variable de entorno API_TOKEN");
    process.exit(1);
}

const AUTH_HEADERS = {
    Authorization: `Token ${API_TOKEN}`,
    "Content-Type": "application/json",
};

app.use(
    cors({
        origin: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : true,
    })
);

// Healthcheck para Railway
app.get("/", (req, res) => {
    res.json({ status: "ok", service: "proxy-pdv-mondelez" });
});

// PDVs Mondelez: /api/mondelez/pdv  (los parámetros de query se reenvían al backend)
app.get("/api/mondelez/pdv", async (req, res) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === "string" && value.trim() !== "") {
            params.append(key, value.trim());
        }
    }

    const qs = params.toString();
    const url = qs ? `${PDV_ENDPOINT_URL}?${qs}` : PDV_ENDPOINT_URL;

    try {
        const response = await fetch(url, { headers: AUTH_HEADERS });

        // Si el backend responde 404 lo tratamos como "sin puntos de venta"
        if (response.status === 404) {
            return res.json([]);
        }

        if (!response.ok) {
            const text = await response.text();
            console.error(`❌ Error HTTP ${response.status}:`, text);
            return res.status(response.status).json({ error: `Error ${response.status}: ${text.substring(0, 200)}` });
        }

        const data = await response.json();
        res.json(data ?? []);
    } catch (err) {
        console.error("❌ Error en el proxy:", err);
        res.status(500).json({ error: "Error al obtener datos del PDV", details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor proxy escuchando en http://localhost:${PORT}`);
});
