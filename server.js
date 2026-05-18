const express = require("express");
const cors = require("cors");
const { createServer } = require("http"); 
const { Server } = require("socket.io");  
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());

// Configuramos la envoltura HTTP para Socket.io de forma nativa y robusta
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Permite que tus repositorios de GitHub Pages se conecten sin bloqueos
        methods: ["GET", "POST"]
    }
});

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

        if (operacionesUsadas.has(producto)) {
            return res.status(400).json({ 
                error: "Este producto u operación ya generó un link de pago. No se puede reutilizar." 
            });
        }

        operacionesUsadas.add(producto);

        // Armamos la llamada estándar a la API de Mercado Pago
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
                external_reference: producto,
                back_urls: {
                    // Retorno básico seguro hacia tu búnker de estados
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
            operacionesUsadas.delete(producto);
            res.status(500).json({ error: "Error al generar link", details: data });
        }
    } catch (error) {
        if (req.body && req.body.producto) {
            operacionesUsadas.delete(req.body.producto);
        }
        res.status(500).json({ error: error.message });
    }
});

app.post("/liberar-producto", (req, res) => {
    const { producto } = req.body;
    if (operacionesUsadas.has(producto)) {
        operacionesUsadas.delete(producto);
        return res.json({ success: true, mensaje: `Producto ${producto} liberado correctamente.` });
    }
    res.status(404).json({ error: "El producto no se encontraba en uso." });
});

// ==========================================
// 🛰️ PUENTE DE SEÑALES EN TIEMPO REAL (SOCKETS)
// ==========================================
io.on("connection", (socket) => {
    // Escucha cuando una pantalla (vendedor o comprador) se suscribe a una sala numérica corta
    socket.on("unirse_operacion", (idOperacion) => {
        if (idOperacion) {
            socket.join(idOperacion.toString());
        }
    });

    // 🔥 EL DETONADOR: Cuando el comprador toca el botón azul, este bloque ataja la señal
    socket.on("comprobante_enviado", (data) => {
        if (data && data.producto) {
            // Le retransmite de forma directa a la pantalla del vendedor en ese mismo canal corto
            io.to(data.producto.toString()).emit("pago_confirmado", { 
                id: data.producto.toString(), 
                estado: "approved" 
            });
        }
    });
});

const PORT = process.env.PORT || 10000;
// IMPORTANTE: Arrancamos con httpServer para encender el motor de Sockets
httpServer.listen(PORT, () => { 
    console.log(`🚀 Búnker API en vivo operativo en puerto ${PORT}`); 
});
