// ============================================================
//  bot.js — IA pour les joueurs non connectés
//  À charger dans index.html après game.js
//  Dépend de : usableGameState, playersHands, myColor,
//              colorSides, correspondanceCase, socket,
//              myRoomCode, isPawnAtSelection, drawPawn,
//              saveGameState, checkWin, passTurnToNext,
//              showPopUp, clearSelections
// ============================================================

const BOT_DELAY = 1200; // ms entre chaque action du bot

// ─────────────────────────────────────────────────────────────
//  UTILITAIRES PARTAGÉS
// ─────────────────────────────────────────────────────────────

function botGetTeammate(color) {
    if (color === "red")    return "yellow";
    if (color === "yellow") return "red";
    if (color === "blue")   return "green";
    if (color === "green")  return "blue";
    return "";
}

function botGetEnemies(color) {
    const teams = { red: ["red","yellow"], yellow: ["red","yellow"], blue: ["blue","green"], green: ["blue","green"] };
    return colorSides.filter(c => !teams[color].includes(c));
}

// Calcule la destination d'un pion après N cases (retourne null si invalide)
function botComputeDestination(pawn, pawnColor, toMove, allowEnd = true) {
    if (pawn.status === "end") {
        if (toMove < 0) return null;
        let newPlace = pawn.position + toMove;
        if (newPlace > 4) return null;
        for (let i = pawn.position + 1; i <= newPlace; i++) {
            if (isPawnAtSelection(i, pawnColor, "end")) return null;
        }
        return { status: "end", position: newPlace, color_side: pawnColor };
    }

    let currentPlace = pawn.position;
    let newPlace = currentPlace + toMove;
    let teamColorIndex = colorSides.indexOf(pawnColor);
    let previousColor = colorSides[(teamColorIndex + 3) % 4];

    // Entrée dans l'arrivée
    if (allowEnd && pawn.color_side === previousColor && toMove > 0 && newPlace > 20) {
        let step = newPlace - 20;
        if (step <= 4) {
            for (let i = 1; i <= step; i++) {
                if (isPawnAtSelection(i, pawnColor, "end")) return null;
            }
            return { status: "end", position: step, color_side: pawnColor };
        }
        return null;
    }

    for (let i = 1; i < toMove; i++) {
        let pathPlace = pawn.position + i;
        let pathPos = ((pathPlace % 22) + 22) % 22;
        let pathColorShift = Math.floor(pathPlace / 22);
        let pathColor = colorSides[(colorSides.indexOf(pawn.color_side) + pathColorShift + 4) % 4];
        let pathOccupant = isPawnAtSelection(pathPos, pathColor, "board");
        if (pathOccupant && pathOccupant.pawn.position === 0 && pathOccupant.color === pathColor) return null;
    }

    let finalPosition = ((newPlace % 22) + 22) % 22;
    let colorShift = Math.floor(newPlace / 22);
    let finalColorIndex = (colorSides.indexOf(pawn.color_side) + colorShift + 4) % 4;
    let finalColor = colorSides[finalColorIndex];

    // Bloqué par un pion intouchable (case 0 de sa propre couleur)
    let occupant = isPawnAtSelection(finalPosition, finalColor, "board");
    console.log("dest check:", pawnColor, pawn.id, "pos:", finalPosition, finalColor, "occupant:", occupant);
    if (occupant && occupant.pawn.position === 0 && occupant.color === finalColor) return null;

    // Bloqué par un allié
    if (occupant && occupant.color === pawnColor) return null;

    return { status: "board", position: finalPosition, color_side: finalColor, occupant };
}

// Vérifie si un pion est intouchable (case 0 de sa propre couleur)
function botIsUntouchable(pawn, pawnColor) {
    return pawn.status === "board" && pawn.position === 0 && pawn.color_side === pawnColor;
}

// Émet les events socket comme un vrai joueur
function botEmitPlayCard(botColor, cardIndex, card) {
    let cardClass = "card " + ((card.symbol === "♥" || card.symbol === "♦") ? "red" : "black");
    if (card.value === "JOKER") cardClass = "card joker-style";

    socket.emit("playCard", {
        roomCode: myRoomCode,
        color: botColor,
        playedIndex: cardIndex,
        cardValue: card.value,
        cardSymbol: card.symbol,
        cardClass: cardClass
    });
    playersHands[botColor].splice(cardIndex, 1);
}

