function applyArcCircle(container) {
    const cardsInHand = container.querySelectorAll(".card");
    const nbCards = cardsInHand.length;

    const maxAngle = 50; 
    let startAngle = 0;
    let stepAngle = 0;

    if (nbCards > 1) {
        startAngle = -maxAngle / 2;
        stepAngle = maxAngle / (nbCards - 1);
    }
    cardsInHand.forEach((cardDiv, index) => {
        let currentAngle = startAngle + (index * stepAngle);
        let offsetY = Math.abs(currentAngle) * 0.8; 
        cardDiv.style.setProperty('--angle', `${currentAngle}deg`);
        cardDiv.style.setProperty('--offsetY', `${offsetY}px`);
        cardDiv.style.zIndex = index;
    });
}

function cardSelection() {
    const allCards = document.querySelectorAll(".hand-container .card");
    allCards.forEach(cardDiv => {
        cardDiv.addEventListener("click", (event) => {
            const owner = cardDiv.getAttribute("data-owner");
            if (owner !== myAssignedColor) {
                showPopUp("Ce ne sont pas tes cartes !");
                return;
            }

            if (isExchangePhase) {
                if (teamExchanges[myAssignedColor]) return;

                allCards.forEach(card => card.classList.remove("selected"));
                cardDiv.classList.add("selected");
                
                myExchangeIndex = parseInt(cardDiv.getAttribute("data-index"));
                
                let mySlot = document.getElementById("my-exchange-slot");
                mySlot.className = cardDiv.className;
                mySlot.classList.remove("selected");
                mySlot.setAttribute("data-value", cardDiv.getAttribute("data-value"));
                mySlot.setAttribute("data-symbol", cardDiv.getAttribute("data-symbol"));
                mySlot.innerHTML = `<span class="center-sym">${cardDiv.getAttribute("data-symbol")}</span>`;
                
                document.getElementById("btn-confirm-exchange").style.display = "block";
                let myHand = document.getElementById(`hand-${myAssignedColor}`);
                if (myHand) myHand.classList.add("exchange-selected");

                return;
            }
            
            if (myAssignedColor !== myColor) {
                showPopUp("Patience, ce n'est pas encore ton tour !");
                return;
            }
            if (needToMovePawn) {
                console.log("You need to move a Pawn !");
                return;
            }
            event.stopPropagation();
            allCards.forEach(card => card.classList.remove("selected"));
            document.getElementById(`hand-${myColor}`).classList.add("receded");
            cardDiv.classList.add("selected");
            selectedCard = cardDiv;
        })
    });
}

function drawPawn(pawnData, pawnColor) {
    const boardPawn = document.getElementById(`pion-${pawnColor}-${pawnData.id}`);
    if (pawnData.status === "board") {
        const placement = document.getElementById(`${pawnData.color_side}-${pawnData.position}`);
        const xPlacement = placement.getAttribute("cx");
        const yPlacement = placement.getAttribute("cy");

        boardPawn.setAttribute("cx", xPlacement);
        boardPawn.setAttribute("cy", yPlacement);

        placement.parentNode.appendChild(boardPawn);
    } else if (pawnData.status === "house") {
        const placement = document.getElementById(`${pawnColor}-house-${pawnData.position}`);
        const branchGroup = document.getElementById(`arc-${pawnData.color_side}`);

        branchGroup.appendChild(boardPawn);
        boardPawn.setAttribute("cx", "50"); 
        boardPawn.setAttribute("cy", 360 - ((pawnData.id - 1) * 40));
    } else if (pawnData.status === "end") {
        const placement = document.getElementById(`end-${pawnColor}-${pawnData.position}`);
        const xPlacement = placement.getAttribute("cx");
        const yPlacement = placement.getAttribute("cy");

        boardPawn.setAttribute("cx", xPlacement);
        boardPawn.setAttribute("cy", yPlacement);
        placement.parentNode.appendChild(boardPawn);
    }
}

function loadPosition() {
    const savedState = localStorage.getItem("game_state");
    if (savedState) {
        usableGameState = JSON.parse(savedState);
        drawAllPawns();
    } else {
        fetch("gameState.json")
            .then(response => response.json())
            .then(data => {
                const gameState = data;
                usableGameState = gameState.board;
                for (const color of colorSides) {
                    for (const pawn of usableGameState[color]) {
                        drawPawn(pawn, color);
                    }
                }
            });
    }
    }

function saveGameState() {
    localStorage.setItem("game_state", JSON.stringify(usableGameState));
    console.log("Partie Sauvegardée !!\n");
}

function drawAllPawns() {
    for (const color of colorSides) {
        for (const pawn of usableGameState[color]) {
            drawPawn(pawn, color);
        }
    }
}

