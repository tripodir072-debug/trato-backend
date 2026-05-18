// Reemplazá la sección de la preferencia dentro de app.post("/crear-pago") por esta:
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
        // 📦 GUARDADO BLINDADO: Metemos el ID y el precio adentro del casillero oficial de MP
        external_reference: `${producto}-${precioBase}`, 
        back_urls: {
            // El link de éxito al que regresa el cliente de forma automática
            success: `https://tripodir072-debug.github.io/trato-backend/pago_confirmado.html`
        },
        auto_return: "approved"
    })
});