function botEmitMovePawn(pawnData, pawnColor) {
    socket.emit("movePawn", {
        roomCode: myRoomCode,
        pawnData: { ...pawnData },
        pawnColor: pawnColor
    });
}

function botApplyMove(pawnData, pawnColor, dest, isKing = false) {
    // Tuer les pions sur le chemin (Roi) ou sur la case destination
    if (isKing) {
        for (let i = 1; i <= 13; i++) {
            let pathPlace = pawnData.position + i;
            let pathPos = ((pathPlace % 22) + 22) % 22;
            let colorShift = Math.floor(pathPlace / 22);
            let pathColor = colorSides[(colorSides.indexOf(pawnData.color_side) + colorShift + 4) % 4];
            let occupant = isPawnAtSelection(pathPos, pathColor);
            if (occupant && occupant.color !== pawnColor) {
                occupant.pawn.status = "house";
                occupant.pawn.position = occupant.pawn.id;
                occupant.pawn.color_side = occupant.color;
                drawPawn(occupant.pawn, occupant.color);
                botEmitMovePawn(occupant.pawn, occupant.color);
            }
        }
    } else if (dest.occupant) {
        let occ = dest.occupant;
        occ.pawn.status = "house";
        occ.pawn.position = occ.pawn.id;
        occ.pawn.color_side = occ.color;
        drawPawn(occ.pawn, occ.color);
        botEmitMovePawn(occ.pawn, occ.color);
    }

    pawnData.status = dest.status;
    pawnData.position = dest.position;
    pawnData.color_side = dest.color_side;

    drawPawn(pawnData, pawnColor);
    botEmitMovePawn(pawnData, pawnColor);
    saveGameState();
}

// ─────────────────────────────────────────────────────────────
//  ANALYSE DES COUPS POSSIBLES
// ─────────────────────────────────────────────────────────────

// Retourne tous les coups jouables pour une carte donnée
function botGetPossibleMoves(botColor, cardValue) {
    const moves = [];
    const myPawns = usableGameState[botColor];
    const pawnsOnBoard = myPawns.filter(p => p.status === "board" || p.status === "end");
    const pawnsInHouse = myPawns.filter(p => p.status === "house");
    const enemies = botGetEnemies(botColor);
    console.log(botColor, "onBoard:", pawnsOnBoard, "inHouse:", pawnsInHouse);

    const allOnBoard = [];
    for (const color of colorSides) {
        for (const pawn of usableGameState[color]) {
            if (pawn.status === "board") allOnBoard.push({ pawn, pawnColor: color });
        }
    }

    // Sortir un pion
    if (["K", "A", "JOKER"].includes(cardValue)) {
        if (pawnsInHouse.length > 0 && !isPawnAtSelection(0, botColor)) {
            pawnsInHouse.forEach(pawn => {
                moves.push({ type: "exit", pawn, pawnColor: botColor });
            });
        }
    }

    // Avancer
    if (correspondanceCase[cardValue]) {
        const dist = correspondanceCase[cardValue];
        console.log("pawnsOnBoard pour", botColor, pawnsOnBoard.map(p => ({id: p.id, pos: p.position, color: p.color_side, status: p.status})));
        pawnsOnBoard.forEach(pawn => {
            let dest = botComputeDestination(pawn, botColor, dist);
            if (dest) moves.push({ type: "move", pawn, pawnColor: botColor, dest, dist, isKing: cardValue === "K" });
        });
    }

    // Valet — échange de 2 pions
    if (cardValue === "J" && allOnBoard.length >= 2) {
        for (let i = 0; i < allOnBoard.length; i++) {
            for (let j = i + 1; j < allOnBoard.length; j++) {
                let a = allOnBoard[i];
                let b = allOnBoard[j];
                if (botIsUntouchable(a.pawn, a.pawnColor)) continue;
                if (botIsUntouchable(b.pawn, b.pawnColor)) continue;
                moves.push({ type: "swap", pawnA: a, pawnB: b });
            }
        }
    }

    // 4 — reculer
    if (cardValue === "4") {
        pawnsOnBoard.forEach(pawn => {
            let dest = botComputeDestination(pawn, botColor, -4);
            if (dest) moves.push({ type: "move", pawn, pawnColor: botColor, dest, dist: -4 });
        });
    }

    // 5 — avancer un pion ennemi
    if (cardValue === "5") {
        allOnBoard.forEach(({ pawn, pawnColor }) => {
            if (!enemies.includes(pawnColor)) return;
            if (botIsUntouchable(pawn, pawnColor)) return;
            let dest = botComputeDestination(pawn, pawnColor, 5, false);
            if (dest) moves.push({ type: "move_enemy", pawn, pawnColor, dest, dist: 5 });
        });
    }

    // 7 — combinaisons de mouvements
    if (cardValue === "7") {
        const sevenMoves = botGetSevenMoves(botColor, 7, [], pawnsOnBoard);
        sevenMoves.forEach(combo => moves.push({ type: "seven", combo }));
    }

    return moves;
}

