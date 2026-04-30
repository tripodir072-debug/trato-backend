const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const fs = require("fs");
const app = express();

app.use(cors());
app.use(express.json());

// 🛡️ CONFIGURACIÓN DEL BÚNKER
const secretPath = "/etc/secrets/firebase-admin.json";

// Solo intentamos conectar si el archivo realmente existe
if (fs.existsSync(secretPath)) {
    try {
        const serviceAccount = require(secretPath);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: "https://trato-bakend-default-rtdb.firebaseio.com"
        });
        console.log("🔥 Búnker conectado con éxito a Firebase");
    } catch (e) {
        console.error("❌ Error al inicializar Firebase:", e.message);
    }
} else {
    console.log("⚠️ AVISO: El archivo secreto no se encuentra en /etc/secrets/. El servidor arrancará en modo limitado.");
}

const db = admin ? admin.database() : null;

// 🚀 RUTA: REGISTRAR TRATOS
app.post("/registrar-trato", async (req, res) => {
    if (!db) return res.status(500).send({ success: false, error: "Firebase no está conectado" });
    
    const { nombre, dni, monto, producto, vendedorId } = req.body;
    try {
        const nuevoTratoRef = db.ref('tratos').push();
        await nuevoTratoRef.set({
            nombre, dni, monto, producto, vendedorId,
            estado: "pendiente",
            fecha: new Date().toISOString()
        });
        res.status(200).send({ success: true, id: nuevoTratoRef.key });
    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
});

// Ruta de Salud
app.get("/", (req, res) => {
    res.send("Búnker TRATO™ Operativo 🛡️ - Estado Firebase: " + (db ? "CONECTADO" : "ESPERANDO SECRETO"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor en puerto ${PORT}`);
});
