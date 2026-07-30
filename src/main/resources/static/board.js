function createArcModel(p1, p2, ptControle, angle, indexColor) {
    const arcModel = document.createElementNS(svgNS, "g");
    arcModel.id = `arc-${colorSides[indexColor]}`;
    
    arcModel.setAttribute("transform", `rotate(${angle}, 300, 300)`);
    arcModel.style.color = colorCodes[indexColor];

    const newP1 = {x: p1.x-40, y:p1.y-60};
    const newP2 = {x: p2.x-40, y:p2.y+60};

    const arcPathModel = document.createElementNS(svgNS, "path");
    arcPathModel.setAttribute("d", `M ${newP1.x} ${newP1.y} Q ${ptControle.x} ${ptControle.y} ${newP2.x} ${newP2.y}`);
    arcPathModel.setAttribute("display", "none");
    
    const arcPathModel2 = document.createElementNS(svgNS, "path");
    arcPathModel2.setAttribute("d", `M ${newP2.x} ${newP2.y} Q 80 120 ${p2.x} ${p2.y}`);
    arcPathModel2.setAttribute("display", "none");
    
    const arcPathModel3 = document.createElementNS(svgNS, "path");
    arcPathModel3.setAttribute("d", `M ${p1.x} ${p1.y} Q 80 480 ${newP1.x} ${newP1.y}`);
    arcPathModel3.setAttribute("display", "none");
    
    createCircles(arcPathModel, 18, arcModel, 0, indexColor);
    createCircles(arcPathModel2, 2, arcModel, 18, indexColor);
    createCircles(arcPathModel3, 2, arcModel, 20, (indexColor + 3) % 4);

    createHouse(arcModel, indexColor);
    createEnding(arcModel, (indexColor + 1) % 4);

    arcModel.appendChild(arcPathModel);
    arcModel.appendChild(arcPathModel2);
    arcModel.appendChild(arcPathModel3);
    
    boardZone.appendChild(arcModel);
}

function createCircles(arcPath, nbCases, arcModel, startNb, indexColor) {
    const totalLength = arcPath.getTotalLength();
    const gapBetweenCases = totalLength / nbCases;
    
    for (let i=0; i<=nbCases; i++) {
        const currentDistance = i * gapBetweenCases;
        const position = arcPath.getPointAtLength(currentDistance);
        const currentId = startNb + i;

        if ((i === 0 && startNb !== 0) || currentId === 22) {
            continue;
        }

        let posA = arcPath.getPointAtLength(Math.max(0, currentDistance - 0.5));
        let posB = arcPath.getPointAtLength(Math.min(totalLength, currentDistance + 0.5));
        
        let dx = posB.x - posA.x;
        let dy = posB.y - posA.y;
        let angleRad = Math.atan2(dy, dx);
        let angleDeg = angleRad * (180 / Math.PI) + 180;

        let decallage = -20;
        let normX = -dy;
        let normY = dx;
        let len = Math.sqrt(normX * normX + normY * normY);
        
        let offsetX = 0;
        let offsetY = 0;
        
        if (len > 0) {
            offsetX = (normX / len) * decallage;
            offsetY = (normY / len) * decallage;
        }
        const arcCircleModel = document.createElementNS(svgNS, "circle");
        arcCircleModel.setAttribute("cx", position.x);
        arcCircleModel.setAttribute("cy", position.y);
        arcCircleModel.setAttribute("r", 10);
        arcCircleModel.setAttribute("id", `${colorSides[indexColor]}-${startNb + i}`);
        if (currentId === 0) {
            arcCircleModel.setAttribute("fill", "black");
            arcCircleModel.setAttribute("stroke", colorCodes[indexColor]);
            arcCircleModel.setAttribute("stroke-width", "4");
        } else {
            arcCircleModel.setAttribute("fill", "black");
        }
        arcCircleModel.addEventListener("click", () => {
            console.log(`Clic Case : ${colorSides[indexColor]} - ${startNb + i}`);
        });
        arcModel.appendChild(arcCircleModel);

        const txt = document.createElementNS(svgNS, "text");
        txt.textContent = startNb + i;
        txt.setAttribute("x", position.x + offsetX);
        txt.setAttribute("y", position.y + offsetY);
        txt.setAttribute("font-size", "10");
        txt.setAttribute("font-family", "Arial, sans-serif");
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("dominant-baseline", "central");
        txt.setAttribute("fill", "black");
        txt.setAttribute("transform", `rotate(${angleDeg}, ${position.x + offsetX}, ${position.y + offsetY})`);
        txt.style.pointerEvents = "none"; 
        
        arcModel.appendChild(txt);
    }
}