// Génère toutes les combinaisons valides pour le 7
function botGetSevenMoves(botColor, remaining, usedPawnIds, availablePawns) {
    if (remaining === 0) return [[]];
    const results = [];

    availablePawns.forEach(pawn => {
        if (botIsUntouchable(pawn, botColor)) return;
        if (usedPawnIds.includes(pawn.id)) return;
        const minDist = (availablePawns.filter(p => !usedPawnIds.includes(p.id)).length === 1) ? remaining : 1;

        for (let d = minDist; d <= remaining; d++) {
            let dest = botComputeDestination(pawn, botColor, d);
            if (!dest) continue;

            let subMoves = botGetSevenMoves(
                botColor, remaining - d,
                [...usedPawnIds, pawn.id],
                availablePawns
            );
            subMoves.forEach(sub => results.push([{ pawn, pawnColor: botColor, dest, dist: d }, ...sub]));
        }
    });
    return results;
}

// ─────────────────────────────────────────────────────────────
//  SCORING — évaluation d'un coup
// ─────────────────────────────────────────────────────────────

function botScoreMove(move, botColor) {
    const enemies = botGetEnemies(botColor);
    const teammate = botGetTeammate(botColor);
    let score = 0;

    if (move.type === "exit") {
        score += 50;
        return score;
    }

    if (move.type === "seven") {
        let total = 0;
        move.combo.forEach(m => total += botScoreSingleMove(m, botColor, enemies, teammate));
        return total;
    }

    if (move.type === "swap") {
        return botScoreSwap(move, botColor, enemies, teammate);
    }

    if (move.type === "move" || move.type === "move_enemy") {
        return botScoreSingleMove(move, botColor, enemies, teammate);
    }

    return score;
}

function botScoreSingleMove(move, botColor, enemies, teammate) {
    let score = 0;
    const { pawn, pawnColor, dest } = move;

    // Avancer vers l'arrivée vaut des points
    if (dest.status === "end") {
        score += 80 + dest.position * 10;
        return score;
    }

    // Manger un ennemi
    if (dest.occupant && enemies.includes(dest.occupant.color)) {
        score += 100;
        // Bonus si l'ennemi était proche de l'arrivée
        score += dest.occupant.pawn.position * 2;
    }

    // Éviter de manger un allié (4, valet, etc.)
    if (dest.occupant && dest.occupant.color === teammate) {
        score -= 200;
    }

    // Avancer en général
    if (move.dist > 0) score += move.dist * 2;

    // Pénalité si on recule (4)
    if (move.dist < 0) score -= 20;

    // Bonus si on sort un pion de la zone de départ (case 0-3)
    if (pawn.position < 4 && dest.position >= 4) score += 15;
    // Pénalité si on va sur une case très exposée
    if (dest.position > 15) score -= 5;

    // move_enemy : avancer un pion ennemi est généralement mauvais
    if (move.type === "move_enemy") {
        score = -50;
    }

    return score;
}

function botScoreSwap(move, botColor, enemies, teammate) {
    const { pawnA, pawnB } = move;
    let score = 0;

    const isAEnemy = enemies.includes(pawnA.pawnColor);
    const isBEnemy = enemies.includes(pawnB.pawnColor);
    const isAMine = pawnA.pawnColor === botColor;
    const isBMine = pawnB.pawnColor === botColor;
    const isATeammate = pawnA.pawnColor === teammate;
    const isBTeammate = pawnB.pawnColor === teammate;

    // Échanger pour mettre un de nos pions plus loin
    if (isAMine && isBEnemy && pawnB.pawn.position > pawnA.pawn.position) score += 60;
    if (isBMine && isAEnemy && pawnA.pawn.position > pawnB.pawn.position) score += 60;

    // Échanger pour reculer un ennemi
    if (isAMine && isBEnemy && pawnA.pawn.position > pawnB.pawn.position) score += 40;
    if (isBMine && isAEnemy && pawnB.pawn.position > pawnA.pawn.position) score += 40;

    // Éviter d'échanger avec son coéquipier
    if (isATeammate || isBTeammate) score -= 30;

    return score;
}

