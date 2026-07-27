/**
 * app.js - Cliente Frontend para Skull King Online
 * Maneja la interfaz de usuario, conectividad Socket.IO y síntesis de sonido de juego.
 */

// 1. MOTOR DE SONIDO (Web Audio API sintético - Sin archivos externos)
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playCardSlide() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.15);
    }

    playCoins() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc.frequency.setValueAtTime(1600, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }

    playCannon() {
        if (!this.enabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }

    playTurnBell() {
        if (!this.enabled) return;
        this.init();
        // Primer ding
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
        gain1.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start();
        osc1.stop(this.ctx.currentTime + 0.25);

        // Segundo ding
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1108.73, this.ctx.currentTime + 0.15); // C#6
        gain2.gain.setValueAtTime(0.3, this.ctx.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(this.ctx.currentTime + 0.15);
        osc2.stop(this.ctx.currentTime + 0.5);
    }
}

const sound = new SoundEngine();
const socket = io();

// Estado local
let myAvatar = "🏴‍☠️";
let currentRoom = null;
let myHand = [];
let pendingTigresaCard = null;
let previousTurnPlayerId = null;

// ELEMENTOS DOM
const screenLobby = document.getElementById('screen-lobby');
const screenGame = document.getElementById('screen-game');
const waitingRoom = document.getElementById('waiting-room');
const avatarSelector = document.getElementById('avatar-selector');
const inputPlayerName = document.getElementById('player-name');
const inputRoomCode = document.getElementById('input-room-code');

// BOTONES LOBBY
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnCopyCode = document.getElementById('btn-copy-code');
const btnAddBot = document.getElementById('btn-add-bot');
const btnRemoveBot = document.getElementById('btn-remove-bot');
const btnStartGame = document.getElementById('btn-start-game');

// ELEMENTOS JUEGO
const displayRoundNum = document.getElementById('display-round-num');
const currentPlayerTurn = document.getElementById('current-player-turn');
const ledSuitBadge = document.getElementById('led-suit-badge');
const trickCenter = document.getElementById('trick-center');
const playerHandDiv = document.getElementById('player-hand');
const myAvatarDisplay = document.getElementById('my-avatar-display');
const myBidVal = document.getElementById('my-bid-val');
const myWonVal = document.getElementById('my-won-val');
const myTotalScore = document.getElementById('my-total-score');
const opponentsContainer = document.getElementById('opponents-container');
const turnBanner = document.getElementById('turn-banner');
const turnBannerIcon = document.getElementById('turn-banner-icon');
const playerHandArea = document.querySelector('.player-hand-area');
const trickWinnerBanner = document.getElementById('trick-winner-banner');
const trickWinnerIcon = document.getElementById('trick-winner-icon');
const trickWinnerText = document.getElementById('trick-winner-text');

// MODALES
const modalBidding = document.getElementById('modal-bidding');
const biddingOptions = document.getElementById('bidding-options');
const biddingRoundNum = document.getElementById('bidding-round-num');
const modalTigresa = document.getElementById('modal-tigresa');
const modalScoreboard = document.getElementById('modal-scoreboard');
const btnCloseScoreboard = document.getElementById('btn-close-scoreboard');
const btnShowScores = document.getElementById('btn-show-scores');
const btnNextRound = document.getElementById('btn-next-round');
const btnToggleSound = document.getElementById('btn-toggle-sound');

// --- EVENTOS INTERFAZ ---

