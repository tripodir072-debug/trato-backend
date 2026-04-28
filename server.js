require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");

const app = express();

app.use(cors());
app.use(express.json());

// CONFIG MERCADO PAGO
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

// BASE DE DATOS TEMPORAL
let operaciones = [];

// =========================
// CREAR PAGO
// =========================
app.post("/crear-pago", async (req, res) => {
  try {
    const { producto, precio } = req.body;

    if (!producto || !precio) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const total = Math.round(precio * 1.15);
    const opId = Date.now();

    const preference = {
      items: [
        {
          title: producto,
          quantity: 1,
          unit_price: total
        }
      ],
      metadata: {
        opId: opId
      },
      notification_url: `${process.env.BASE_URL}/webhook`,
      auto_return: "approved"
    };

    const response = await mercadopago.preferences.create(preference);

    operaciones.push({
      id: opId,
      producto,
      precio,
      total,
      estado: "PENDIENTE"
    });

    res.json({
      url: response.body.init_point
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear pago" });
  }
});

// =========================
// WEBHOOK
// =========================
app.post("/webhook", async (req, res) => {
  try {
    if (req.body.type === "payment") {

      const payment = await mercadopago.payment.findById(req.body.data.id);

      if (payment.body.status === "approved") {

        const opId = payment.body.metadata.opId;

        const op = operaciones.find(o => o.id == opId);

        if (op) {
          op.estado = "PAGADA_EN_BOVEDA";
          console.log("💰 Pago aprobado:", opId);
        }
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// =========================
// VER OPERACIONES
// =========================
app.get("/ops", (req, res) => {
  res.json(operaciones);
});

// =========================
// SERVER
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
