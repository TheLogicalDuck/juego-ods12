//server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const URI_DIRECTA = "mongodb://logicalduck:puffle2121@ac-aauoy7b-shard-00-00.dlpqatj.mongodb.net:27017,ac-aauoy7b-shard-00-01.dlpqatj.mongodb.net:27017,ac-aauoy7b-shard-00-02.dlpqatj.mongodb.net:27017/juego_ods12?replicaSet=atlas-vxkbsl-shard-0&ssl=true&authSource=admin";

console.log("Intentando conectar a la base de datos...");

mongoose.connect(URI_DIRECTA)
  .then(() => console.log('Conectado a MongoDB Atlas exitosamente'))
  .catch(err => console.error('Error conectando a MongoDB:', err));

// --- Esquema del coso del modelo de datos o algo así ajá ---
const jugadorSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    puntos: { type: Number, default: 0 },
    inventario: {
        plastico: { type: Number, default: 0 },
        papel: { type: Number, default: 0 }
    }
});

const Jugador = mongoose.model('Jugador', jugadorSchema);

// --- RUTAS CRUD (API) ---

// Crear o cargar jugador
app.post('/api/jugador', async (req, res) => {
    const { username } = req.body;
    try {
        let jugador = await Jugador.findOne({ username });
        if (!jugador) {
            jugador = new Jugador({ username });
            await jugador.save();
            console.log(`Nuevo jugador creado en Atlas: ${username}`);
        } else {
            console.log(`Jugador regresó: ${username}`);
        }
        res.json(jugador);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar/crear jugador' });
    }
});

// Guardar progreso
app.put('/api/jugador/guardar', async (req, res) => {
    const { username, puntos, inventario } = req.body;
    try {
        const jugadorActualizado = await Jugador.findOneAndUpdate(
            { username },
            { puntos, inventario },
            { returnDocument: 'after' } 
        );
        console.log(`Progreso guardado en la nube para: ${username}`);
        res.json(jugadorActualizado);
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar progreso' });
    }
});

// Obtener el Ranking (Top 5)
app.get('/api/ranking', async (req, res) => {
    try {
        const topJugadores = await Jugador.find().sort({ puntos: -1 }).limit(5);
        res.json(topJugadores);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener el ranking' });
    }
});

// --- INICIAR SERVIDOR ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});