function setupMovement(pawn, pawnColor, toMove, isKing = false) {
    let isInsideHouse = (pawn.status === "end");
    let targetStatus = "board";
    let finalPosition = 0;
    let finalColor = "";
    let isPawnAtDestination = null;
    let isEnteringHouse = false;

    if (isInsideHouse) {
        if (toMove < 0) return;
        let newPlace = pawn.position + toMove;
        if (newPlace > 4) return;

        for (let i = pawn.position + 1; i <= newPlace; i++) {
            if (isPawnAtSelection(i, pawnColor, "end")) return;
        }

        finalPosition = newPlace;
        finalColor = pawnColor;
        targetStatus = "end";
        isEnteringHouse = true;
    } else {
        let currentPlace = pawn.position;
        let newPlace = currentPlace + toMove;
        let teamColorIndex = colorSides.indexOf(pawnColor);
        let previousColor = colorSides[(teamColorIndex + 3) % 4];

        if (pawn.color_side === previousColor && toMove > 0 && newPlace > 20) {
            let step = newPlace - 20;
            if (step <= 4) {
                let isBlocked = false;
                for (let i = 1; i <= step; i++) {
                    if (isPawnAtSelection(i, pawnColor, "end")) {
                        isBlocked = true;
                        break;
                    }
                }
                if (!isBlocked) {
                    finalPosition = step;
                    finalColor = pawnColor;
                    targetStatus = "end";
                    isEnteringHouse = true;
                }
            }
        }
        if (!isEnteringHouse) {
            finalPosition = ((newPlace % 22) + 22) % 22;
            let colorShift = Math.floor(newPlace / 22); 
            let finalColorIndex = (colorSides.indexOf(pawn.color_side) + colorShift + 4) % 4;
            finalColor = colorSides[finalColorIndex];
            
            isPawnAtDestination = isPawnAtSelection(finalPosition, finalColor, "board");
        }
    }

    if (isEnteringHouse || !isPawnAtDestination || isPawnAtDestination.color !== pawnColor) {
        needToMovePawn = true;
        const boardPawn = document.getElementById(`pion-${pawnColor}-${pawn.id}`);
        boardPawn.onclick = (event) => {
            if (boardPawn.classList.contains("target-case")) return;
            event.stopPropagation();
            clearSelections();
            boardPawn.classList.add("playable");

            let targetVisual;
            if (isEnteringHouse) {
                targetVisual = document.getElementById(`end-${finalColor}-${finalPosition}`);
            } else if (isPawnAtDestination) {
                targetVisual = document.getElementById(`pion-${isPawnAtDestination.color}-${isPawnAtDestination.pawn.id}`);
            } else {
                targetVisual = document.getElementById(`${finalColor}-${finalPosition}`);
            }
            
            targetVisual.classList.add("target-case");
            targetVisual.setAttribute("data-destination-color", finalColor);
            targetVisual.setAttribute("data-destination-position", finalPosition);
            targetVisual.setAttribute("data-is-king", isKing);
            targetVisual.setAttribute("data-start-position", pawn.position);
            targetVisual.setAttribute("data-start-color", pawn.color_side);
            targetVisual.setAttribute("data-target-status", targetStatus);

            selectedPawn = pawn;
            selectedPawn.pawn_color = pawnColor;
        };
    }
}

function playCard(cardValue) {
    pawnOnBoard = usableGameState[myColor].filter(pawn => pawn.status === "board" || pawn.status === "end");
    pawnsInHouse = usableGameState[myColor].filter(pawn => pawn.status === "house");

    let allPawnsOnBoard = [];
    for (const color of colorSides) {
        for (const pawn of usableGameState[color]) {
            if (pawn.status === "board") {
                allPawnsOnBoard.push({pawn: pawn, pawn_color: color});
            }
        }
    }

    if (cardValue === "K" || cardValue === "A" || cardValue === "JOKER") {
        if (pawnsInHouse.length > 0 && !isPawnAtSelection(0, myColor)) {
            needToMovePawn = true;
            console.log("You can free a pawn !");
            console.log("Waiting for the pawn to move ...");
            pawnsInHouse.forEach(pawn => {
                const boardPawn = document.getElementById(`pion-${myColor}-${pawn.id}`);
                boardPawn.onclick = (event) => {
                    event.stopPropagation();
                    clearSelections()
                    boardPawn.classList.add("playable");
                    const targetVisual = document.getElementById(`${myColor}-0`);
                    targetVisual.classList.add("target-case");
                    targetVisual.setAttribute("data-destination-color", myColor);
                    targetVisual.setAttribute("data-destination-position", 0);
                    targetVisual.setAttribute("data-is-king", false);

                    selectedPawn = pawn;
                    selectedPawn.pawn_color = myColor;
                };
            });
        }
    }
    if (movableValues.includes(cardValue)) {
        if (pawnOnBoard.length > 0) pawnOnBoard.forEach(pawn => setupMovement(pawn, myColor, correspondanceCase[cardValue], cardValue === "K"));
    }
    if (cardValue === "J") {
        if (allPawnsOnBoard.length >= 2) {
            needToMovePawn = true;
            console.log("You can swap 2 pawns !");

            const setupFirstChoice = () => {
                clearSelections();
                allPawnsOnBoard.forEach(pawnData => {
                    const pawnClicked = document.getElementById(`pion-${pawnData.pawn_color}-${pawnData.pawn.id}`);
                    pawnClicked.onclick = event => {
                        event.stopPropagation();
                        clearSelections();
                        pawnClicked.classList.add("playable");
                        allPawnsOnBoard.forEach(pawnDatas => {
                            if (pawnDatas.pawn_color === pawnData.pawn_color && pawnDatas.pawn.id === pawnData.pawn.id) return;
                            const possiblePawn = document.getElementById(`pion-${pawnDatas.pawn_color}-${pawnDatas.pawn.id}`);
                            possiblePawn.classList.add("target-case");
                            possiblePawn.onclick = e => {
                                e.stopPropagation();
                                const posPawnClicked = pawnData.pawn.position;
                                const colorSidePawnClicked = pawnData.pawn.color_side;

                                pawnData.pawn.position = pawnDatas.pawn.position;
                                pawnData.pawn.color_side = pawnDatas.pawn.color_side;

                                pawnDatas.pawn.position = posPawnClicked;
                                pawnDatas.pawn.color_side = colorSidePawnClicked;

                                drawPawn(pawnData.pawn, pawnData.pawn_color);
                                drawPawn(pawnDatas.pawn, pawnDatas.pawn_color);
                                saveGameState();

                                for (const color of colorSides) {
                                    for (let i = 1; i <= 4; i++) {
                                        const visualPawn = document.getElementById(`pion-${color}-${i}`);
                                        if(visualPawn) visualPawn.onclick = null;
                                    }
                                }

                                needToMovePawn = false;
                                clearSelections();
                                if (!checkWin) passTurnToNext();
                            }
                        })
                    }
                });
            }
            setupFirstChoice();

            const originalClearSelections = clearSelections;
            window.tempValetReset = () => {
                if(needToMovePawn) {
                    setupFirstChoice();
                }
            };
        }
    }
    if (cardValue === "4") {
        if (allPawnsOnBoard.length > 0) allPawnsOnBoard.forEach(pawnData => setupMovement(pawnData.pawn, pawnData.pawn_color, -4));
    }
    if (cardValue === "5") {
        let allPawnsOnBoardExeptMyColor = allPawnsOnBoard.filter(pawnData => pawnData.pawn_color !== myColor);
        if (allPawnsOnBoardExeptMyColor.length > 0) allPawnsOnBoardExeptMyColor.forEach(pawnData => setupMovement(pawnData.pawn, pawnData.pawn_color, 5));
    }

    if (cardValue === "7") {
        sevenCredit = 7;
        pawnMovedDuringSeven = [];
        playSeven();
    }

    if (!needToMovePawn) {
        showPopUp("Tu ne peux rien faire avec cette carte");
    }
}

