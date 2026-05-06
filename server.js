const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir los archivos frontend (html, css, js) desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

// --- 1. CONEXIÓN A MONGODB ---
// (Usando el enlace directo que comprobamos que funciona)
const URI_DIRECTA = "mongodb://logicalduck:puffle2121@ac-aauoy7b-shard-00-00.dlpqatj.mongodb.net:27017,ac-aauoy7b-shard-00-01.dlpqatj.mongodb.net:27017,ac-aauoy7b-shard-00-02.dlpqatj.mongodb.net:27017/juego_ods12?replicaSet=atlas-vxkbsl-shard-0&ssl=true&authSource=admin";

console.log("⏳ Intentando conectar a la base de datos...");

mongoose.connect(URI_DIRECTA)
  .then(() => console.log('✅ Conectado a MongoDB Atlas exitosamente'))
  .catch(err => console.error('❌ Error conectando a MongoDB:', err));

// --- 2. MODELO DE DATOS (Esquema con Contraseña) ---
const jugadorSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Contraseña obligatoria
    puntos: { type: Number, default: 0 },
    inventario: {
        plastico: { type: Number, default: 0 },
        papel: { type: Number, default: 0 }
    }
});

const Jugador = mongoose.model('Jugador', jugadorSchema);

// --- 3. RUTAS CRUD Y AUTH (API) ---

// [SISTEMA DE LOGIN Y REGISTRO]
app.post('/api/auth', async (req, res) => {
    const { username, password, accion } = req.body;
    try {
        let jugador = await Jugador.findOne({ username });

        if (accion === 'login') {
            if (!jugador) return res.status(404).json({ error: 'El usuario no existe.' });
            if (jugador.password !== password) return res.status(401).json({ error: 'Contraseña incorrecta.' });
            console.log(`👋 Ingresó: ${username}`);
            return res.json(jugador);
        } 
        
        if (accion === 'registro') {
            if (jugador) return res.status(400).json({ error: 'El usuario ya existe. Intenta iniciar sesión.' });
            jugador = new Jugador({ username, password });
            await jugador.save();
            console.log(`🎮 Nuevo registro: ${username}`);
            return res.json(jugador);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// [GUARDAR PROGRESO]
app.put('/api/jugador/guardar', async (req, res) => {
    const { username, puntos, inventario } = req.body;
    try {
        const jugadorActualizado = await Jugador.findOneAndUpdate(
            { username },
            { puntos, inventario },
            { returnDocument: 'after' } 
        );
        res.json(jugadorActualizado);
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar progreso' });
    }
});

// [OBTENER RANKING]
app.get('/api/ranking', async (req, res) => {
    try {
        const topJugadores = await Jugador.find().sort({ puntos: -1 }).limit(5);
        res.json(topJugadores);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el ranking' });
    }
});

// --- 4. INICIAR SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});