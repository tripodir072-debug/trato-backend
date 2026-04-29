require('dotenv').config();
const express = require('express');
const mercadopago = require('mercadopago');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

app.post('/crear-pago', async (req, res) => {
  try {
    const { producto, precioBase } = req.body;
    const montoFinal = Math.round(precioBase * 1.15);

    const preference = {
      items: [{
        title: `TRATO: ${producto}`,
        unit_price: montoFinal,
        quantity: 1,
      }],
      back_urls: {
        success: "https://tripodir072-debug.github.io/trato-backend/",
        failure: "https://tripodir072-debug.github.io/trato-backend/",
      },
      auto_return: "approved",
    };

    const response = await mercadopago.preferences.create(preference);
    res.json({ url: response.body.init_point });

  } catch (error) {
    res.status(500).json({ error: "Falla en el búnker" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Búnker TRATO en puerto ${PORT}`));
