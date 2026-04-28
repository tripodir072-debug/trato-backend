require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mercadopago = require("mercadopago");

const app = express();

app.use(cors());
app.use(express.json());

// CONFIG MP
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKENAPP_USR-3822730786979070-041707-2a6a7a0555139c12f88e5ba93b0ed401-220923936
});

// "Base de datos" temporal
let operaciones = [];

// =========================
// CREAR PAGO
// =========================
app.post("/crear-pago", async (req, res) => {
  try {
    const { producto, precio } = req.body;

    if (!producto || !precio) {
      return res.status(400).json({ error: "Datos incompletos" });
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
      back_urls: {
        success: `${process.env.BASE_URL}/ok`,
        failure: `${process.env.BASE_URL}/error`,
        pending: `${process.env.BASE_URL}/pendiente`
      },
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
      url: response.body.init_point,
      opId
    });

  } catch (error) {
    console.error("Error crear pago:", error);
    res.status(500).json({ error: "Error al crear pago" });
  }
});

// =========================
// WEBHOOK
// =========================
app.post("/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type === "payment") {
      const paymentId = data.id;

      const payment = await mercadopago.payment.findById(paymentId);

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
    console.error("Error webhook:", error);
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
// SERVIDOR
// =========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Servidor corriendo en puerto", PORT);
});