// ─────────────────────────────────────────────────────────────
//  CERVEAU DU BOT — choisit et exécute le meilleur coup
// ─────────────────────────────────────────────────────────────

function botChooseCard(botColor) {
    const hand = playersHands[botColor];
    if (!hand || hand.length === 0) return null;

    let bestCardIndex = -1;
    let bestMove = null;
    let bestScore = -Infinity;

    hand.forEach((card, index) => {
        const moves = botGetPossibleMoves(botColor, card.value);
        console.log(card.value, moves);
        if (moves.length === 0) return;

        moves.forEach(move => {
            let s = botScoreMove(move, botColor);

            if (s > bestScore) {
                bestScore = s;
                bestCardIndex = index;
                bestMove = move;
            }
        });
    });

    return { cardIndex: bestCardIndex, move: bestMove };
}

function botExecuteMove(move, botColor, onDone) {
    if (!move) { if (onDone) onDone(); return; }

    if (move.type === "exit") {
        let occupant = isPawnAtSelection(0, botColor, "board");
        if (occupant && occupant.color !== botColor) {
            occupant.pawn.status = "house";
            occupant.pawn.position = occupant.pawn.id;
            occupant.pawn.color_side = occupant.color;
            drawPawn(occupant.pawn, occupant.color);
            botEmitMovePawn(occupant.pawn, occupant.color);
        }
        
        move.pawn.status = "board";
        move.pawn.position = 0;
        move.pawn.color_side = botColor;
        drawPawn(move.pawn, botColor);
        botEmitMovePawn(move.pawn, botColor);
        saveGameState();
        if (onDone) onDone();
        return;
    }

    if (move.type === "swap") {
        const { pawnA, pawnB } = move;
        const posA = pawnA.pawn.position;
        const colorA = pawnA.pawn.color_side;
        pawnA.pawn.position = pawnB.pawn.position;
        pawnA.pawn.color_side = pawnB.pawn.color_side;
        pawnB.pawn.position = posA;
        pawnB.pawn.color_side = colorA;
        drawPawn(pawnA.pawn, pawnA.pawnColor);
        drawPawn(pawnB.pawn, pawnB.pawnColor);
        botEmitMovePawn(pawnA.pawn, pawnA.pawnColor);
        botEmitMovePawn(pawnB.pawn, pawnB.pawnColor);
        saveGameState();
        if (onDone) onDone();
        return;
    }

    if (move.type === "seven") {
        botExecuteSevenCombo(move.combo, 0, () => {
            if (!checkWin()) passTurnToNext();
        });
        return;
    }

    if (move.type === "move" || move.type === "move_enemy") {
        botApplyMove(move.pawn, move.pawnColor, move.dest, move.isKing || false);
        if (onDone) onDone();
        return;
    }
}

function botExecuteSevenCombo(combo, index, onDone) {
    if (index >= combo.length) {
        if (onDone) onDone();
        return;
    }
    const step = combo[index];
    botApplyMove(step.pawn, step.pawnColor, step.dest);
    if (index + 1 < combo.length) {
        setTimeout(() => botExecuteSevenCombo(combo, index + 1, onDone), BOT_DELAY / 2);
    } else {
        setTimeout(() => { if (onDone) onDone(); }, BOT_DELAY / 2);
    }
}

function botShowCardOnDiscard(card) {
    const playedCard = document.createElement("div");
    playedCard.className = `card ${(card.symbol === "♥" || card.symbol === "♦") ? "red" : "black"}`;
    if (card.value === "JOKER") playedCard.className = "card joker-style";
    playedCard.setAttribute("data-value", card.value);
    playedCard.setAttribute("data-symbol", card.symbol);
    playedCard.innerHTML = `<span class="center-sym">${card.symbol}</span>`;
    const angle = Math.floor(Math.random() * 40) - 20;
    playedCard.style.cssText = `position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(${angle}deg); pointer-events:none;`;
    discardElement.appendChild(playedCard);
    displayHands();
}

// ─────────────────────────────────────────────────────────────
//  POINT D'ENTRÉE — appelé depuis game.js à chaque tour
// ─────────────────────────────────────────────────────────────

