const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const GameEngine = require('./gameEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const engine = new GameEngine();

// Servir estáticos de la app web
app.use(express.static(path.join(__dirname, 'public')));

// Servir la carpeta de imágenes (local o en el directorio superior)
const localImages = path.join(__dirname, 'images');
const imagesPath = fs.existsSync(localImages) ? localImages : path.resolve(__dirname, '../images');
app.use('/images', express.static(imagesPath));
console.log(`[Config] Carpeta de imágenes enlazada desde: ${imagesPath}`);

// Estructura de almacenamiento en memoria para las salas de juego
const rooms = {};

// Nombres temáticos para bots de inteligencia artificial
const BOT_NAMES = [
    "Barbanegra 🏴‍☠️",
    "Anne Bonny ⚔️",
    "Jack Sparrow 🧭",
    "Sir Francis ⚓",
    "Mary Read 🗡️",
    "Davy Jones 🐙",
    "Calico Jack 🪙",
    "Capitán Garfio 🪝"
];

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function broadcastRoomState(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;
    io.to(roomCode).emit('roomStateUpdate', {
        code: room.code,
        status: room.status,
        roundNum: room.roundNum,
        dealerIndex: room.dealerIndex,
        currentTurnIndex: room.currentTurnIndex,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            isBot: p.isBot,
            isHost: p.isHost,
            bid: room.bids[p.id] !== undefined ? room.bids[p.id] : null,
            wonTricks: room.wonTricks[p.id] || 0,
            handCount: room.hands[p.id] ? room.hands[p.id].length : 0,
            totalScore: room.totalScores[p.id] || 0,
            roundScore: room.roundScores[p.id] ? room.roundScores[p.id].roundScore : 0
        })),
        trickCards: room.trickCards,
        ledSuit: room.ledSuit,
        roundScores: room.roundScores,
        totalScores: room.totalScores,
        bids: room.bids,
        wonTricks: room.wonTricks,
        lastTrickWinner: room.lastTrickWinner || null
    });
}

// Bucle de Inteligencia Artificial para el turno automático
function checkAiTurn(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (!currentPlayer || !currentPlayer.isBot) return;

    setTimeout(() => {
        if (!rooms[roomCode] || rooms[roomCode].status !== 'playing') return;
        const hand = room.hands[currentPlayer.id];
        if (!hand || hand.length === 0) return;

        const legalCards = engine.getLegalPlays(hand, room.ledSuit);
        const botBid = room.bids[currentPlayer.id] || 0;
        const botWon = room.wonTricks[currentPlayer.id] || 0;

        const playDecision = engine.getBotPlay(hand, legalCards, room.trickCards, room.ledSuit, botBid, botWon);
        
        handlePlayerPlayCard(roomCode, currentPlayer.id, playDecision.card.id, playDecision.playedAs);
    }, 1500); // 1.5 segundos de retraso para que se sienta humano
}

