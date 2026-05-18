const express = require("express");
const cors = require("cors");
const { createServer } = require("http"); 
const { Server } = require("socket.io");  
const axios = require("axios"); // Librería segura para peticiones
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const operacionesUsadas = new Set();

app.post("/crear-pago", async (req, res) => {
    try {
        const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!accessToken) {
            return res.status(500).json({ error: "Credenciales no configuradas en Render" });
        }

        const { producto, precioBase } = req.body;

        if (!producto || !precioBase) {
            return res.status(400).json({ error: "Faltan datos de producto o precio" });
        }

        if (operacionesUsadas.has(producto)) {
            return res.status(400).json({ 
                error: "Este producto u operación ya generó un link de pago. No se puede reutilizar." 
            });
        }

        operacionesUsadas.add(producto);

        // Petición limpia y blindada con Axios hacia Mercado Pago
        const respuestaMP = await axios.post(
            "https://api.mercadopago.com/checkout/preferences",
            {
                items: [{
                    title: `Paquete #${producto}`,
                    quantity: 1,
                    unit_price: parseFloat(precioBase),
                    currency_id: "ARS"
                }],
                // Guardamos el ID del producto puro adentro del sistema de Mercado Pago
                external_reference: producto.toString(), 
                back_urls: {
                    success: `https://tripodir072-debug.github.io/trato-backend/pago_confirmado.html`
                },
                auto_return: "approved"
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const paymentUrl = respuestaMP.data.init_point || respuestaMP.data.initpoint;

        if (paymentUrl) {
            res.status(200).json({ url: paymentUrl });
        } else {
            operacionesUsadas.delete(producto);
            res.status(500).json({ error: "Mercado Pago no devolvió la URL", details: respuestaMP.data });
        }

    } catch (error) {
        if (req.body && req.body.producto) {
            operacionesUsadas.delete(req.body.producto);
        }
        // Captura el error específico si Mercado Pago rechaza algo
        const mensajeError = error.response ? JSON.stringify(error.response.data) : error.message;
        res.status(500).json({ error: "Error en el búnker", details: mensajeError });
    }
});

app.post("/liberar-producto", (req, res) => {
    const { producto } = req.body;
    if (operacionesUsadas.has(producto)) {
        operacionesUsadas.delete(producto);
        return res.json({ success: true, mensaje: `Producto ${producto} liberado.` });
    }
    res.status(404).json({ error: "El producto no estaba en uso." });
});

// Puente de señales inalámbricas por Sockets
io.on("connection", (socket) => {
    socket.on("unirse_operacion", (idOperacion) => {
        if (idOperacion) {
            socket.join(idOperacion.toString());
        }
    });

    socket.on("comprobante_enviado", (data) => {
        if (data && data.producto) {
            io.to(data.producto.toString()).emit("pago_confirmado", { 
                id: data.producto.toString(), 
                estado: "approved" 
            });
        }
    });
});

const PORT = process.env.PORT || 10000;
httpServer.listen(PORT, () => { 
    console.log(`🚀 Búnker API operativo en puerto ${PORT}`); 
});
