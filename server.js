const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const app = express();

app.use(cors());
app.use(express.json());

// 🛡️ CONEXIÓN AL BÚNKER (Usando el Secret File de Render)
const serviceAccount = require("/etc/secrets/firebase-admin.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://trato-bakend-default-rtdb.firebaseio.com"
});

const db = admin.database();

// 🚀 RUTA PARA REGISTRAR TRATOS (Lo que antes hacíamos desde el HTML)
app.post("/registrar-trato", async (req, res) => {
    const { nombre, dni, monto, producto, vendedorId } = req.body;
    
    try {
        const nuevoTratoRef = db.ref('tratos').push();
        await nuevoTratoRef.set({
            nombre,
            dni,
            monto,
            producto,
            vendedorId,
            estado: "pendiente",
            fecha: new Date().toISOString()
        });
        
        res.status(200).send({ success: true, id: nuevoTratoRef.key });
    } catch (error) {
        console.error("Error en el búnker:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});

// Mantengo el puerto que usa Render
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor TRATO operando en puerto ${PORT}`);
});
