const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());

// Almacenes de memoria del búnker
const operacionesUsadas = new Set();
const estadosOperaciones = new Map(); // Aquí guardamos si está "esperando" o "approved"

app.post("/crear-pago", async (req, res) => {
    try {
        const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!accessToken) {
            return res.status(500).json({ error: "Credenciales no configuradas" });
        }

        const { producto, precioBase } = req.body;

        if (!producto || !precioBase) {
            return res.status(400).json({ error: "Faltan datos" });
        }

        if (operacionesUsadas.has(producto.toString())) {
            return res.status(400).json({ error: "Este producto ya está activo." });
        }

        operacionesUsadas.add(producto.toString());
        // Inicializamos el estado interno en el búnker
        estadosOperaciones.set(producto.toString(), "esperando");

        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                items: [{
                    title: `Paquete #${producto}`,
                    quantity: 1,
                    unit_price: parseFloat(precioBase),
                    currency_id: "ARS"
                }],
                external_reference: producto.toString(),
                back_urls: {
                    success: `https://tripodir072-debug.github.io/trato-backend/pago_confirmado.html`
                },
                auto_return: "approved"
            })
        });

        const data = await response.json();
        const paymentUrl = data.init_point || data.initpoint;

        if (paymentUrl) {
            res.status(200).json({ url: paymentUrl });
        } else {
            operacionesUsadas.delete(producto.toString());
            estadosOperaciones.delete(producto.toString());
            res.status(500).json({ error: "Error de pasarela", details: data });
        }
    } catch (error) {
        if (req.body && req.body.producto) {
            operacionesUsadas.delete(req.body.producto.toString());
            estadosOperaciones.delete(req.body.producto.toString());
        }
        res.status(500).json({ error: error.message });
    }
});

// 🔥 EL DETONADOR: El comprador llama acá para asentar el pago en el búnker
app.post("/marcar-pagado", (req, res) => {
    const { producto } = req.body;
    if (!producto) return res.status(400).json({ error: "Falta ID de producto" });
    
    estadosOperaciones.set(producto.toString(), "approved");
    res.json({ success: true, mensaje: `Producto ${producto} marcado como pagado.` });
});

// 🖥️ EL MONITOR: El vendedor llama acá cada 3 segundos para revisar la lista
app.get("/consultar-estado/:producto", (req, res) => {
    const { producto } = req.params;
    const estado = estadosOperaciones.get(producto.toString()) || "inexistente";
    res.json({ producto: producto, estado: estado });
});

app.post("/liberar-producto", (req, res) => {
    const { producto } = req.body;
    if (operacionesUsadas.has(producto.toString())) {
        operacionesUsadas.delete(producto.toString());
        estadosOperaciones.delete(producto.toString());
        return res.json({ success: true, mensaje: "Liberado" });
    }
    res.status(404).json({ error: "No encontrado" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { 
    console.log(`🚀 Búnker API por Registro operativo en puerto ${PORT}`); 
});