function playSeven() {
    needToMovePawn = true;
    let myPawnsOnBoard = usableGameState[myColor].filter(pawn => (pawn.status === "board" || pawn.status === "end") && !pawnMovedDuringSeven.includes(pawn.id));

    if (myPawnsOnBoard.length === 0) {
        showPopUp("Plus aucun pion pour finir le 7 !");
        sevenCredit = 0;
        needToMovePawn = false;
        return;
    }

    let minimalDistance = (myPawnsOnBoard.length === 1) ? sevenCredit : 1;

    myPawnsOnBoard.forEach(pawn => {
        const boardPawn = document.getElementById(`pion-${myColor}-${pawn.id}`);
        boardPawn.onclick = (event) => {
            if (boardPawn.classList.contains("target-case")) return;
            event.stopPropagation();
            clearSelections();
            boardPawn.classList.add("playable");
            selectedPawn = pawn;
            selectedPawn.pawn_color = myColor;

            for (let i = minimalDistance; i <= sevenCredit; i++) {
                let isInsideHouse = (pawn.status === "end");
                let targetStatus = "board";
                let finalPosition = 0;
                let finalColor = "";
                let isPawnAtDestination = null;
                let isEnteringHouse = false;

                if (isInsideHouse) {
                    let newPlace = pawn.position + i;
                    if (newPlace > 4) continue;

                    let isBlocked = false;
                    for (let step = pawn.position + 1; step <= newPlace; step++) {
                        if (isPawnAtSelection(step, myColor, "end")) {isBlocked = true; break;}
                    }
                    if (isBlocked) continue;

                    finalPosition = newPlace;
                    finalColor = myColor;
                    targetStatus = "end";
                    isEnteringHouse = true;
                } else {
                    let currentPlace = pawn.position;
                    let newPlace = currentPlace + i;
                    let teamColorIndex = colorSides.indexOf(myColor);
                    let previousColor = colorSides[(teamColorIndex + 3) % 4];

                    if (pawn.color_side === previousColor && newPlace > 21) {
                        let step = newPlace - 21;
                        if (step <= 4) {
                            let isBlocked = false;
                            for (let j = 1; j <= step; j++) {
                                if (isPawnAtSelection(j, myColor, "end")) { isBlocked = true; break; }
                            }
                            if (!isBlocked) {
                                finalPosition = step;
                                finalColor = myColor;
                                targetStatus = "end";
                                isEnteringHouse = true;
                            }
                        }
                    }
                    
                    if (!isEnteringHouse) {
                        finalPosition = ((newPlace % 22) + 22) % 22;
                        let colorShift = Math.floor(newPlace / 22); 
                        let finalColorIndex = (colorSides.indexOf(pawn.color_side) + colorShift + 4) % 4;
                        finalColor = colorSides[finalColorIndex];
                        
                        isPawnAtDestination = isPawnAtSelection(finalPosition, finalColor, "board");
                    }
                }

                if (isEnteringHouse || !isPawnAtDestination || isPawnAtDestination.color !== myColor) {
                    let targetVisual;
                    if (isEnteringHouse) {
                        targetVisual = document.getElementById(`end-${finalColor}-${finalPosition}`);
                    } else if (isPawnAtDestination) {
                        targetVisual = document.getElementById(`pion-${isPawnAtDestination.color}-${isPawnAtDestination.pawn.id}`);
                    } else {
                        targetVisual = document.getElementById(`${finalColor}-${finalPosition}`);
                    }
                    
                    if (targetVisual) {
                        targetVisual.classList.add("target-case");
                        targetVisual.setAttribute("data-destination-color", finalColor);
                        targetVisual.setAttribute("data-destination-position", finalPosition);
                        targetVisual.setAttribute("data-target-status", targetStatus);
                        targetVisual.setAttribute("data-distance", i);
                    }
                }
            }
        }
    });
}

