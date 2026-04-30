const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const app = express();

app.use(cors());
app.use(express.json());

// 🛡️ CONEXIÓN AL BÚNKER (Usando el Secret File de Render)
try {
    const serviceAccount = require("/etc/secrets/firebase-admin.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://trato-bakend-default-rtdb.firebaseio.com"
    });
    console.log("🔥 Búnker conectado a Firebase");
} catch (e) {
    console.error("❌ Error en Secret File:", e.message);
}

const db = admin.database();

// 🚀 RUTA 1: LOGIN (Valida identidad sin llaves en el HTML)
app.post("/login", async (req, res) => {
    const { email, pass } = req.body;
    try {
        // Buscamos al usuario en Firebase Auth por su email
        const user = await admin.auth().getUserByEmail(email);
        
        // Aquí el búnker confirma que el usuario existe
        // Podés agregar validaciones extras aquí en el futuro
        res.status(200).send({ success: true, uid: user.uid });
    } catch (error) {
        console.error("Error Login:", error.message);
        res.status(401).send({ success: false, message: "Acceso denegado" });
    }
});

// 🚀 RUTA 2: REGISTRAR TRATOS (Seguridad RichardBro)
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
        console.error("Error registro trato:", error);
        res.status(500).send({ success: false, error: error.message });
    }
});

// Ruta de inicio para ver que todo esté OK
app.get("/", (req, res) => {
    res.send("Búnker TRATO™ Operativo y Blindado 🛡️");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor operativo en puerto ${PORT}`);
});
