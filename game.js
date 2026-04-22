//game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- PANTALLA COMPLETA RESPONSIVA ---
const camara = { x: 0, y: 0, ancho: 0, alto: 0 };
function ajustarCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camara.ancho = canvas.width;
    camara.alto = canvas.height;
}
window.addEventListener('resize', ajustarCanvas);
ajustarCanvas(); // Ejecutar una vez al inicio

// --- MUNDO ---
const mundo = { ancho: 2000, alto: 2000 };

// --- PEDIR NOMBRE ---
let nombreUsuario = prompt("Ingresa tu nombre de jugador:") || "Invitado_" + Math.floor(Math.random() * 1000);
document.getElementById('ui-nombre').innerText = nombreUsuario;

// --- ESTADO DEL JUEGO ---
const jugador = {
    id: nombreUsuario, 
    x: mundo.ancho / 2, 
    y: mundo.alto / 2,
    ancho: 30,
    alto: 30,
    velocidadBase: 6,      
    velocidadActual: 6,
    velocidadMinima: 1.5,  
    color: '#3498db', 
    rangoInteraccion: 60, 
    puntos: 0,
    inventario: { plastico: 0, papel: 0 }
};

const zonaReciclaje = {
    x: mundo.ancho / 2 - 60,
    y: mundo.alto / 2 - 60,
    ancho: 120,
    alto: 120,
    color: '#27ae60' 
};

// Materiales
let materiales =[];
for(let i=0; i<30; i++) {
    materiales.push({
        id: i,
        x: Math.random() * mundo.ancho,
        y: Math.random() * mundo.alto,
        tipo: i % 2 === 0 ? 'Plástico' : 'Papel',
        color: i % 2 === 0 ? '#e74c3c' : '#f1c40f',
        tamaño: 12,
        recogido: false
    });
}

const teclas = {};
let objetoCercano = null; 

// --- CONEXIÓN AL BACKEND ---

async function cargarDatosJugador() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/jugador', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: jugador.id })
        });
        const datos = await respuesta.json();
        
        if (datos) {
            jugador.puntos = datos.puntos || 0;
            if (datos.inventario) {
                jugador.inventario.plastico = datos.inventario.plastico || 0;
                jugador.inventario.papel = datos.inventario.papel || 0;
            }
        }
        actualizarUI();
        actualizarPeso();
    } catch (error) { console.error("Error conectando al servidor:", error); }
}

async function guardarProgreso() {
    try {
        await fetch('http://localhost:3000/api/jugador/guardar', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: jugador.id,
                puntos: jugador.puntos,
                inventario: jugador.inventario
            })
        });
    } catch (error) { console.error("Error al guardar:", error); }
}

async function obtenerRanking() {
    try {
        const respuesta = await fetch('http://localhost:3000/api/ranking');
        const top5 = await respuesta.json();
        const lista = document.getElementById('lista-ranking');
        lista.innerHTML = ''; 
        
        top5.forEach(j => {
            const li = document.createElement('li');
            if (j.username === jugador.id) {
                li.innerHTML = `<span style="color: #3498db; font-weight: bold;">${j.username}: ${j.puntos} pts</span>`;
            } else {
                li.innerText = `${j.username}: ${j.puntos} pts`;
            }
            lista.appendChild(li);
        });
    } catch (error) { console.error("Error al ranking:", error); }
}

// --- EVENTOS DE TECLADO (PC) ---
window.addEventListener('keydown', (e) => {
    teclas[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        interactuar();
    }
});
window.addEventListener('keyup', (e) => teclas[e.code] = false );

// --- EVENTOS TÁCTILES (CELULAR) ---
function configurarBotonTactil(idBoton, codigoTecla) {
    const btn = document.getElementById(idBoton);
    if (!btn) return;
    
    // Al tocar la pantalla, simula que presionamos la tecla
    btn.addEventListener('touchstart', (e) => { 
        e.preventDefault(); // Evita clics fantasma
        teclas[codigoTecla] = true; 
    });
    
    // Al soltar la pantalla, simula que soltamos la tecla
    btn.addEventListener('touchend', (e) => { 
        e.preventDefault(); 
        teclas[codigoTecla] = false; 
    });
}