function clearSelections() {
    for (const color of colorSides) {
        for (let i = 0; i < 22; i++) {
            const elem = document.getElementById(`${color}-${i}`);
            if (elem) elem.classList.remove("target-case");
        }
        for (let i = 0; i < 4; i++) {
            const endCase = document.getElementById(`end-${color}-${i + 1}`);
            if (endCase) endCase.classList.remove("target-case");

            const boardPawn = document.getElementById(`pion-${color}-${i + 1}`);
            boardPawn.classList.remove("playable");
            boardPawn.classList.remove("target-case");
        }
    }
}

function isPawnAtSelection(position, colorSide, status = "board") {
    for (const color of colorSides) {
        for (const pawn of usableGameState[color]){
            if (pawn.status === status && pawn.position === position && pawn.color_side === colorSide) {
                return {
                    "pawn": pawn,
                    "color": color
                };
            }
        }
    }
    return null;
}

function showPopUp(message) {
    const popUpMenu = document.createElement("div");
    popUpMenu.classList.add("game-popup");
    popUpMenu.textContent = message;

    document.body.appendChild(popUpMenu);
    setTimeout(() => {
        popUpMenu.classList.add("fade-out");
        setTimeout(() => popUpMenu.remove(), 500);
    }, 2000);
}

function createDeck() {
    deck = [];
    cardValues.forEach(val => {
        if (val !== "JOKER") {
            cardSymbols.forEach(sym => {
                let cardColor = (sym === "♥" || sym === "♦") ? "red" : "black";
                deck.push({ value: val, symbol: sym, color: cardColor });
                deck.push({ value: val, symbol: sym, color: cardColor });
            });
        }
    });
    for (let i = 0; i < 4; i++) {
        deck.push({ value: "JOKER", symbol: "🃏", color: "joker-style" });
    }
    deck.sort(() => Math.random() - 0.5);
}

function distributeCards() {
    if (deck.length < players.length * cardsPerDeal) {
        createDeck();
        discardElement.innerHTML = "Vide";
    }
    players.forEach(player => {
        playersHands[player] = [];
        for (let i = 0; i < cardsPerDeal; i++) {
            playersHands[player].push(deck.pop());
        }
    });
    cardsPerDeal = (cardsPerDeal === 5) ? 4 : 5;
}

function displayHands() {
    const colorMap = { "red": "#e63946", "blue": "#457b9d", "yellow": "#e9c46a", "green": "#2a9d54" };
    
    players.forEach(player => {
        const handDiv = document.getElementById(`hand-${player}`);
        if (!handDiv) return;
        handDiv.innerHTML = "";
        handDiv.classList.remove("receded");

        if (player === myColor) {
            handDiv.classList.add("active-hand");
            handDiv.style.boxShadow = `0px -20px 40px -10px ${colorMap[player]}`;
            handDiv.style.borderTop = `3px solid ${colorMap[player]}`;
            handDiv.style.borderRadius = "50% 50% 0 0";
        } else {
            handDiv.classList.remove("active-hand");
            handDiv.style.boxShadow = "none";
            handDiv.style.borderTop = "none";
        }

        let currentHand = playersHands[player];
        currentHand.forEach((card, index) => {
            const cardDiv = document.createElement("div");
            cardDiv.classList.add("card", card.color);
            cardDiv.setAttribute("data-value", card.value);
            cardDiv.setAttribute("data-symbol", card.symbol);
            cardDiv.setAttribute("data-index", index);
            cardDiv.setAttribute("data-owner", player);

            const centerSymbol = document.createElement("span");
            centerSymbol.classList.add("center-sym");
            centerSymbol.textContent = card.symbol;

            cardDiv.appendChild(centerSymbol);
            handDiv.appendChild(cardDiv);
        });

        applyArcCircle(handDiv);
    });
    cardSelection();
}

function nextTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % 4;
    myColor = players[currentPlayerIndex];

    const isRoundOver = players.every(p => playersHands[p].length === 0);
    if (isRoundOver && myAssignedColor === "red") {
        distributeCards();
        socket.emit('syncHands', { roomCode: myRoomCode, hands: playersHands });
    }
    
    showPopUp(`C'est au tour des ${myColor.toUpperCase()} !`);
    displayHands();
}

function passTurnToNext() {
    nextTurn();
    socket.emit('endTurn', { roomCode: myRoomCode });
}

