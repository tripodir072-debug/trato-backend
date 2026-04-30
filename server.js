const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const fs = require("fs");
const app = express();

app.use(cors());
app.use(express.json());

// 🛡️ CONFIGURACIÓN DEL BÚNKER RICHARD-BRO
const secretPath = "/etc/secrets/firebase-admin.json";

if (fs.existsSync(secretPath)) {
    try {
        const serviceAccount = require(secretPath);
        
        // Usamos el ID del proyecto que figura en tu llave
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
        });
        console.log("🔥 Búnker conectado con éxito a Firebase");
    } catch (e) {
        console.error("❌ Error de formato en la llave:", e.message);
    }
} else {
    console.log("⚠️ ESPERANDO ARCHIVO SECRETO...");
}

// 🚀 RUTAS DEL SISTEMA
app.post("/login", async (req, res) => {
    try {
        const { email } = req.body;
        const user = await admin.auth().getUserByEmail(email);
        res.status(200).send({ success: true, uid: user.uid });
    } catch (error) {
        res.status(401).send({ success: false, message: "Acceso denegado" });
    }
});

app.post("/registrar-trato", async (req, res) => {
    try {
        const db = admin.database();
        const nuevoTratoRef = db.ref('tratos').push();
        await nuevoTratoRef.set({
            ...req.body,
            estado: "pendiente",
            fecha: new Date().toISOString()
        });
        res.status(200).send({ success: true, id: nuevoTratoRef.key });
    } catch (error) {
        res.status(500).send({ success: false, error: error.message });
    }
});

app.get("/", (req, res) => {
    res.send("Búnker TRATO™ Operativo 🛡️ - Estado: " + (admin.apps.length > 0 ? "CONECTADO" : "SIN LLAVE"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Puerto ${PORT}`); });
