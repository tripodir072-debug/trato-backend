const express = require("express");
const cors = require("cors");
const { createServer } = require("http"); // Requerido para acoplar WebSockets de forma limpia
const { Server } = require("socket.io");  // Motor de tiempo real
const app = express();
require("dotenv").config();

app.use(cors());
app.use(express.json());

// Creamos el servidor HTTP envolviendo la app de express sin romper lógicas
const httpServer = createServer(app);

// Configuramos Socket.io con soporte CORS para que se conecte con tu GitHub Pages
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

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
                    title: `Paquete #${producto}`,
                    quantity: 1,
                    unit_price: parseFloat(precioBase),
                    currency_id: "ARS"
                }],
                // BLINDAJE: Guardamos el ID del producto fijo acá para reconocerlo en la notificación de pago
                external_reference: producto,
                back_urls: {
                    success: `https://tripodir072-debug.github.io/trato-backend/pago_confirmado.html?external_reference=${encodeURIComponent(producto)}`
                },
                auto_return: "approved",
                // WEBHOOK: Le indicamos a Mercado Pago a qué dirección de tu búnker gritar cuando cobres
                notification_url: "https://bunker-trato-api.onrender.com/webhook"
            })
        });

        const data = await response.json();
        const paymentUrl = data.init_point || data.initpoint;

        if (paymentUrl) {
            res.status(200).json({ url: paymentUrl });
            // El io.emit simulado que estaba acá lo removimos, porque ahora el búnker va a gritar con datos reales del webhook
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

// ==========================================
// 📡 ENDPOINT WEBHOOK RECEPTOR DE MERCADO PAGO
// ==========================================
app.post("/webhook", async (req, res) => {
    // Respondemos rápido 200 OK a Mercado Pago para que libere la conexión
    res.status(200).send("OK");

    const { query } = req;
    
    // Verificamos si la alerta entrante es sobre una transacción de pago
    if (query.topic === "payment" || query.type === "payment") {
        const paymentId = query.id || query["data.id"];
        
        try {
            const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
            
            // Le consultamos a la API de Mercado Pago el estado real de este ID de cobro recibido
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });
            
            const paymentData = await response.json();
            
            // Si impactó con éxito, extraemos el ID original del external_reference
            if (paymentData.status === "approved") {
                const idProductoAprobado = paymentData.external_reference;
                
                if (idProductoAprobado) {
                    // 🔥 ¡ALERTA EN VIVO! El servidor le grita al WebSocket asignado a este paquete
                    io.to(idProductoAprobado).emit("pago_confirmado", { id: idProductoAprobado, estado: "approved" });
                }
            }
        } catch (error) {
            console.log("Error procesando alerta de pago en búnker:", error.message);
        }
    }
});

// ==========================================
// 🛰️ SECCIÓN DE ESCUCHA Y GESTIÓN DE SOCKETS
// ==========================================
io.on("connection", (socket) => {
    // Cuando el vendedor entra, se suscribe al canal de su ID de paquete (4 dígitos)
    socket.on("unirse_operacion", (idOperacion) => {
        socket.join(idOperacion);
    });
});

const PORT = process.env.PORT || 10000;
// IMPORTANTE: Cambiamos app.listen por httpServer.listen para habilitar los WebSockets
httpServer.listen(PORT, () => { console.log(`🚀 Servicio de protección en vivo activo en puerto ${PORT}`); });