function checkWin() {
    const teamRY = [...usableGameState["red"], ...usableGameState["yellow"]];
    const teamBG = [...usableGameState["blue"], ...usableGameState["green"]];

    let winners = null;
    if (teamRY.every(p => p.status === "end")) winners = { label: "Rouge & Jaune gagnent !", colors: ["🔴","🟡"] };
    if (teamBG.every(p => p.status === "end")) winners = { label: "Bleu & Vert gagnent !", colors: ["🔵","🟢"] };

    if (winners) {
        const overlay = document.getElementById("win-overlay");
        document.getElementById("win-title").textContent = winners.label;
        document.getElementById("win-colors").innerHTML = winners.colors.map(c =>
            `<div style="font-size:28px">${c}</div>`
        ).join("");
        overlay.style.display = "flex";

        document.getElementById("btn-replay").onclick = () => overlay.style.display = "none";
        document.getElementById("btn-menu").onclick = () => location.reload();
        return true;
    }
    return false;
}

const discardElement = document.getElementById("discard");
let selectedCard = null;
let selectedPawn = null;
let needToMovePawn = false;
const cardValues = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "JOKER"];
const cardSymbols = ["♠", "♥", "♣", "♦"];
const movableValues = ["A", "2", "3", "6", "8", "9", "10", "Q", "K", "JOKER"];
const correspondanceCase = {
    "A": 1,
    "2": 2,
    "3": 3,
    "6": 6,
    "8": 8,
    "9": 9,
    "10": 10,
    "Q": 12,
    "K": 13,
    "JOKER": 18
}
let usableGameState = {};
localStorage.removeItem("game_state");
let pawnsInHouse = [];
let pawnOnBoard = [];
let sevenCredit = 0;
let pawnMovedDuringSeven = [];

const players = ["red", "blue", "yellow", "green"];
let currentPlayerIndex = 0;
let myColor = players[currentPlayerIndex];
let deck = [];
let playersHands = { "red": [], "blue": [], "yellow": [], "green": [] };
let cardsPerDeal = 5;

document.addEventListener("click", (event) => {
    const isClickOnCard = event.target.closest('.card');
    const isClickOnCase = event.target.tagName === 'circle';
    const isClickOnDiscard = event.target.closest('#discard');
    if (!isClickOnCard && !isClickOnCase && !isClickOnDiscard) {
        if (needToMovePawn) {
            clearSelections();
            if (typeof window.tempValetReset === "function") {
                window.tempValetReset();
            }
        } else {
            const activeHand = document.getElementById(`hand-${myColor}`);
            if (activeHand) activeHand.classList.remove("receded");
            document.querySelectorAll('.card').forEach(card => card.classList.remove("selected"));
            selectedCard = null;
        }
        return;
    }
    if (isClickOnCase && event.target.classList.contains("target-case")) {
        let destColor = event.target.getAttribute("data-destination-color");
        let destPos = parseInt(event.target.getAttribute("data-destination-position"));
        let isKingMove = event.target.getAttribute("data-is-king") === "true";
        let targetStatus = event.target.getAttribute("data-target-status") || "board";

        if (isKingMove) {
            let startPos = parseInt(event.target.getAttribute("data-start-position"));
            let startColor = event.target.getAttribute("data-start-color");

            for (let i = 1; i <= 13; i++) {
                let pathPlace = startPos + i;
                let pathPos = ((pathPlace % 22) + 22) % 22;
                let colorShift = Math.floor(pathPlace / 22); 
                let pathColor = colorSides[(colorSides.indexOf(startColor) + colorShift + 4) % 4];

                let occupant = isPawnAtSelection(pathPos, pathColor);

                if (occupant !== null && occupant.color !== selectedPawn.pawn_color) {
                    console.log(`💥 BAM ! The king kills #${occupant.color}-${occupant.pawn.id} !`);
                    occupant.pawn.status = "house";
                    occupant.pawn.position = occupant.pawn.id;
                    occupant.pawn.color_side = occupant.color;
                    drawPawn(occupant.pawn, occupant.color);
                }
            }
        } else {
            let occupant = isPawnAtSelection(destPos, destColor);
            if (occupant !== null && occupant.color !== selectedPawn.pawn_color) {
                console.log(`💥 BAM ! Pawn #${occupant.color}-${occupant.pawn.id} returns to House !`);
                occupant.pawn.status = "house";
                occupant.pawn.position = occupant.pawn.id;
                occupant.pawn.color_side = occupant.color;
                drawPawn(occupant.pawn, occupant.color);
            }
        }

        selectedPawn.status = targetStatus;
        selectedPawn.position = destPos;
        selectedPawn.color_side = destColor;

        drawPawn(selectedPawn, selectedPawn.pawn_color);
        socket.emit('movePawn', {
            roomCode: myRoomCode,
            pawnData: { ...selectedPawn },
            pawnColor: selectedPawn.pawn_color
        });
        saveGameState();

        for (const color of colorSides) {
            for (let i = 1; i <= 4; i++) {
                const visualPawn = document.getElementById(`pion-${color}-${i}`);
                if (visualPawn) visualPawn.onclick = null;
            }
        }
        clearSelections();

        if (sevenCredit > 0) {
            let distanceMoved = parseInt(event.target.getAttribute("data-distance"));
            sevenCredit -= distanceMoved;
            pawnMovedDuringSeven.push(selectedPawn.id);
            console.log(`7 joué : Il reste ${sevenCredit} cases de déplacement !`);
            if (sevenCredit > 0) {
                playSeven();
                return;
            }
        }

        sevenCredit = 0;
        pawnOnBoard = [];
        pawnsInHouse = [];
        needToMovePawn = false;
        if (!checkWin()) passTurnToNext();
        return;
    }
});
discardElement.addEventListener("click", (event) => {
    if (needToMovePawn) return;
    event.stopPropagation();
    if (selectedCard) {
        const playedCard = document.createElement("div");
        playedCard.className = selectedCard.className;
        playedCard.classList.remove('selected');
        playedCard.setAttribute("data-value", selectedCard.dataset.value);
        playedCard.setAttribute("data-symbol", selectedCard.dataset.symbol);
        playedCard.innerHTML = `<span class="center-sym">${selectedCard.dataset.symbol}</span>`;

        const angleAleatoire = Math.floor(Math.random() * 40) - 20;
        playedCard.style.position = "absolute";
        playedCard.style.top = "50%";
        playedCard.style.left = "50%";
        playedCard.style.transform = `translate(-50%, -50%) rotate(${angleAleatoire}deg)`;
        playedCard.style.pointerEvents = "none";

        discardElement.appendChild(playedCard);
        
        let playedIndex = parseInt(selectedCard.getAttribute("data-index"));
        playersHands[myColor].splice(playedIndex, 1); 

        playCard(selectedCard.dataset.value);

        socket.emit('playCard', {
            roomCode: myRoomCode,
            color: myColor,
            playedIndex: playedIndex,
            cardValue: selectedCard.dataset.value,
            cardSymbol: selectedCard.dataset.symbol,
            cardClass: selectedCard.className
        });

        selectedCard.remove();
        selectedCard = null;
        
        if (!needToMovePawn) {
            if (!checkWin) passTurnToNext();
        } else {
            applyArcCircle(document.getElementById(`hand-${myColor}`));
        }
    }
})