configurarBotonTactil('btn-up', 'ArrowUp');
configurarBotonTactil('btn-down', 'ArrowDown');
configurarBotonTactil('btn-left', 'ArrowLeft');
configurarBotonTactil('btn-right', 'ArrowRight');

// Botón de interacción (Mano)
const btnAccion = document.getElementById('btn-accion');
btnAccion.addEventListener('touchstart', (e) => {
    e.preventDefault();
    interactuar();
});


// --- LÓGICA DEL JUEGO ---

function interactuar() {
    if (!objetoCercano) return;

    if (objetoCercano === 'reciclaje') {
        if (jugador.inventario.plastico > 0 || jugador.inventario.papel > 0) {
            const puntosGanados = (jugador.inventario.plastico * 10) + (jugador.inventario.papel * 5);
            jugador.puntos += puntosGanados;
            jugador.inventario.plastico = 0;
            jugador.inventario.papel = 0;
            
            actualizarPeso();
            actualizarUI();
            guardarProgreso(); 
            obtenerRanking(); 
        }
    } else {
        const mat = objetoCercano;
        mat.recogido = true;
        
        if(mat.tipo === 'Plástico') jugador.inventario.plastico++;
        if(mat.tipo === 'Papel') jugador.inventario.papel++;
        
        actualizarPeso();
        actualizarUI();
        guardarProgreso();
        
        setTimeout(() => respawnInteligente(mat), 5000); 
    }
}

function respawnInteligente(mat) {
    let posicionValida = false;
    let nuevoX, nuevoY;
    while (!posicionValida) {
        nuevoX = Math.random() * (mundo.ancho - 20) + 10;
        nuevoY = Math.random() * (mundo.alto - 20) + 10;
        const dist = Math.hypot(jugador.x - nuevoX, jugador.y - nuevoY);
        if (dist > Math.max(canvas.width, canvas.height) / 2) posicionValida = true;
    }
    mat.x = nuevoX;
    mat.y = nuevoY;
    mat.recogido = false;
}

function actualizarPeso() {
    const totalItems = jugador.inventario.plastico + jugador.inventario.papel;
    jugador.velocidadActual = Math.max(
        jugador.velocidadMinima, 
        jugador.velocidadBase - (totalItems * 0.4)
    );

    const uiPeso = document.getElementById('ui-peso');
    if (totalItems === 0) uiPeso.innerText = "Ligera 🟢";
    else if (totalItems < 5) uiPeso.innerText = "Normal 🟡";
    else if (totalItems < 10) uiPeso.innerText = "Pesada 🟠";
    else uiPeso.innerText = "¡Lenta! 🔴";
}

function actualizarLogica() {
    if (teclas['ArrowUp'] || teclas['KeyW']) jugador.y -= jugador.velocidadActual;
    if (teclas['ArrowDown'] || teclas['KeyS']) jugador.y += jugador.velocidadActual;
    if (teclas['ArrowLeft'] || teclas['KeyA']) jugador.x -= jugador.velocidadActual;
    if (teclas['ArrowRight'] || teclas['KeyD']) jugador.x += jugador.velocidadActual;

    jugador.x = Math.max(0, Math.min(mundo.ancho - jugador.ancho, jugador.x));
    jugador.y = Math.max(0, Math.min(mundo.alto - jugador.alto, jugador.y));

    camara.x = jugador.x + (jugador.ancho / 2) - (camara.ancho / 2);
    camara.y = jugador.y + (jugador.alto / 2) - (camara.alto / 2);

    camara.x = Math.max(0, Math.min(mundo.ancho - camara.ancho, camara.x));
    camara.y = Math.max(0, Math.min(mundo.alto - camara.alto, camara.y));

    objetoCercano = null;
    let distanciaMinima = jugador.rangoInteraccion;
    const centroX = jugador.x + (jugador.ancho / 2);
    const centroY = jugador.y + (jugador.alto / 2);

    const distZona = Math.hypot(centroX - (zonaReciclaje.x + zonaReciclaje.ancho/2), 
                                centroY - (zonaReciclaje.y + zonaReciclaje.alto/2));
    if (distZona <= jugador.rangoInteraccion + (zonaReciclaje.ancho/2)) {
        if (jugador.inventario.plastico > 0 || jugador.inventario.papel > 0) objetoCercano = 'reciclaje';
    }

    if (!objetoCercano) {
        materiales.forEach(mat => {
            if (!mat.recogido) {
                const dist = Math.hypot(centroX - mat.x, centroY - mat.y);
                if (dist <= distanciaMinima) {
                    distanciaMinima = dist;
                    objetoCercano = mat;
                }
            }
        });
    }
}

