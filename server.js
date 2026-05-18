app.post("/crear-pago", async (req, res) => {
    try {
        const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
        if (!accessToken) {
            return res.status(500).json({ error: "Credenciales no configuradas" });
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

        // CONFIGURACIÓN DINÁMICA COMPATIBLE CON NODE.JS
        const cuerpoPreferencia = {
            items: [{
                title: `Paquete #${producto}`,
                quantity: 1,
                unit_price: parseFloat(precioBase),
                currency_id: "ARS"
            }],
            // Almacenamiento seguro nativo de Mercado Pago
            external_reference: `${producto}-${precioBase}`, 
            back_urls: {
                success: `https://tripodir072-debug.github.io/trato-backend/pago_confirmado.html`
            },
            auto_return: "approved"
        };

        // Realizamos la petición usando la API dinámica HTTPS nativa
        const https = require('https');
        const urlMP = new URL("https://api.mercadopago.com/checkout/preferences");

        const opcionesPeticion = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };

        const reqMP = https.request(urlMP, opcionesPeticion, (resMP) => {
            let datosObtenidos = '';

            resMP.on('data', (pedazo) => {
                datosObtenidos += pedazo;
            });

            resMP.on('end', () => {
                try {
                    const data = JSON.parse(datosObtenidos);
                    const paymentUrl = data.init_point || data.initpoint;

                    if (paymentUrl) {
                        res.status(200).json({ url: paymentUrl });
                    } else {
                        operacionesUsadas.delete(producto);
                        res.status(500).json({ error: "Error de Mercado Pago", details: data });
                    }
                } catch (err) {
                    operacionesUsadas.delete(producto);
                    res.status(500).json({ error: "Error parsing JSON", details: err.message });
                }
            });
        });

        reqMP.on('error', (e) => {
            operacionesUsadas.delete(producto);
            res.status(500).json({ error: "Error de red en búnker", details: e.message });
        });

        // Escribimos el cuerpo de la preferencia y cerramos la conexión
        reqMP.write(JSON.stringify(cuerpoPreferencia));
        reqMP.end();

    } catch (error) {
        if (req.body && req.body.producto) {
            operacionesUsadas.delete(req.body.producto);
        }
        res.status(500).json({ error: error.message });
    }
});