// GAME GESTION

// --- LOGIQUE DU MENU MULTIJOUEUR ---
const mainMenu = document.getElementById("main-menu");
const btnCreateRoom = document.getElementById("btn-create-room");
const roomCodeDisplay = document.getElementById("room-code-display");
const btnJoinRoom = document.getElementById("btn-join-room");
const inputRoomCode = document.getElementById("input-room-code");
const inputPseudo = document.getElementById("input-pseudo");
const btnStartGame = document.getElementById("btn-start-game");

let myPseudo = "";
let myAssignedColor = "";
let myRoomCode = "";
let isHost = false;
const socket = io();

let isExchangePhase = false;
let myExchangeIndex = -1;
let myTeammateColor = "";
let teamExchanges = {};

function goToTableLocally() {
    mainMenu.style.display = "none";
    document.getElementById("board").style.display = "block";
    document.getElementById("board-wrapper").style.display = "block";
    document.querySelectorAll(".hand-container").forEach(el => el.style.display = "flex");

    if (myAssignedColor) orientBoard(myAssignedColor);
    
    loadPosition(); 
}

function orientBoard(assignedColor) {
    const colorSides = ["red", "blue", "yellow", "green"];
    let myIndex = colorSides.indexOf(assignedColor);
    const positions = ["bottom", "left", "top", "right"];
    
    colorSides.forEach((color, i) => {
        let posIndex = (i - myIndex + 4) % 4;
        let posName = positions[posIndex];
        
        let handDiv = document.getElementById(`hand-${color}`);
        if (handDiv) {
            let isActive = handDiv.classList.contains("active-hand");
            let isReceded = handDiv.classList.contains("receded");
            handDiv.className = `hand-container hand-${posName}`;
            if (isActive) handDiv.classList.add("active-hand");
            if (isReceded) handDiv.classList.add("receded");
        }
        
        let nameDiv = document.getElementById(`name-${color}`);
        if (nameDiv) {
            nameDiv.className = `board-player-name color-${color} pos-${posName}`;
        }
    });
    
    let rotation = (3 - myIndex) * 90;
    document.getElementById("board").style.transform = `rotate(${rotation}deg)`;
}

function renderHostPanel(playerList) {
    const listDiv = document.getElementById("host-players-list");
    listDiv.innerHTML = "";
    
    const colors = { red: "Rouge", blue: "Bleu", yellow: "Jaune", green: "Vert" };

    playerList.forEach(p => {
        const row = document.createElement("div");
        row.className = "host-player-row";

        const nameSpan = document.createElement("span");
        nameSpan.textContent = p.pseudo;

        const select = document.createElement("select");
        for (let c in colors) {
            let opt = document.createElement("option");
            opt.value = c;
            opt.textContent = colors[c];
            if (p.color === c) opt.selected = true;
            select.appendChild(opt);
        }

        select.addEventListener("change", (e) => {
            socket.emit("changePlayerColor", {
                roomCode: myRoomCode,
                playerId: p.id,
                newColor: e.target.value
            });
        });

        row.appendChild(nameSpan);
        row.appendChild(select);
        listDiv.appendChild(row);
    });
}

function getTeammate(color) {
    if(color === "red") return "yellow";
    if(color === "yellow") return "red";
    if(color === "blue") return "green";
    if(color === "green") return "blue";
    return "";
}

