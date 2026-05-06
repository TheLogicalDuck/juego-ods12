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

// --- ESTADO DEL JUEGO ---
const jugador = {
    id: "", // Se llena al hacer Login
    x: mundo.ancho / 2, 
    y: mundo.alto / 2,
    ancho: 40,
    alto: 40,
    velocidadBase: 6,      
    velocidadActual: 6,
    velocidadMinima: 1.5,  
    icono: '🧑‍🔧', 
    rangoInteraccion: 60, 
    puntos: 0,
    inventario: { plastico: 0, papel: 0 }
};

// Zonas Separadas de Reciclaje
const zonasReciclaje = [
    { id: 'plastico', x: mundo.ancho/2 - 120, y: mundo.alto/2 - 60, ancho: 100, alto: 100, color: '#f1c40f', tipo: 'Plástico', titulo: 'PLÁSTICO', icono: '🟡' },
    { id: 'papel', x: mundo.ancho/2 + 20, y: mundo.alto/2 - 60, ancho: 100, alto: 100, color: '#3498db', tipo: 'Papel', titulo: 'PAPEL', icono: '🔵' }
];

// Generar Materiales 
let materiales =[];
for(let i=0; i<40; i++) {
    materiales.push({
        id: i,
        x: Math.random() * mundo.ancho,
        y: Math.random() * mundo.alto,
        tipo: i % 2 === 0 ? 'Plástico' : 'Papel',
        icono: i % 2 === 0 ? '🧴' : '🗞️',
        tamaño: 20,
        recogido: false
    });
}

const teclas = {};
let objetoCercano = null; 

// Para la Racha / Combo
let efectoVisual = { texto: "", opacidad: 0, x: 0, y: 0 };
function mostrarMensajeFlotante(texto, x, y) {
    efectoVisual = { texto, opacidad: 1, x, y };
}


// --- SISTEMA DE AUTENTICACIÓN (LOGIN) ---
async function autenticar(accion) {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    const errorTxt = document.getElementById('login-error');

    if (!user || !pass) {
        errorTxt.innerText = "Llena ambos campos.";
        errorTxt.style.display = "block";
        return;
    }

    try {
        const respuesta = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass, accion: accion })
        });
        
        const datos = await respuesta.json();

        if (!respuesta.ok) {
            errorTxt.innerText = datos.error;
            errorTxt.style.display = "block";
        } else {
            // ¡LOGIN EXITOSO!
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('game-ui').style.display = 'block';
            
            // Asignar datos de MongoDB al jugador
            jugador.id = datos.username;
            jugador.puntos = datos.puntos || 0;
            if (datos.inventario) {
                jugador.inventario.plastico = datos.inventario.plastico || 0;
                jugador.inventario.papel = datos.inventario.papel || 0;
            }
            
            document.getElementById('ui-nombre').innerText = jugador.id;
            
            // Iniciar el juego
            actualizarUI();
            actualizarPeso();
            obtenerRanking();
            loop(); 
        }
    } catch (error) {
        errorTxt.innerText = "Error conectando al servidor.";
        errorTxt.style.display = "block";
    }
}


// --- CONEXIÓN AL BACKEND (GUARDAR Y RANKING) ---

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
            
            // Medallas
            let medalla = '🏅';
            if (index === 0) medalla = '🥇';
            if (index === 1) medalla = '🥈';
            if (index === 2) medalla = '🥉';

            // Resaltar Jugador Actual
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

// --- EVENTOS DE CONTROLES ---
window.addEventListener('keydown', (e) => {
    teclas[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        interactuar();
    }
});
window.addEventListener('keyup', (e) => teclas[e.code] = false );

// Celular
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

        if (cantidadAReciclar > 0) {
            let multiplicador = 1;
            
            // COMBO X2
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
            mostrarMensajeFlotante(`❌ No traes ${zona.tipo}`, jugador.x, jugador.y);
        }

    } else {
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
    if (totalItems === 0) { uiPeso.innerText = "Ligera 🟢"; uiPeso.style.color = "#4ade80"; }
    else if (totalItems < 5) { uiPeso.innerText = "Normal 🟡 (Combo pronto)"; uiPeso.style.color = "#fbbf24"; }
    else { uiPeso.innerText = "¡Pesada! 🔴 (Combo Listo)"; uiPeso.style.color = "#ef4444"; }
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

    zonasReciclaje.forEach(zona => {
        const distZona = Math.hypot(centroX - (zona.x + zona.ancho/2), centroY - (zona.y + zona.alto/2));
        if (distZona <= jugador.rangoInteraccion + (zona.ancho/2)) {
            objetoCercano = { ...zona, esZona: true };
        }
    });

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

    zonasReciclaje.forEach(zona => {
        ctx.fillStyle = zona.color;
        ctx.fillRect(zona.x - camara.x, zona.y - camara.y, zona.ancho, zona.alto);
        
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Poppins";
        ctx.textAlign = "center";
        ctx.fillText(zona.titulo, zona.x - camara.x + (zona.ancho/2), zona.y - camara.y + 30);
        
        ctx.font = "40px Arial";
        ctx.fillText(zona.icono, zona.x - camara.x + (zona.ancho/2), zona.y - camara.y + 80);
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    materiales.forEach(mat => {
        if (!mat.recogido) {
            ctx.font = "30px Arial";
            ctx.fillText(mat.icono, mat.x - camara.x, mat.y - camara.y);
        }
    });

    ctx.font = "40px Arial";
    ctx.fillText(jugador.icono, jugador.x - camara.x + (jugador.ancho/2), jugador.y - camara.y + (jugador.alto/2));

    if (objetoCercano) {
        const px = jugador.x - camara.x + jugador.ancho / 2;
        const py = jugador.y - camara.y - 30;
        
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.beginPath();
        ctx.roundRect(px - 60, py - 35, 120, 30, 8); 
        ctx.fill();
        ctx.fillStyle = "white";
        ctx.font = "12px Poppins";
        
        if (objetoCercano.esZona) {
            ctx.fillText(`Reciclar ${objetoCercano.tipo}`, px, py - 22);
            ctx.fillStyle = objetoCercano.color; 
            ctx.fillText("[ ESPACIO ]", px, py - 10);
        } else {
            ctx.fillText(`Tomar ${objetoCercano.tipo}`, px, py - 22);
            ctx.fillStyle = "#4ade80"; 
            ctx.fillText("[ ESPACIO ]", px, py - 10);
        }
    }

    // Animación de Combo
    if (efectoVisual.opacidad > 0) {
        ctx.fillStyle = `rgba(251, 191, 36, ${efectoVisual.opacidad})`; 
        ctx.font = "bold 28px Poppins";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 10;
        ctx.fillText(efectoVisual.texto, efectoVisual.x - camara.x + 20, efectoVisual.y - camara.y - 50);
        ctx.shadowBlur = 0; // Resetear sombra para que no afecte a lo demás
        
        efectoVisual.y -= 1.5; 
        efectoVisual.opacidad -= 0.015; 
    }
}

function loop() {
    actualizarLogica();
    dibujarJuego();
    requestAnimationFrame(loop);
}

// NOTA: El loop ya NO se llama aquí automáticamente. 
// Ahora se llama desde la función autenticar() en la línea 81 cuando el login es correcto.