/**
 * gameEngine.js - Motor de reglas oficial y resolutor de Skull King
 * Implementación 100% fiel al reglamento oficial (Modo Competitivo Estándar).
 */

class GameEngine {
    constructor() {
        this.SUITS = ["Loro", "Mapa", "Cofre", "Bandera_Pirata"];
        this.SPECIALS = ["Pirata", "Escape", "Sirena", "Tigresa", "Skull_King"];
    }

    /**
     * Genera la baraja completa de 70 cartas.
     */
    createDeck() {
        const deck = [];
        
        // 1. Palos básicos y triunfo (56 cartas)
        for (const suit of this.SUITS) {
            const isTrump = (suit === "Bandera_Pirata");
            const bonus14 = isTrump ? 20 : 10;
            for (let i = 1; i <= 14; i++) {
                deck.push({
                    id: `${suit}_${i}`,
                    type: "Suit",
                    suit: suit,
                    value: i,
                    isTrump: isTrump,
                    bonus14: (i === 14) ? bonus14 : 0,
                    name: `${suit} ${i}`,
                    image: `/images/${suit}/${suit}_${i}.png`
                });
            }
        }

        // 2. Cartas especiales (14 cartas)
        for (let i = 1; i <= 5; i++) {
            deck.push({
                id: `Pirata_${i}`,
                type: "Pirata",
                name: "Pirata",
                image: `/images/Especiales/Pirata_${i}.png`
            });
            deck.push({
                id: `Escape_${i}`,
                type: "Escape",
                name: "Escape",
                image: `/images/Especiales/Escape_${i}.png`
            });
        }
        for (let i = 1; i <= 2; i++) {
            deck.push({
                id: `Sirena_${i}`,
                type: "Sirena",
                name: "Sirena",
                image: `/images/Especiales/Sirena_${i}.png`
            });
        }
        deck.push({
            id: "Tigresa_1",
            type: "Tigresa",
            name: "Tigresa",
            isDual: true,
            image: `/images/Especiales/Tigresa.png`
        });
        deck.push({
            id: "Skull_King_1",
            type: "Skull_King",
            name: "Skull King",
            image: `/images/Especiales/Skull_King.png`
        });

        return deck;
    }

    /**
     * Baraja un arreglo utilizando el algoritmo de Fisher-Yates.
     */
    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Reparte cartas a los jugadores para la ronda actual.
     */
    dealCards(players, roundNum) {
        const deck = this.shuffle(this.createDeck());
        const hands = {};
        for (const player of players) {
            hands[player.id] = deck.splice(0, roundNum);
        }
        return { hands, remainingDeck: deck };
    }

    /**
     * Comprueba qué cartas de la mano son legales para jugar en la baza actual.
     * @param {Array} hand - Cartas en la mano del jugador
     * @param {string|null} ledSuit - Palo liderado en la baza actual (o null si no hay o fue especial)
     */
    getLegalPlays(hand, ledSuit) {
        if (!ledSuit) {
            // Si no hay palo liderado aún, cualquier carta es legal
            return hand;
        }

        const hasLedSuit = hand.some(card => card.type === "Suit" && card.suit === ledSuit);

        return hand.filter(card => {
            // Cartas especiales (Escape, Pirata, Sirena, Tigresa, Skull King) NUNCA están obligadas a seguir el palo
            if (card.type !== "Suit") {
                return true;
            }
            // Si el jugador tiene el palo liderado, solo puede jugar de ese palo o especiales
            if (hasLedSuit) {
                return card.suit === ledSuit;
            }
            // Si no tiene el palo liderado, puede jugar cualquier color o triunfo
            return true;
        });
    }