function createHouse(arcModel, indexColor) {
    const housebase = document.createElementNS(svgNS, "rect");
    housebase.setAttribute("x", "30");
    housebase.setAttribute("y", "210");
    housebase.setAttribute("width", "40");
    housebase.setAttribute("height", "180");
    housebase.setAttribute("rx", "20");
    housebase.setAttribute("fill", "currentColor");
    housebase.setAttribute("opacity", "0.9");
    housebase.setAttribute("stroke", "black");
    housebase.setAttribute("stroke-width", "3");

    arcModel.appendChild(housebase);

    for (let i = 0; i < 4; i++) {
        const emplacement = document.createElementNS(svgNS, "circle");
        emplacement.setAttribute("id", `${colorSides[indexColor]}-house-${i + 1}`);
        emplacement.setAttribute("cx", "50"); 
        emplacement.setAttribute("cy", 360 - (i * 40)); 
        emplacement.setAttribute("r", "12");
        emplacement.setAttribute("fill", "#222");
        emplacement.setAttribute("stroke", "rgba(255,255,255,0.3)"); 
        emplacement.setAttribute("stroke-width", "2");
        emplacement.addEventListener("click", () => console.log(`Clic House ${colorSides[indexColor]} - Place ${i + 1}`));

        arcModel.appendChild(emplacement);
    }
}

function createEnding(arcModel, indexColor) {
    const endGroup = document.createElementNS(svgNS, "g");
    endGroup.setAttribute("transform", "translate(80, 80) rotate(45)");

    const endBase = document.createElementNS(svgNS, "rect");
    endBase.setAttribute("x", "25");
    endBase.setAttribute("y", "-20");
    endBase.setAttribute("width", "130");
    endBase.setAttribute("height", "40");
    endBase.setAttribute("rx", "20");
    endBase.setAttribute("fill", colorSides[indexColor]);
    endBase.setAttribute("opacity", "0.9");
    endBase.setAttribute("stroke", "black");
    endBase.setAttribute("stroke-width", "3");

    endGroup.appendChild(endBase);

    const nbEndCases = 4;
    for (let i = 0; i < nbEndCases; i++) {
        const posX = 45 + (i * 30);

        const endCase = document.createElementNS(svgNS, "circle");
        endCase.setAttribute("cx", posX);
        endCase.setAttribute("cy", "0");
        endCase.setAttribute("r", "10");
        endCase.setAttribute("fill", "#222");
        endCase.setAttribute("stroke", "rgba(255,255,255,0.3)");
        endCase.setAttribute("stroke-width", "2");
        
        endCase.setAttribute("id", `end-${colorSides[indexColor]}-${i + 1}`);

        endCase.addEventListener("click", () => {
            console.log(`Clic on End ${colorSides[indexColor]} - Step ${i + 1}`);
        });

        endGroup.appendChild(endCase);
        
        const txt = document.createElementNS(svgNS, "text");
        txt.textContent = i + 1;
        txt.setAttribute("x", posX);
        txt.setAttribute("y", "0");
        txt.setAttribute("font-size", "12");
        txt.setAttribute("font-family", "Arial, sans-serif");
        txt.setAttribute("font-weight", "bold");
        txt.setAttribute("text-anchor", "middle");
        txt.setAttribute("dominant-baseline", "central");
        txt.setAttribute("fill", "white");
        txt.style.pointerEvents = "none"; 
        txt.setAttribute("transform", `rotate(45, ${posX}, 0)`);
        
        endGroup.appendChild(txt);
    }
    arcModel.appendChild(endGroup);
}

function initGame() {
    for (let c = 0; c < 4; c++) {
        let colorSide = colorSides[c];
        let colorCode = colorCodes[c];
        let branchGroup = document.getElementById(`arc-${colorSide}`);

        for (let i = 0; i < 4; i++) {
            const pawn = document.createElementNS(svgNS, "circle");
            pawn.setAttribute("cx", "50"); 
            pawn.setAttribute("cy", 360 - (i * 40)); 
            
            pawn.setAttribute("r", "8");
            pawn.setAttribute("fill", colorCode);
            pawn.setAttribute("stroke", "white");
            pawn.setAttribute("stroke-width", "2");
            
            pawn.setAttribute("id", `pion-${colorSide}-${i + 1}`);
            pawn.style.cursor = "pointer";
            pawn.addEventListener("click", () => {
                console.log(`${colorSide} Pawn N°${i + 1}`);
            });
            branchGroup.appendChild(pawn);
        }
    }
}


// --- INITIALISATION DU JEU ---

const svg = document.getElementById("board");
const boardZone = document.getElementById("board-map");
const svgNS = "http://www.w3.org/2000/svg";

const p1 = {x: 80, y: 520};
const p2 = {x: 80, y: 80};
const ptControle = {x: 300, y: 300};

const colorCodes = ["#e63946", "#457b9d", "#e9c46a", "#2a9d54"];
const colorSides = ["red", "blue", "yellow", "green"];

for (let i = 0; i < 4; i++) {
    let angle = i * 90;
    createArcModel(p1, p2, ptControle, angle, i);
}
initGame();