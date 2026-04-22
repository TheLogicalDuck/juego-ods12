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
ajustarCanvas(); 

const mundo = { ancho: 2000, alto: 2000 };

let nombreUsuario = prompt("Ingresa tu nombre de jugador:") || "Invitado_" + Math.floor(Math.random() * 1000);
document.getElementById('ui-nombre').innerText = nombreUsuario;

// --- ESTADO DEL JUEGO ---
const jugador = {
    id: nombreUsuario, 
    x: mundo.ancho / 2, 
    y: mundo.alto / 2,
    ancho: 40,
    alto: 40,
    velocidadBase: 6,      
    velocidadActual: 6,
    velocidadMinima: 1.5,  
    icono: '🧑', // Gráfico del jugador
    rangoInteraccion: 60, 
    puntos: 0,
    inventario: { plastico: 0, papel: 0 }
};

// MEJORA 1: Dos contenedores separados
const zonasReciclaje = [
    { id: 'plastico', x: mundo.ancho/2 - 120, y: mundo.alto/2 - 60, ancho: 100, alto: 100, color: '#f1c40f', tipo: 'Plástico', titulo: 'PLÁSTICO', icono: '🟡' },
    { id: 'papel', x: mundo.ancho/2 + 20, y: mundo.alto/2 - 60, ancho: 100, alto: 100, color: '#3498db', tipo: 'Papel', titulo: 'PAPEL', icono: '🔵' }
];

// Materiales con sprites (Emojis)
let materiales =[];
for(let i=0; i<40; i++) {
    materiales.push({
        id: i,
        x: Math.random() * mundo.ancho,
        y: Math.random() * mundo.alto,
        tipo: i % 2 === 0 ? 'Plástico' : 'Papel',
        icono: i % 2 === 0 ? '🧴' : '🗞️', // Botella o Periódico
        tamaño: 20,
        recogido: false
    });
}

const teclas = {};
let objetoCercano = null; 

// Para la racha (Mensajes visuales en pantalla)
let efectoVisual = { texto: "", opacidad: 0, x: 0, y: 0 };

function mostrarMensajeFlotante(texto, x, y) {
    efectoVisual = { texto, opacidad: 1, x, y };
}

// --- CONEXIÓN AL BACKEND ---
async function cargarDatosJugador() {
    try {
        const respuesta = await fetch('/api/jugador', {
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
        await fetch('/api/jugador/guardar', {
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
        const respuesta = await fetch('/api/ranking');
        const top5 = await respuesta.json();
        const lista = document.getElementById('lista-ranking');
        lista.innerHTML = ''; 
        
        top5.forEach((j, index) => {
            const li = document.createElement('li');
            
            // Asignar medallas a los top 3
            let medalla = '🏅';
            if (index === 0) medalla = '🥇';
            if (index === 1) medalla = '🥈';
            if (index === 2) medalla = '🥉';

            // Resaltar si soy yo
            let estiloNombre = "color: #e2e8f0;";
            let nombre = j.username;
            if (j.username === jugador.id) {
                estiloNombre = "color: #60a5fa; font-weight: 800;";
                nombre = j.username + " (Tú)";
            }

            li.innerHTML = `
                <span style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.3em;">${medalla}</span> 
                    <span style="${estiloNombre}">${nombre}</span>
                </span>
                <span style="font-weight: 800; color: #4ade80;">${j.puntos}</span>
            `;
            lista.appendChild(li);
        });
    } catch (error) { console.error("Error al ranking:", error); }
}

// --- EVENTOS DE TECLADO ---
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
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); teclas[codigoTecla] = true; });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); teclas[codigoTecla] = false; });
}
configurarBotonTactil('btn-up', 'ArrowUp');
configurarBotonTactil('btn-down', 'ArrowDown');
configurarBotonTactil('btn-left', 'ArrowLeft');
configurarBotonTactil('btn-right', 'ArrowRight');
const btnAccion = document.getElementById('btn-accion');
if(btnAccion) {
    btnAccion.addEventListener('touchstart', (e) => { e.preventDefault(); interactuar(); });
}

// --- LÓGICA DEL JUEGO ---