// Procesar jugada de carta (sea humano o IA)
function handlePlayerPlayCard(roomCode, playerId, cardId, playedAs) {
    const room = rooms[roomCode];
    if (!room || room.status !== 'playing') return;

    const playerIndex = room.players.findIndex(p => p.id === playerId);
    if (playerIndex !== room.currentTurnIndex) return; // No es su turno

    const hand = room.hands[playerId];
    const cardIndex = hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return;

    const card = hand[cardIndex];
    const legalPlays = engine.getLegalPlays(hand, room.ledSuit);
    if (!legalPlays.some(c => c.id === card.id)) return; // Carta ilegal según palo liderado

    // Eliminar carta de la mano
    hand.splice(cardIndex, 1);

    // Si es la primera carta de color numerada, establece el palo liderado
    if (!room.ledSuit && card.type === "Suit" && !card.isTrump) {
        room.ledSuit = card.suit;
    }

    // Añadir a la mesa
    room.trickCards.push({
        playerId,
        playerName: room.players[playerIndex].name,
        card,
        playedAs: card.type === "Tigresa" ? (playedAs || "Pirata") : null
    });

    // Enviar carta jugada individual a su dueño
    const socket = io.sockets.sockets.get(playerId);
    if (socket) {
        socket.emit('handUpdated', hand);
    }

    // Comprobar si se completó la baza (todos jugaron)
    if (room.trickCards.length === room.players.length) {
        room.status = 'trickResolving';
        const evalResult = engine.evaluateTrick(room.trickCards, room.ledSuit);
        const winnerPlayer = room.players.find(p => p.id === evalResult.winnerId);
        room.lastTrickWinner = {
            id: evalResult.winnerId,
            name: winnerPlayer ? winnerPlayer.name : "Capitán",
            avatar: winnerPlayer ? winnerPlayer.avatar : "🏴‍☠️",
            captureType: evalResult.captureType
        };
        broadcastRoomState(roomCode);

        setTimeout(() => {
            if (!rooms[roomCode]) return;
            const winnerId = evalResult.winnerId;

            room.wonTricks[winnerId] = (room.wonTricks[winnerId] || 0) + 1;
            if (!room.wonTrickDetails[winnerId]) room.wonTrickDetails[winnerId] = [];
            room.wonTrickDetails[winnerId].push({
                cards: [...room.trickCards],
                captureType: evalResult.captureType,
                piratesInTrick: evalResult.piratesInTrick
            });

            const winnerIndex = room.players.findIndex(p => p.id === winnerId);
            room.currentTurnIndex = winnerIndex; // El ganador lidera la siguiente baza
            room.trickCards = [];
            room.ledSuit = null;
            room.lastTrickWinner = null;

            // Comprobar si terminó la ronda (no quedan cartas en la mano)
            const remainingCards = room.hands[room.players[0].id].length;
            if (remainingCards === 0) {
                // Calcular puntuaciones de la ronda
                room.status = 'roundEnd';
                for (const p of room.players) {
                    const scoreData = engine.calculateScore(
                        room.bids[p.id],
                        room.wonTricks[p.id] || 0,
                        room.wonTrickDetails[p.id] || [],
                        room.roundNum
                    );
                    room.roundScores[p.id] = scoreData;
                    room.totalScores[p.id] = (room.totalScores[p.id] || 0) + scoreData.roundScore;
                }
                broadcastRoomState(roomCode);
            } else {
                room.status = 'playing';
                broadcastRoomState(roomCode);
                checkAiTurn(roomCode);
            }
        }, 3500); // 3.5 segundos para contemplar la mesa y el ganador de la baza
    } else {
        // Pasar al siguiente turno
        room.currentTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
        broadcastRoomState(roomCode);
        checkAiTurn(roomCode);
    }
}

