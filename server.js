const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());

// Memoria del servidor: guarda los productos que ya tienen un link activo
const operacionesUsadas = new Set();

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

        // 1. Verificamos si el producto (ID de 4 dígitos) ya generó un link
        if (operacionesUsadas.has(producto)) {
            return res.status(400).json({ 
                error: "Este producto u operación ya generó un link de pago. No se puede reutilizar." 
            });
        }

        // 2. Lo registramos en la memoria del servidor
        operacionesUsadas.add(producto);

        const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                items: [{
                    title: producto,
                    quantity: 1,
                    unit_price: parseFloat(precioBase),
                    currency_id: "ARS"
                }],
                back_urls: {
                    success: `https://tripodir072-debug.github.io/trato-backend/pago_confirmado.html?external_reference=${encodeURIComponent(producto)}`
                },
                auto_return: "approved"
            })
        });

        const data = await response.json();
        const paymentUrl = data.init_point || data.initpoint;

        if (paymentUrl) {
            res.status(200).json({ url: paymentUrl });
        } else {
            // Si la llamada a Mercado Pago falla, liberamos el producto de la memoria
            operacionesUsadas.delete(producto);
            res.status(500).json({ error: "Error al generar link", details: data });
        }
    } catch (error) {
        // Si ocurre un error de red o de servidor, nos aseguramos de liberar el producto
        if (req.body && req.body.producto) {
            operacionesUsadas.delete(req.body.producto);
        }
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para liberar el producto manualmente si la operación se cancela
app.post("/liberar-producto", (req, res) => {
    const { producto } = req.body;
    
    if (operacionesUsadas.has(producto)) {
        operacionesUsadas.delete(producto);
        return res.json({ success: true, mensaje: `Producto ${producto} liberado correctamente.` });
    }
    
    res.status(404).json({ error: "El producto no se encontraba en uso." });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Servicio de protección en puerto ${PORT}`); });