function startExchangePhase() {
    teamExchanges = {};
    isExchangePhase = true;
    myExchangeIndex = -1;
    myTeammateColor = getTeammate(myAssignedColor);

    mainMenu.style.display = "none";
    document.getElementById("host-panel").style.display = "none";

    displayHands();

    if (myAssignedColor) {
        document.getElementById("exchange-overlay").style.display = "flex";
        document.getElementById("exchange-title").textContent = `Échange avec ton équipe`;
        document.getElementById("partner-slot-label").textContent = myTeammateColor.toUpperCase();
        
        let mySlot = document.getElementById("my-exchange-slot");
        mySlot.className = "card empty";
        mySlot.innerHTML = "Choisis...";

        let partnerSlot = document.getElementById("partner-exchange-slot");
        partnerSlot.className = "card empty";
        partnerSlot.innerHTML = "Attente...";

        document.getElementById("btn-confirm-exchange").style.display = "none";

        let myHand = document.getElementById(`hand-${myAssignedColor}`);
        if(myHand) {
            myHand.classList.add("exchange-active");
            myHand.classList.remove("exchange-selected");
        }
    }

    if (isHost) {
        const allColors = ["red", "blue", "yellow", "green"];
        allColors.forEach(c => {
            let nameEl = document.getElementById(`name-${c}`);
            if (nameEl && nameEl.textContent === "En attente...") {
                let fakeCard = playersHands[c][0];
                if (fakeCard) {
                    let cClass = "card " + ((fakeCard.symbol === '♥' || fakeCard.symbol === '♦') ? 'red' : 'black');
                    if (fakeCard.value === "Joker") cClass = "card joker-style";
                    
                    let data = {
                        roomCode: myRoomCode, color: c, cardIndex: 0,
                        cardValue: fakeCard.value, cardSymbol: fakeCard.symbol, cardClass: cClass
                    };
                    setTimeout(() => {
                        handleExchangeLocked(data);
                        socket.emit("lockExchange", data);
                    }, 1500);
                }
            }
        });
    }
}

document.getElementById("btn-confirm-exchange").addEventListener("click", () => {
    document.getElementById("btn-confirm-exchange").style.display = "none";
    let slot = document.getElementById("my-exchange-slot");
    
    let data = {
        roomCode: myRoomCode,
        color: myAssignedColor,
        cardIndex: myExchangeIndex,
        cardValue: slot.getAttribute("data-value"),
        cardSymbol: slot.getAttribute("data-symbol"),
        cardClass: slot.className
    };

    handleExchangeLocked(data);
    socket.emit("lockExchange", data);
});

socket.on("teamExchangeLocked", (data) => {
    handleExchangeLocked(data);
});

function handleExchangeLocked(data) {
    teamExchanges[data.color] = data;

    if (data.color === myTeammateColor) {
        let pSlot = document.getElementById("partner-exchange-slot");
        pSlot.className = data.cardClass;
        pSlot.setAttribute("data-value", data.cardValue);
        pSlot.setAttribute("data-symbol", data.cardSymbol);
        pSlot.innerHTML = `<span class="center-sym">${data.cardSymbol}</span>`;
    }

    if (teamExchanges[myAssignedColor] && teamExchanges[myTeammateColor]) {
        if (document.getElementById("exchange-overlay").style.display !== "none") {
            document.getElementById("exchange-title").textContent = "Échange confirmé !";
            setTimeout(() => {
                document.getElementById("exchange-title").textContent = "En attente des adversaires...";
                document.getElementById("exchange-title").style.color = "#888";
                
                if (myAssignedColor) {
                    let myHand = document.getElementById(`hand-${myAssignedColor}`);
                    if (myHand) {
                        myHand.classList.remove("exchange-active");
                        myHand.classList.remove("exchange-selected");
                    }
                }
                
                executeSwapsLocally();
            }, 2000);
        }
    } else {
        executeSwapsLocally();
    }
}

function executeSwapsLocally() {
    
    if (teamExchanges.red && teamExchanges.yellow && !teamExchanges.red.swapped) {
        let rCard = playersHands['red'][teamExchanges.red.cardIndex];
        let yCard = playersHands['yellow'][teamExchanges.yellow.cardIndex];
        playersHands['red'][teamExchanges.red.cardIndex] = yCard;
        playersHands['yellow'][teamExchanges.yellow.cardIndex] = rCard;
        teamExchanges.red.swapped = true;
        teamExchanges.yellow.swapped = true;
    }
    
    if (teamExchanges.blue && teamExchanges.green && !teamExchanges.blue.swapped) {
        let bCard = playersHands['blue'][teamExchanges.blue.cardIndex];
        let gCard = playersHands['green'][teamExchanges.green.cardIndex];
        playersHands['blue'][teamExchanges.blue.cardIndex] = gCard;
        playersHands['green'][teamExchanges.green.cardIndex] = bCard;
        teamExchanges.blue.swapped = true;
        teamExchanges.green.swapped = true;
    }

    if (teamExchanges.red?.swapped && teamExchanges.yellow?.swapped &&
        teamExchanges.blue?.swapped && teamExchanges.green?.swapped) {
        
        isExchangePhase = false;
        document.getElementById("exchange-overlay").style.display = "none";
        document.getElementById("exchange-title").style.color = "white";
        
        displayHands();
        showPopUp(`La manche commence ! Au tour des ${myColor.toUpperCase()} !`);
    }
}

