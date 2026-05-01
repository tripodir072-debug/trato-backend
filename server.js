const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());

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
                // Modificamos la URL para pasar el parámetro del producto a la pantalla de éxito
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
            res.status(500).json({ error: "Error al generar link", details: data });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Servicio de protección en puerto ${PORT}`); });