function botPlayTurn(botColor) {
    const hand = playersHands[botColor];
    if (!hand || hand.length === 0) {
        passTurnToNext();
        return;
    }

    showPopUp(`🤖 ${botColor.toUpperCase()} réfléchit...`);

    setTimeout(() => {
        const choice = botChooseCard(botColor);

        if (!choice || choice.cardIndex === -1) {
            // Aucun coup possible → défausse la première carte
            const card = hand[0];
            botEmitPlayCard(botColor, 0, card);
            botShowCardOnDiscard(card);
            showPopUp(`🤖 ${botColor.toUpperCase()} défausse`);
            setTimeout(() => {
                if (!checkWin()) passTurnToNext();
            }, BOT_DELAY / 2);
            return;
        }

        const card = hand[choice.cardIndex];
        botEmitPlayCard(botColor, choice.cardIndex, card);
        console.log("discardElement:", discardElement);
        console.log("botShowCardOnDiscard:", typeof botShowCardOnDiscard);
        botShowCardOnDiscard(card);
        showPopUp(`🤖 ${botColor.toUpperCase()} joue ${card.value}`);

        setTimeout(() => {
            botExecuteMove(choice.move, botColor, () => {
                if (!checkWin()) passTurnToNext();
            });
        }, BOT_DELAY / 2);

    }, BOT_DELAY);
}

// ─────────────────────────────────────────────────────────────
//  ÉCHANGE INTELLIGENT
// ─────────────────────────────────────────────────────────────

function botChooseBestExchangeCard(botColor) {
    const hand = playersHands[botColor];
    if (!hand || hand.length === 0) return 0;

    const teammate = botGetTeammate(botColor);
    const teammateState = usableGameState[teammate] || [];
    const EXIT_CARDS = ["A", "K", "JOKER"];

    // ── Priorité 1 : si ≥2 cartes de sortie, donner la moins utile parmi elles ──
    const exitCards = hand.map((c, i) => ({ card: c, index: i }))
                          .filter(({ card }) => EXIT_CARDS.includes(card.value));

    if (exitCards.length >= 2) {
        // Parmi les cartes de sortie, garde celle qui génère le moins de moves utiles
        let worstIndex = exitCards[0].index;
        let worstScore = Infinity;
        exitCards.forEach(({ card, index }) => {
            const moves = botGetPossibleMoves(botColor, card.value);
            const score = moves.reduce((s, m) => s + botScoreMove(m, botColor), 0);
            if (score < worstScore) { worstScore = score; worstIndex = index; }
        });
        return worstIndex;
    }

    // ── Priorité 2 : carte qui permet au coéquipier de manger un ennemi ──
    const teammateOnBoard = teammateState.filter(p => p.status === "board");
    const enemies = botGetEnemies(teammate);
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (EXIT_CARDS.includes(card.value)) continue; // garde les sorties uniques
        const dist = correspondanceCase[card.value];
        if (!dist || dist < 0) continue;
        for (const pawn of teammateOnBoard) {
            const dest = botComputeDestination(pawn, teammate, dist);
            if (dest && dest.occupant && enemies.includes(dest.occupant.color)) {
                return i;
            }
        }
    }

    // ── Priorité 3 : carte qui permet au coéquipier de rentrer dans l'arrivée ──
    for (let i = 0; i < hand.length; i++) {
        const card = hand[i];
        if (EXIT_CARDS.includes(card.value)) continue;
        const dist = correspondanceCase[card.value];
        if (!dist || dist < 0) continue;
        for (const pawn of teammateOnBoard) {
            const dest = botComputeDestination(pawn, teammate, dist);
            if (dest && dest.status === "end") return i;
        }
    }

    // ── Fallback : carte la moins utile pour soi ──
    let worstIndex = 0;
    let worstScore = Infinity;
    hand.forEach((card, index) => {
        if (EXIT_CARDS.includes(card.value) && exitCards.length === 1) return; // garde la seule sortie
        const moves = botGetPossibleMoves(botColor, card.value);
        const score = moves.length === 0 ? -1 :
            moves.reduce((s, m) => s + botScoreMove(m, botColor), 0);
        if (score < worstScore) { worstScore = score; worstIndex = index; }
    });
    return worstIndex;
}

// ─────────────────────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────────────────────

// Appelé depuis game.js pour savoir si la couleur est un bot
function isBotColor(color) {
    return !realPlayers.includes(color);
}

// Appelé au début de chaque tour
function handleBotTurnIfNeeded(color) {
    if (isBotColor(color)) {
        botPlayTurn(color);
        return true;
    }
    return false;
}