function actualizarUI() {
    document.getElementById('inv-plastico').innerText = jugador.inventario.plastico;
    document.getElementById('inv-papel').innerText = jugador.inventario.papel;
    document.getElementById('ui-puntos').innerText = jugador.puntos;
}

// --- DIBUJADO ---
function dibujarJuego() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Suelo
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 2;
    for(let i = 0; i <= mundo.ancho; i += 100) {
        ctx.beginPath();
        ctx.moveTo(i - camara.x, -camara.y);
        ctx.lineTo(i - camara.x, mundo.alto - camara.y);
        ctx.stroke();
    }
    for(let i = 0; i <= mundo.alto; i += 100) {
        ctx.beginPath();
        ctx.moveTo(-camara.x, i - camara.y);
        ctx.lineTo(mundo.ancho - camara.x, i - camara.y);
        ctx.stroke();
    }

    // Zona Reciclaje
    ctx.fillStyle = zonaReciclaje.color;
    ctx.fillRect(zonaReciclaje.x - camara.x, zonaReciclaje.y - camara.y, zonaReciclaje.ancho, zonaReciclaje.alto);
    ctx.fillStyle = "white";
    ctx.font = "bold 16px Arial";
    ctx.fillText("CENTRO DE", zonaReciclaje.x - camara.x + 15, zonaReciclaje.y - camara.y + 50);
    ctx.fillText("RECICLAJE", zonaReciclaje.x - camara.x + 15, zonaReciclaje.y - camara.y + 70);

    // Materiales
    materiales.forEach(mat => {
        if (!mat.recogido) {
            ctx.beginPath();
            ctx.arc(mat.x - camara.x, mat.y - camara.y, mat.tamaño, 0, Math.PI * 2);
            ctx.fillStyle = mat.color;
            ctx.fill();
            ctx.closePath();
        }
    });

    // Jugador
    ctx.fillStyle = jugador.color;
    ctx.fillRect(jugador.x - camara.x, jugador.y - camara.y, jugador.ancho, jugador.alto);

    // Tooltip Flotante
    if (objetoCercano) {
        const px = jugador.x - camara.x + jugador.ancho / 2;
        const py = jugador.y - camara.y - 15;
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.beginPath();
        ctx.roundRect(px - 60, py - 35, 120, 30, 5); 
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        
        if (objetoCercano === 'reciclaje') {
            ctx.fillText("Reciclar Todo", px, py - 22);
            ctx.fillStyle = "#f1c40f"; 
            ctx.fillText("TOCA BOTÓN 🖐️", px, py - 10);
        } else {
            ctx.fillText(`Tomar ${objetoCercano.tipo}`, px, py - 22);
            ctx.fillStyle = "#3498db"; 
            ctx.fillText("TOCA BOTÓN 🖐️", px, py - 10);
        }
        ctx.textAlign = "left"; 
    }
}

// --- BUCLE ---
function loop() {
    actualizarLogica();
    dibujarJuego();
    requestAnimationFrame(loop);
}

// --- INICIO ---
cargarDatosJugador(); 
obtenerRanking();     
actualizarPeso();     
loop();