    /**
     * Determina cuál es la carta y jugador ganador de la baza.
     * @param {Array} playedCards - Array de [{ playerId, card, playedAs }] (playedAs solo para Tigresa: 'Pirata' o 'Escape')
     * @param {string|null} ledSuit - El palo que lideró la baza
     */
    evaluateTrick(playedCards, ledSuit) {
        if (!playedCards || playedCards.length === 0) return null;

        // Mapear cartas considerando la elección de la Tigresa
        const normalized = playedCards.map((item, index) => {
            let effectiveType = item.card.type;
            if (effectiveType === "Tigresa") {
                effectiveType = item.playedAs || "Pirata"; // Por defecto Pirata si no se especificó
            }
            return {
                ...item,
                effectiveType,
                originalIndex: index
            };
        });

        const hasSkullKing = normalized.some(c => c.effectiveType === "Skull_King");
        const hasSirena = normalized.some(c => c.effectiveType === "Sirena");
        const hasPirata = normalized.some(c => c.effectiveType === "Pirata");

        // 1. Regla especial: Sirena + Skull King (+ Pirata opcional)
        // La Sirena captura al Skull King y gana la baza (la primera Sirena si hay dos)
        if (hasSkullKing && hasSirena) {
            const firstSirena = normalized.find(c => c.effectiveType === "Sirena");
            return {
                winnerId: firstSirena.playerId,
                winningCard: firstSirena.card,
                captureType: "Sirena_Captures_King",
                piratesInTrick: normalized.filter(c => c.effectiveType === "Pirata").length
            };
        }

        // 2. Si está el Skull King (sin Sirena) -> Gana el Skull King
        if (hasSkullKing) {
            const king = normalized.find(c => c.effectiveType === "Skull_King");
            return {
                winnerId: king.playerId,
                winningCard: king.card,
                captureType: "King_Captures_Pirates",
                piratesInTrick: normalized.filter(c => c.effectiveType === "Pirata").length
            };
        }

        // 3. Si hay Piratas (sin Skull King) -> Gana el PRIMER Pirata jugado
        if (hasPirata) {
            const firstPirata = normalized.find(c => c.effectiveType === "Pirata");
            return {
                winnerId: firstPirata.playerId,
                winningCard: firstPirata.card,
                captureType: "Normal"
            };
        }

        // 4. Si hay Sirenas (sin Skull King ni Piratas) -> Gana la PRIMERA Sirena jugada
        if (hasSirena) {
            const firstSirena = normalized.find(c => c.effectiveType === "Sirena");
            return {
                winnerId: firstSirena.playerId,
                winningCard: firstSirena.card,
                captureType: "Normal"
            };
        }

        // 5. Solo cartas numeradas y Escapes
        // Filtrar triunfos negros (Bandera_Pirata)
        const trumps = normalized.filter(c => c.effectiveType === "Suit" && c.card.isTrump);
        if (trumps.length > 0) {
            // Gana el triunfo negro de mayor número
            trumps.sort((a, b) => b.card.value - a.card.value);
            return {
                winnerId: trumps[0].playerId,
                winningCard: trumps[0].card,
                captureType: "Normal"
            };
        }

        // Filtrar cartas del palo liderado
        if (ledSuit) {
            const ledCards = normalized.filter(c => c.effectiveType === "Suit" && c.card.suit === ledSuit);
            if (ledCards.length > 0) {
                ledCards.sort((a, b) => b.card.value - a.card.value);
                return {
                    winnerId: ledCards[0].playerId,
                    winningCard: ledCards[0].card,
                    captureType: "Normal"
                };
            }
        }

        // Si nadie siguió el palo, o todos jugaron Escapes / cartas de otros colores sin triunfo
        // Si no hay cartas ganadoras claras, gana la primera carta que se tiró (ej: todos Escapes)
        return {
            winnerId: normalized[0].playerId,
            winningCard: normalized[0].card,
            captureType: "Normal"
        };
    }