function interactuar() {
    if (!objetoCercano) return;

    if (objetoCercano.esZona) {
        // MEJORA 1 y 4: Clasificación correcta y Combos
        const zona = objetoCercano;
        let cantidadAReciclar = 0;
        let puntosBase = 0;

        if (zona.tipo === 'Plástico' && jugador.inventario.plastico > 0) {
            cantidadAReciclar = jugador.inventario.plastico;
            puntosBase = cantidadAReciclar * 10;
            jugador.inventario.plastico = 0;
        } 
        else if (zona.tipo === 'Papel' && jugador.inventario.papel > 0) {
            cantidadAReciclar = jugador.inventario.papel;
            puntosBase = cantidadAReciclar * 5;
            jugador.inventario.papel = 0;
        }

        // Si recicló algo correcto en el basurero correcto
        if (cantidadAReciclar > 0) {
            let multiplicador = 1;
            
            // LA RACHA: Si trae 5 o más, doble de puntos
            if (cantidadAReciclar >= 5) {
                multiplicador = 2;
                mostrarMensajeFlotante(`¡COMBO x2! 🔥 +${puntosBase * 2}`, jugador.x, jugador.y);
            } else {
                mostrarMensajeFlotante(`¡Reciclado! +${puntosBase}`, jugador.x, jugador.y);
            }

            jugador.puntos += (puntosBase * multiplicador);
            actualizarPeso();
            actualizarUI();
            guardarProgreso(); 
            obtenerRanking(); 
        } else {
            // Si el basurero es de plástico y solo trae papel
            mostrarMensajeFlotante(`❌ No traes ${zona.tipo}`, jugador.x, jugador.y);
        }

    } else {
        // Recoger material del piso
        const mat = objetoCercano;
        mat.recogido = true;
        
        if(mat.tipo === 'Plástico') jugador.inventario.plastico++;
        if(mat.tipo === 'Papel') jugador.inventario.papel++;
        
        actualizarPeso();
        actualizarUI();
        guardarProgreso();
        setTimeout(() => respawnInteligente(mat), 4000); 
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
    else if (totalItems < 5) uiPeso.innerText = "Normal 🟡 (¡Pronto habrá combo!)";
    else uiPeso.innerText = "¡Lenta! 🔴 (¡Combo Listo!)";
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

    // Revisar proximidad a Zonas
    zonasReciclaje.forEach(zona => {
        const distZona = Math.hypot(centroX - (zona.x + zona.ancho/2), centroY - (zona.y + zona.alto/2));
        if (distZona <= jugador.rangoInteraccion + (zona.ancho/2)) {
            objetoCercano = { ...zona, esZona: true };
        }
    });

    // Revisar proximidad a Materiales (Si no está en una zona)
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

    // Dibujar Zonas de Reciclaje
    zonasReciclaje.forEach(zona => {
        ctx.fillStyle = zona.color;
        ctx.fillRect(zona.x - camara.x, zona.y - camara.y, zona.ancho, zona.alto);
        
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.fillText(zona.titulo, zona.x - camara.x + (zona.ancho/2), zona.y - camara.y + 30);
        
        ctx.font = "40px Arial";
        ctx.fillText(zona.icono, zona.x - camara.x + (zona.ancho/2), zona.y - camara.y + 80);
    });

    // Materiales (SPRITES con Emojis)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    materiales.forEach(mat => {
        if (!mat.recogido) {
            ctx.font = "30px Arial";
            ctx.fillText(mat.icono, mat.x - camara.x, mat.y - camara.y);
        }
    });

    // Jugador (SPRITE con Emoji)
    ctx.font = "40px Arial";
    ctx.fillText(jugador.icono, jugador.x - camara.x + (jugador.ancho/2), jugador.y - camara.y + (jugador.alto/2));

    // Tooltip Flotante de Interacción
    if (objetoCercano) {
        const px = jugador.x - camara.x + jugador.ancho / 2;
        const py = jugador.y - camara.y - 30;
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.beginPath();
        ctx.roundRect(px - 60, py - 35, 120, 30, 5); 
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        
        if (objetoCercano.esZona) {
            ctx.fillText(`Reciclar ${objetoCercano.tipo}`, px, py - 22);
            ctx.fillStyle = objetoCercano.color; 
            ctx.fillText("[ ESPACIO ]", px, py - 10);
        } else {
            ctx.fillText(`Tomar ${objetoCercano.tipo}`, px, py - 22);
            ctx.fillStyle = "#2ecc71"; 
            ctx.fillText("[ ESPACIO ]", px, py - 10);
        }
    }

    // Animación de Mensaje Flotante (Combo)
    if (efectoVisual.opacidad > 0) {
        ctx.fillStyle = `rgba(255, 69, 0, ${efectoVisual.opacidad})`; // Naranja intenso
        ctx.font = "bold 26px Arial";
        ctx.textAlign = "center";
        // Dibuja borde negro para que resalte
        ctx.strokeStyle = `rgba(0, 0, 0, ${efectoVisual.opacidad})`;
        ctx.lineWidth = 4;
        ctx.strokeText(efectoVisual.texto, efectoVisual.x - camara.x + 20, efectoVisual.y - camara.y - 50);
        ctx.fillText(efectoVisual.texto, efectoVisual.x - camara.x + 20, efectoVisual.y - camara.y - 50);
        
        efectoVisual.y -= 1.5; // Sube lentamente
        efectoVisual.opacidad -= 0.015; // Se desvanece
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