document.getElementById('host-toggle').addEventListener('click', () => document.getElementById('host-panel').classList.toggle('open'));

// --- LES ACTIONS BOUTONS ---

btnCreateRoom.addEventListener("click", () => {
    myPseudo = inputPseudo.value.trim();
    if (myPseudo.length < 2) {
        alert("Veuillez entrer un pseudo d'au moins 2 caractères !");
        return;
    }
    btnCreateRoom.textContent = "Création...";
    socket.emit('createRoom', { pseudo: myPseudo }); 
});

btnJoinRoom.addEventListener("click", () => {
    myPseudo = inputPseudo.value.trim();
    let code = inputRoomCode.value.toUpperCase();
    if (myPseudo.length < 2) {
        alert("Veuillez entrer un pseudo d'au moins 2 caractères !");
        return;
    }
    if (code.length === 4) {
        btnJoinRoom.textContent = "Connexion...";
        socket.emit('joinRoom', { code: code, pseudo: myPseudo });
    } else {
        alert("Veuillez entrer un code à 4 lettres.");
    }
});

btnStartGame.addEventListener("click", () => {
    btnStartGame.style.display = "none";
    distributeCards();
    socket.emit('syncHands', { roomCode: myRoomCode, hands: playersHands });
    startExchangePhase();
});

// --- LES RÉPONSES DU SERVEUR ---

socket.on('roomCreated', (data) => {
    myAssignedColor = data.color;
    myRoomCode = data.code;

    isHost = true;
    document.getElementById("host-panel").style.display = "block";

    goToTableLocally();
    btnStartGame.style.display = "block";
    btnStartGame.textContent = "LANCER (1/4)";

    const codeBadge = document.getElementById("board-room-code");
    codeBadge.style.display = "block";
    codeBadge.textContent = `CODE : ${data.code}`;
});

socket.on('roomJoined', (data) => {
    myAssignedColor = data.color;
    myRoomCode = data.code;
    goToTableLocally();

    const codeBadge = document.getElementById("board-room-code");
    codeBadge.style.display = "block";
    codeBadge.textContent = `CODE : ${data.code}`;
    showPopUp(`Connecté au salon ${data.code} !`);
});

socket.on('receiveHands', (handsFromServer) => {
    playersHands = handsFromServer;
    startExchangePhase();
});

socket.on('updatePlayers', (playerList) => {
    let me = playerList.find(p => p.pseudo === myPseudo); 
    if (me && me.color !== myAssignedColor) {
        myAssignedColor = me.color;
        if (document.getElementById("board").style.display !== "none") {
            orientBoard(myAssignedColor);
            showPopUp(`L'hôte t'a mis dans l'équipe ${myAssignedColor.toUpperCase()} !`);
        }
    }

    if (isHost) renderHostPanel(playerList);

    document.getElementById("name-red").textContent = "En attente...";
    document.getElementById("name-blue").textContent = "En attente...";
    document.getElementById("name-yellow").textContent = "En attente...";
    document.getElementById("name-green").textContent = "En attente...";

    playerList.forEach(p => {
        let nameEl = document.getElementById(`name-${p.color}`);
        if (nameEl) nameEl.textContent = p.pseudo;
    });

    if (btnStartGame.style.display === "block") btnStartGame.textContent = `LANCER (${playerList.length}/4)`;

    let lastPlayer = playerList[playerList.length - 1];
    if (lastPlayer && lastPlayer.pseudo !== myPseudo) showPopUp(`${lastPlayer.pseudo} est arrivé à la table !`)
});

socket.on('cardPlayed', (data) => {
    playersHands[data.color].splice(data.playedIndex, 1);
    displayHands();

    const playedCard = document.createElement("div");
    playedCard.className = data.cardClass;
    playedCard.classList.remove('selected');
    playedCard.setAttribute("data-value", data.cardValue);
    playedCard.setAttribute("data-symbol", data.cardSymbol);
    playedCard.innerHTML = `<span class="center-sym">${data.cardSymbol}</span>`;

    const angleAleatoire = Math.floor(Math.random() * 40) - 20;
    playedCard.style.position = "absolute";
    playedCard.style.top = "50%";
    playedCard.style.left = "50%";
    playedCard.style.transform = `translate(-50%, -50%) rotate(${angleAleatoire}deg)`;
    playedCard.style.pointerEvents = "none";

    document.getElementById("discard").appendChild(playedCard);
});

socket.on('pawnMoved', (data) => {
    let pawn = usableGameState[data.pawnColor].find(p => p.id === data.pawnData.id);
    if (pawn) {
        pawn.status = data.pawnData.status;
        pawn.position = data.pawnData.position;
        pawn.color_side = data.pawnData.color_side;
    }
    drawPawn(data.pawnData, data.pawnColor);
    saveGameState();
});

socket.on('turnChanged', () => nextTurn());

socket.on('errorMsg', (msg) => {
    alert(msg);
    btnJoinRoom.textContent = "Rejoindre";
    btnCreateRoom.textContent = "Générer un code";
});