    /**
     * Calcula la puntuación para un jugador en una ronda.
     * @param {number} bid - Apuesta del jugador
     * @param {number} wonTricks - Bazas ganadas realmente
     * @param {Array} wonTrickDetails - Detalles de las bazas ganadas (para bonificaciones)
     * @param {number} roundNum - Número de la ronda actual (1 a 10)
     */
    calculateScore(bid, wonTricks, wonTrickDetails, roundNum) {
        let baseScore = 0;
        let bonus = 0;
        const exact = (bid === wonTricks);

        // A. Puntuación Base
        if (bid > 0) {
            if (exact) {
                baseScore = bid * 20;
            } else {
                const diff = Math.abs(wonTricks - bid);
                baseScore = diff * (-10);
            }
        } else {
            // Apuesta de 0
            if (wonTricks === 0) {
                baseScore = roundNum * 10;
            } else {
                baseScore = roundNum * (-10);
            }
        }

        // B. Bonificaciones (SOLO si se acertó la apuesta exacta)
        if (exact && wonTrickDetails && wonTrickDetails.length > 0) {
            for (const trick of wonTrickDetails) {
                // 1. Cartas 14 capturadas en esta baza
                for (const item of trick.cards) {
                    if (item.card.type === "Suit" && item.card.value === 14) {
                        bonus += item.card.bonus14; // +10 o +20 si es negro
                    }
                }

                // 2. Piratas capturados por Skull King
                if (trick.captureType === "King_Captures_Pirates") {
                    bonus += (trick.piratesInTrick || 0) * 30;
                }

                // 3. Skull King capturado por Sirena
                if (trick.captureType === "Sirena_Captures_King") {
                    bonus += 50;
                }
            }
        }

        return {
            baseScore,
            bonus,
            roundScore: baseScore + bonus,
            exact
        };
    }

    /**
     * Lógica de Inteligencia Artificial para las apuestas de un Bot.
     */
    getBotBid(hand, roundNum) {
        let expectedTricks = 0;
        for (const card of hand) {
            if (card.type === "Skull_King") expectedTricks += 1;
            else if (card.type === "Pirata") expectedTricks += 0.8;
            else if (card.type === "Sirena") expectedTricks += 0.6;
            else if (card.isTrump && card.value >= 10) expectedTricks += 0.7;
            else if (card.type === "Suit" && card.value === 14) expectedTricks += 0.5;
        }
        const bid = Math.min(roundNum, Math.round(expectedTricks));
        return bid;
    }

    /**
     * Lógica de Inteligencia Artificial para jugar una carta en turno de Bot.
     */
    getBotPlay(hand, legalCards, trickCards, ledSuit, botBid, botWonTricks) {
        const needsMoreTricks = (botWonTricks < botBid);

        // Elegir carta de las legales
        let chosenCard = legalCards[0];
        let playedAs = "Pirata";

        if (needsMoreTricks) {
            // Intentar jugar la carta más fuerte
            legalCards.sort((a, b) => {
                const getPower = (c) => {
                    if (c.type === "Skull_King") return 100;
                    if (c.type === "Pirata" || c.type === "Tigresa") return 90;
                    if (c.type === "Sirena") return 80;
                    if (c.isTrump) return 50 + c.value;
                    if (c.suit === ledSuit) return 20 + c.value;
                    if (c.type === "Escape") return 0;
                    return c.value;
                };
                return getPower(b) - getPower(a);
            });
            chosenCard = legalCards[0];
            if (chosenCard.type === "Tigresa") playedAs = "Pirata";
        } else {
            // Ya cumplimos la apuesta o queríamos 0 -> intentar perder la baza
            legalCards.sort((a, b) => {
                const getPower = (c) => {
                    if (c.type === "Escape" || (c.type === "Tigresa")) return 0;
                    if (c.type === "Suit" && c.suit !== ledSuit && !c.isTrump) return 5;
                    if (c.type === "Suit") return c.value;
                    return 50;
                };
                return getPower(a) - getPower(b);
            });
            chosenCard = legalCards[0];
            if (chosenCard.type === "Tigresa") playedAs = "Escape";
        }

        return { card: chosenCard, playedAs };
    }
}

module.exports = GameEngine;