// Seleccionar Avatar
avatarSelector.addEventListener('click', (e) => {
    if (e.target.classList.contains('avatar-btn')) {
        document.querySelectorAll('.avatar-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        myAvatar = e.target.dataset.avatar;
    }
});

btnCreateRoom.addEventListener('click', () => {
    const name = inputPlayerName.value.trim() || "Capitán";
    socket.emit('createRoom', { name, avatar: myAvatar });
    sound.playCoins();
});

btnJoinRoom.addEventListener('click', () => {
    const code = inputRoomCode.value.trim();
    const name = inputPlayerName.value.trim() || "Marinero";
    if (!code) return showToast("⚠️ Ingresa un código de sala");
    socket.emit('joinRoom', { code, name, avatar: myAvatar });
    sound.playCoins();
});

btnCopyCode.addEventListener('click', () => {
    const code = document.getElementById('display-room-code').innerText;
    navigator.clipboard.writeText(code);
    showToast("📋 ¡Código copiado al portapapeles!");
});

btnAddBot.addEventListener('click', () => socket.emit('addBot'));
btnRemoveBot.addEventListener('click', () => socket.emit('removeBot'));
btnStartGame.addEventListener('click', () => socket.emit('startGame'));

btnToggleSound.addEventListener('click', () => {
    sound.enabled = !sound.enabled;
    btnToggleSound.innerText = sound.enabled ? "🔊" : "🔇";
});

btnShowScores.addEventListener('click', () => modalScoreboard.classList.remove('hidden'));
btnCloseScoreboard.addEventListener('click', () => modalScoreboard.classList.add('hidden'));
btnNextRound.addEventListener('click', () => {
    modalScoreboard.classList.add('hidden');
    socket.emit('nextRound');
});

// Tigresa botones
document.getElementById('btn-tigresa-pirata').addEventListener('click', () => {
    modalTigresa.classList.add('hidden');
    if (pendingTigresaCard) {
        socket.emit('playCard', { cardId: pendingTigresaCard.id, playedAs: 'Pirata' });
        pendingTigresaCard = null;
        sound.playCardSlide();
        turnBanner.classList.add('hidden');
        if (playerHandArea) playerHandArea.classList.remove('my-turn-active');
    }
});

document.getElementById('btn-tigresa-escape').addEventListener('click', () => {
    modalTigresa.classList.add('hidden');
    if (pendingTigresaCard) {
        socket.emit('playCard', { cardId: pendingTigresaCard.id, playedAs: 'Escape' });
        pendingTigresaCard = null;
        sound.playCardSlide();
        turnBanner.classList.add('hidden');
        if (playerHandArea) playerHandArea.classList.remove('my-turn-active');
    }
});

// --- EVENTOS SOCKET.IO ---

socket.on('errorMsg', (msg) => showToast(msg));

socket.on('roomCreated', ({ code }) => setupWaitingRoom(code));
socket.on('roomJoined', ({ code }) => setupWaitingRoom(code));

function setupWaitingRoom(code) {
    document.getElementById('display-room-code').innerText = code;
    waitingRoom.classList.remove('hidden');
    btnCreateRoom.disabled = true;
    btnJoinRoom.disabled = true;
}

socket.on('roomStateUpdate', (room) => {
    currentRoom = room;

    // 1. ESTADO LOBBY
    if (room.status === 'lobby') {
        const myPlayer = room.players.find(p => p.id === socket.id);
        const isHost = myPlayer && myPlayer.isHost;

        document.getElementById('player-count').innerText = room.players.length;
        const list = document.getElementById('players-list');
        list.innerHTML = '';

        room.players.forEach(p => {
            const li = document.createElement('li');
            if (p.isHost) li.classList.add('is-host');
            li.innerHTML = `
                <span class="avatar">${p.avatar}</span>
                <span class="name">${p.name} ${p.id === socket.id ? '(Tú)' : ''}</span>
                ${p.isHost ? '<span class="tag host-tag">👑 Anfitrión</span>' : ''}
                ${p.isBot ? '<span class="tag">🤖 IA</span>' : ''}
            `;
            list.appendChild(li);
        });

        if (isHost) {
            document.getElementById('host-bot-controls').classList.remove('hidden');
            document.getElementById('host-start-container').classList.remove('hidden');
            document.getElementById('guest-waiting-msg').classList.add('hidden');
        } else {
            document.getElementById('host-bot-controls').classList.add('hidden');
            document.getElementById('host-start-container').classList.add('hidden');
            document.getElementById('guest-waiting-msg').classList.remove('hidden');
        }
        return;
    }

    // 2. ESTADO JUEGO EN MARCHA
    if (screenLobby.classList.contains('active')) {
        screenLobby.classList.remove('active');
        screenLobby.classList.add('hidden');
        screenGame.classList.remove('hidden');
        sound.playCannon();
    }

    // Actualizar barra superior
    displayRoundNum.innerText = `${room.roundNum} / 10`;
    const currentTurnPlayer = room.players[room.currentTurnIndex];
    currentPlayerTurn.innerText = currentTurnPlayer ? (currentTurnPlayer.id === socket.id ? "🔥 ¡TU TURNO! 🔥" : currentTurnPlayer.name) : "---";
    currentPlayerTurn.style.color = (currentTurnPlayer && currentTurnPlayer.id === socket.id) ? "#FFD700" : "#FFF";

    ledSuitBadge.innerText = room.ledSuit || "Ninguno (Libre)";

    // GESTIÓN DEL GRAN BANNER DE TURNO EN PANTALLA
    if (room.status === 'playing' && currentTurnPlayer) {
        turnBanner.classList.remove('hidden');
        if (currentTurnPlayer.id === socket.id) {
            turnBanner.className = 'turn-banner my-turn';
            turnBannerIcon.innerText = "🔥";
            turnBannerText.innerText = "¡ES TU TURNO DE JUGAR, CAPITÁN!";
            if (playerHandArea) playerHandArea.classList.add('my-turn-active');
            if (previousTurnPlayerId !== socket.id) {
                sound.playTurnBell();
            }
        } else {
            turnBanner.className = 'turn-banner opponent-turn';
            turnBannerIcon.innerText = "⏳";
            turnBannerText.innerText = `Turno de: ${currentTurnPlayer.name}`;
            if (playerHandArea) playerHandArea.classList.remove('my-turn-active');
        }
        previousTurnPlayerId = currentTurnPlayer.id;
    } else {
        turnBanner.classList.add('hidden');
        if (playerHandArea) playerHandArea.classList.remove('my-turn-active');
        if (room.status !== 'playing') previousTurnPlayerId = null;
    }

    // GESTIÓN BANNER GANADOR DE BAZA
    if (room.status === 'trickResolving' && room.lastTrickWinner) {
        trickWinnerBanner.classList.remove('hidden');
        turnBanner.classList.add('hidden');
        if (playerHandArea) playerHandArea.classList.remove('my-turn-active');

        let capBonus = "";
        if (room.lastTrickWinner.captureType === 'Sirena_Captures_King') capBonus = " 🧜‍♀️ (+50 PTS)";
        if (room.lastTrickWinner.captureType === 'King_Captures_Pirates') capBonus = " 👑 (+30 PTS)";

        if (room.lastTrickWinner.id === socket.id) {
            trickWinnerBanner.className = 'trick-winner-banner my-victory';
            trickWinnerIcon.innerText = "👑";
            trickWinnerText.innerText = `¡GANASTE LA BAZA!${capBonus}`;
            sound.playCoins();
        } else {
            trickWinnerBanner.className = 'trick-winner-banner';
            trickWinnerIcon.innerText = room.lastTrickWinner.avatar || "🏆";
            trickWinnerText.innerText = `¡BAZA DE ${room.lastTrickWinner.name.toUpperCase()}!${capBonus}`;
            sound.playCardSlide();
        }
    } else {
        trickWinnerBanner.classList.add('hidden');
    }

    // Actualizar estado personal en footer
    const myInfo = room.players.find(p => p.id === socket.id);
    if (myInfo) {
        myAvatarDisplay.innerText = myInfo.avatar;
        myBidVal.innerText = (myInfo.bid !== null && myInfo.bid !== undefined) ? myInfo.bid : "⏳";
        myWonVal.innerText = myInfo.wonTricks || 0;
        myTotalScore.innerText = myInfo.totalScore || 0;
    }

    // Actualizar tapete central con cartas jugadas
    renderTrickCenter(room.trickCards);

    // Renderizar avatares oponentes
    renderOpponents(room.players);

    // 3. ESTADO APUESTAS
    if (room.status === 'bidding') {
        const myPlayer = room.players.find(p => p.id === socket.id);
        if (myPlayer.bid === null || myPlayer.bid === undefined) {
            showBiddingModal(room.roundNum);
        } else {
            modalBidding.classList.add('hidden');
        }
    } else {
        modalBidding.classList.add('hidden');
    }

    // 4. ESTADO FIN DE RONDA OR JUEGO
    if (room.status === 'roundEnd' || room.status === 'gameOver') {
        renderScoreboard(room);
        modalScoreboard.classList.remove('hidden');
        const myPlayer = room.players.find(p => p.id === socket.id);
        if (myPlayer && myPlayer.isHost && room.status === 'roundEnd') {
            btnNextRound.classList.remove('hidden');
        } else {
            btnNextRound.classList.add('hidden');
        }
        if (room.status === 'gameOver') {
            showToast("👑 ¡PARTIDA TERMINADA! ¡REVISA AL GANADOR EN EL CUADERNO DE BITÁCORA!");
            sound.playCoins();
        }
    }

    // Re-evaluar legalidad visual de mi mano
    renderHand(myHand);
});

socket.on('handUpdated', (hand) => {
    myHand = hand || [];
    renderHand(myHand);
    if (!modalBidding.classList.contains('hidden')) {
        renderBiddingHandPreview(myHand);
    }
});

// --- RENDERIZADORES DOM ---

function renderHand(hand) {
    playerHandDiv.innerHTML = '';
    if (!hand || hand.length === 0) return;

    // Verificar legalidad según el palo liderado de la mesa
    const ledSuit = currentRoom ? currentRoom.ledSuit : null;
    const hasLedSuit = hand.some(card => card.type === "Suit" && card.suit === ledSuit);

    hand.forEach(card => {
        const cardImg = document.createElement('img');
        cardImg.src = card.image;
        cardImg.alt = card.name;
        cardImg.className = 'card-in-hand';

        // Validar si es legal
        let isLegal = true;
        if (ledSuit && card.type === "Suit") {
            if (hasLedSuit && card.suit !== ledSuit) {
                isLegal = false;
            }
        }

        if (!isLegal) {
            cardImg.classList.add('illegal');
        }

        cardImg.addEventListener('click', () => {
            if (!currentRoom || currentRoom.status !== 'playing') return;
            const currentTurnPlayer = currentRoom.players[currentRoom.currentTurnIndex];
            if (!currentTurnPlayer || currentTurnPlayer.id !== socket.id) {
                return showToast("⏳ Espera tu turno de juego...");
            }
            if (!isLegal) {
                return showToast(`⚠️ ¡Debes seguir el palo liderado (${ledSuit}) si tienes cartas de ese color!`);
            }

            if (card.type === "Tigresa") {
                pendingTigresaCard = card;
                modalTigresa.classList.remove('hidden');
            } else {
                socket.emit('playCard', { cardId: card.id });
                sound.playCardSlide();
                turnBanner.classList.add('hidden');
                if (playerHandArea) playerHandArea.classList.remove('my-turn-active');
            }
        });

        playerHandDiv.appendChild(cardImg);
    });
}

function renderTrickCenter(trickCards) {
    trickCenter.innerHTML = '';
    if (!trickCards || trickCards.length === 0) {
        trickCenter.innerHTML = '<div class="empty-table-msg" id="empty-table-msg">Esperando jugadas...</div>';
        return;
    }

    trickCards.forEach(item => {
        const slot = document.createElement('div');
        slot.className = 'played-card-slot';
        slot.innerHTML = `
            <img src="${item.card.image}" alt="${item.card.name}">
            <div class="player-tag">${item.playerName}</div>
        `;
        trickCenter.appendChild(slot);
    });
}

function renderOpponents(players) {
    opponentsContainer.innerHTML = '';
    const opps = players.filter(p => p.id !== socket.id);
    
    opps.forEach(p => {
        const div = document.createElement('div');
        div.className = 'opponent-badge glass-panel';
        div.style.padding = '8px 15px';
        div.style.margin = '5px';
        div.style.display = 'inline-flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        div.style.fontSize = '0.85rem';

        div.innerHTML = `
            <span style="font-size: 1.5rem;">${p.avatar}</span>
            <div>
                <strong style="color: #FFD700;">${p.name}</strong><br>
                <span>Apuesta: ${p.bid !== null ? p.bid : '⏳'} | Bazas: ${p.wonTricks}</span>
            </div>
        `;
        opponentsContainer.appendChild(div);
    });
}

function renderBiddingHandPreview(hand) {
    const previewDiv = document.getElementById('bidding-hand-preview');
    if (!previewDiv) return;
    previewDiv.innerHTML = '';
    if (!hand || hand.length === 0) {
        previewDiv.innerHTML = '<span style="color:#A0A4B8; font-style:italic;">⏳ Cargando cartas de tu mano...</span>';
        return;
    }
    hand.forEach(card => {
        const img = document.createElement('img');
        img.src = card.image;
        img.alt = card.name;
        img.title = `${card.name} (${card.type === 'Suit' ? card.suit + ' ' + card.value : card.type})`;
        previewDiv.appendChild(img);
    });
}

function showBiddingModal(roundNum) {
    biddingRoundNum.innerText = roundNum;
    biddingOptions.innerHTML = '';
    
    renderBiddingHandPreview(myHand);

    for (let i = 0; i <= roundNum; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-bid';
        btn.innerHTML = `${i} <span>${i === 1 ? 'Baza' : 'Bazas'}</span>`;
        btn.addEventListener('click', () => {
            socket.emit('submitBid', { bid: i });
            modalBidding.classList.add('hidden');
            sound.playCoins();
        });
        biddingOptions.appendChild(btn);
    }
    modalBidding.classList.remove('hidden');
}

function renderScoreboard(room) {
    const container = document.getElementById('scoreboard-table-container');
    let html = `
        <table class="score-table">
            <thead>
                <tr>
                    <th>Capitán</th>
                    <th>Apuesta</th>
                    <th>Ganadas</th>
                    <th>Puntos Ronda</th>
                    <th>PUNTUACIÓN TOTAL</th>
                </tr>
            </thead>
            <tbody>
    `;

    const getTotal = (p) => (room.totalScores && room.totalScores[p.id] !== undefined) ? room.totalScores[p.id] : (p.totalScore || 0);
    const getBid = (p) => (room.bids && room.bids[p.id] !== undefined) ? room.bids[p.id] : (p.bid !== undefined && p.bid !== null ? p.bid : '-');
    const getWon = (p) => (room.wonTricks && room.wonTricks[p.id] !== undefined) ? room.wonTricks[p.id] : (p.wonTricks || 0);

    // Ordenar por puntaje total descendente
    const sorted = [...room.players].sort((a, b) => getTotal(b) - getTotal(a));

    sorted.forEach((p, index) => {
        const rScore = (room.roundScores && room.roundScores[p.id]) ? room.roundScores[p.id].roundScore : 0;
        const tScore = getTotal(p);
        const exact = (room.roundScores && room.roundScores[p.id]) ? room.roundScores[p.id].exact : false;

        html += `
            <tr style="${index === 0 ? 'background: rgba(255,215,0,0.1);' : ''}">
                <td class="player-cell">
                    ${index === 0 ? '👑' : ''} ${p.avatar} <strong>${p.name}</strong> ${p.id === socket.id ? '(Tú)' : ''}
                </td>
                <td>${getBid(p)}</td>
                <td>${getWon(p)}</td>
                <td style="color: ${exact ? '#00FF7F' : '#FF6347'}; font-weight: 700;">
                    ${rScore > 0 ? '+' : ''}${rScore}
                </td>
                <td style="font-size: 1.2rem; font-weight: 700; color: #FFD700;">${tScore}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;
    container.innerHTML = html;
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast glass-panel gold-border';
    toast.style.padding = '12px 20px';
    toast.style.margin = '10px';
    toast.style.background = 'rgba(139, 0, 0, 0.9)';
    toast.style.color = '#FFF';
    toast.style.fontWeight = '700';
    toast.style.borderRadius = '50px';
    toast.innerText = msg;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = '0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}