io.on('connection', (socket) => {
    console.log(`[Socket] Conectado: ${socket.id}`);

    socket.on('createRoom', ({ name, avatar }) => {
        const code = generateRoomCode();
        rooms[code] = {
            code,
            players: [{ id: socket.id, name, avatar: avatar || "🏴‍☠️", isBot: false, isHost: true }],
            status: 'lobby',
            roundNum: 1,
            dealerIndex: 0,
            currentTurnIndex: 0,
            hands: {},
            bids: {},
            wonTricks: {},
            wonTrickDetails: {},
            trickCards: [],
            ledSuit: null,
            roundScores: {},
            totalScores: {}
        };
        socket.join(code);
        socket.roomCode = code;
        socket.emit('roomCreated', { code });
        broadcastRoomState(code);
    });

    socket.on('joinRoom', ({ code, name, avatar }) => {
        const roomCode = code.toUpperCase().trim();
        const room = rooms[roomCode];
        if (!room) {
            return socket.emit('errorMsg', 'La sala no existe. Verifica el código.');
        }
        if (room.status !== 'lobby') {
            return socket.emit('errorMsg', 'La partida ya ha comenzado en esta sala.');
        }
        if (room.players.length >= 6) {
            return socket.emit('errorMsg', 'La sala está llena (máximo 6 jugadores).');
        }

        room.players.push({ id: socket.id, name, avatar: avatar || "⚓", isBot: false, isHost: false });
        socket.join(roomCode);
        socket.roomCode = roomCode;
        socket.emit('roomJoined', { code: roomCode });
        broadcastRoomState(roomCode);
    });

    socket.on('addBot', () => {
        const room = rooms[socket.roomCode];
        if (!room || room.status !== 'lobby') return;
        if (room.players.length >= 6) return;

        const usedNames = room.players.map(p => p.name);
        const availableName = BOT_NAMES.find(n => !usedNames.includes(n)) || `Bot ${room.players.length + 1}`;
        const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        
        room.players.push({ id: botId, name: availableName, avatar: "🤖", isBot: true, isHost: false });
        broadcastRoomState(socket.roomCode);
    });

    socket.on('removeBot', () => {
        const room = rooms[socket.roomCode];
        if (!room || room.status !== 'lobby') return;
        const botIndex = room.players.reverse().findIndex(p => p.isBot);
        if (botIndex !== -1) {
            const realIndex = room.players.length - 1 - botIndex;
            room.players.splice(realIndex, 1);
            room.players.reverse();
        } else {
            room.players.reverse();
        }
        broadcastRoomState(socket.roomCode);
    });

    socket.on('startGame', () => {
        const room = rooms[socket.roomCode];
        if (!room || room.status !== 'lobby') return;
        if (room.players.length < 2) {
            return socket.emit('errorMsg', 'Se necesitan al menos 2 jugadores para comenzar.');
        }

        // Iniciar ronda 1
        startRound(socket.roomCode, 1);
    });

    function startRound(roomCode, roundNum) {
        const room = rooms[roomCode];
        if (!room) return;

        room.roundNum = roundNum;
        room.status = 'bidding';
        room.bids = {};
        room.wonTricks = {};
        room.wonTrickDetails = {};
        room.trickCards = [];
        room.ledSuit = null;
        room.roundScores = {};

        // Repartir cartas
        const dealResult = engine.dealCards(room.players, roundNum);
        room.hands = dealResult.hands;

        // Enviar mano secreta a cada jugador humano
        for (const p of room.players) {
            if (!p.isBot) {
                const s = io.sockets.sockets.get(p.id);
                if (s) s.emit('handUpdated', room.hands[p.id]);
            } else {
                // Calcular apuesta de IA inmediatamente
                const botBid = engine.getBotBid(room.hands[p.id], roundNum);
                room.bids[p.id] = botBid;
            }
        }

        // El turno de salida es para el de la izquierda del repartidor (dealerIndex + 1)
        room.currentTurnIndex = (room.dealerIndex + 1) % room.players.length;
        
        broadcastRoomState(roomCode);
        checkAllBidsSubmitted(roomCode);
    }

    socket.on('submitBid', ({ bid }) => {
        const room = rooms[socket.roomCode];
        if (!room || room.status !== 'bidding') return;
        room.bids[socket.id] = parseInt(bid, 10);
        broadcastRoomState(socket.roomCode);
        checkAllBidsSubmitted(socket.roomCode);
    });

    function checkAllBidsSubmitted(roomCode) {
        const room = rooms[roomCode];
        if (!room || room.status !== 'bidding') return;

        const allBidsIn = room.players.every(p => room.bids[p.id] !== undefined && room.bids[p.id] !== null);
        if (allBidsIn) {
            room.status = 'playing';
            broadcastRoomState(roomCode);
            checkAiTurn(roomCode);
        }
    }

    socket.on('playCard', ({ cardId, playedAs }) => {
        handlePlayerPlayCard(socket.roomCode, socket.id, cardId, playedAs);
    });

    socket.on('nextRound', () => {
        const room = rooms[socket.roomCode];
        if (!room || room.status !== 'roundEnd') return;

        if (room.roundNum >= 10) {
            room.status = 'gameOver';
            broadcastRoomState(socket.roomCode);
        } else {
            room.dealerIndex = (room.dealerIndex + 1) % room.players.length;
            startRound(socket.roomCode, room.roundNum + 1);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Desconectado: ${socket.id}`);
        const room = rooms[socket.roomCode];
        if (room && room.status === 'lobby') {
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0) {
                delete rooms[socket.roomCode];
            } else if (!room.players.some(p => p.isHost) && !room.players[0].isBot) {
                room.players[0].isHost = true;
            }
            broadcastRoomState(socket.roomCode);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🏴‍☠️  Servidor de Skull King Multijugador activo! 🏴‍☠️`);
    console.log(`👉  Local:   http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});
