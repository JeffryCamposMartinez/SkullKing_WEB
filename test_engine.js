const GameEngine = require('./gameEngine');
const engine = new GameEngine();

console.log("--- Iniciando Pruebas del Motor de Skull King ---");

// 1. Verificar baraja
const deck = engine.createDeck();
console.log(`Total de cartas generadas: ${deck.length} (esperado: 70)`);
const loros = deck.filter(c => c.suit === "Loro").length;
const negros = deck.filter(c => c.suit === "Bandera_Pirata").length;
const especiales = deck.filter(c => c.type !== "Suit").length;
console.log(`Loros: ${loros}, Banderas Negras: ${negros}, Especiales: ${especiales}`);

// 2. Probar evaluación de baza: Sirena vs Skull King vs Pirata
console.log("\n--- Prueba 1: Sirena vs Skull King vs Pirata ---");
const trick1 = [
    { playerId: "p1", card: deck.find(c => c.id === "Pirata_1") },
    { playerId: "p2", card: deck.find(c => c.id === "Skull_King_1") },
    { playerId: "p3", card: deck.find(c => c.id === "Sirena_1") }
];
const result1 = engine.evaluateTrick(trick1, null);
console.log(`Ganador de la baza: ${result1.winnerId} (esperado: p3, Sirena captura Skull King)`);
console.log(`Tipo de captura: ${result1.captureType}, Piratas en baza: ${result1.piratesInTrick}`);

// 3. Probar evaluación de baza: Triunfo negro vs color básico
console.log("\n--- Prueba 2: Triunfo Negro vs Color Básico ---");
const trick2 = [
    { playerId: "p1", card: deck.find(c => c.id === "Loro_14") },
    { playerId: "p2", card: deck.find(c => c.id === "Bandera_Pirata_2") },
    { playerId: "p3", card: deck.find(c => c.id === "Loro_12") }
];
const result2 = engine.evaluateTrick(trick2, "Loro");
console.log(`Ganador de la baza: ${result2.winnerId} (esperado: p2, Triunfo negro vence a Loro 14)`);

// 4. Probar cálculo de puntos con bonificación
console.log("\n--- Prueba 3: Cálculo de Puntuación con Bonificaciones ---");
// Jugador p3 de Prueba 1 apostó 1 baza y ganó 1 baza (donde capturó al Rey con la Sirena)
const score1 = engine.calculateScore(1, 1, [{ cards: trick1, captureType: result1.captureType }], 5);
console.log(`Apuesta 1, Ganó 1 (con captura de Rey por Sirena): Puntos = ${score1.roundScore} (Esperado: 20 base + 50 bonus = 70)`);

// Jugador p2 de Prueba 2 apostó 2 bazas y ganó 2 bazas (una con Loro 14 que tiene +10 pts)
const score2 = engine.calculateScore(2, 2, [{ cards: trick2, captureType: result2.captureType }], 5);
console.log(`Apuesta 2, Ganó 2 (con Loro 14 capturado): Puntos = ${score2.roundScore} (Esperado: 40 base + 10 bonus = 50)`);

console.log("\n--- ¡Pruebas del motor completadas con éxito! ---");
