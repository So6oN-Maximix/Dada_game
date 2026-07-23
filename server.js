const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

const serverInstanceId = Date.now().toString();

app.use(express.static(__dirname));

const rooms = {};

function generateRoomCode() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) code += characters.charAt(Math.floor(Math.random() * characters.length));
    return code;
}

function removePlayerFromRoom(socket, roomCode) {
    let room = rooms[roomCode];
    if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        if (room.players.length === 0) {
            delete rooms[roomCode];
            console.log(`Salle ${roomCode} supprimée car vide.`);
        } else {
            socket.to(roomCode).emit("updatePlayers", room.players);
        }
    }
}

const colorOrder = ["red", "blue", "yellow", "green"];

io.on("connection", (socket) => {
    console.log("Un joueur est connecté : " + socket.id);
    socket.emit("serverInstance", { id: serverInstanceId });

    socket.on("createRoom", (data) => {
        let roomCode = generateRoomCode();
        while(rooms[roomCode]) { roomCode = generateRoomCode(); }

        rooms[roomCode] = {
            players: [{ id: socket.id, pseudo: data.pseudo, color: colorOrder[0] }]
        };

        socket.join(roomCode);
        socket.emit("roomCreated", { code: roomCode, color: colorOrder[0] });
        
        io.to(roomCode).emit("updatePlayers", rooms[roomCode].players);
    });

    // Quand un joueur REJOINT un salon
    socket.on("joinRoom", (data) => {
        let roomCode = data.code;
        if (rooms[roomCode]) {
            let currentNbPlayers = rooms[roomCode].players.length;
            
            if (currentNbPlayers < 4) {
                let assignedColor = colorOrder[currentNbPlayers];
                
                rooms[roomCode].players.push({ id: socket.id, pseudo: data.pseudo, color: assignedColor });
                socket.join(roomCode);
                socket.emit("roomJoined", { code: roomCode, color: assignedColor });
                
                io.to(roomCode).emit("updatePlayers", rooms[roomCode].players); 
            } else {
                socket.emit("errorMsg", "Ce salon est plein !");
            }
        } else {
            socket.emit("errorMsg", "Ce code de salon n\'existe pas !");
        }
    });

    // Reconnexion après un reload : on retrouve le joueur par pseudo + code
    socket.on("rejoinRoom", (data) => {
        let room = rooms[data.code];
        if (!room) {
            socket.emit("rejoinFailed");
            return;
        }
        let player = room.players.find(p => p.pseudo === data.pseudo);
        if (!player) {
            socket.emit("rejoinFailed");
            return;
        }

        player.id = socket.id;
        socket.join(data.code);

        socket.emit("rejoinSuccess", {
            code: data.code,
            color: player.color,
            isHost: room.players[0].pseudo === data.pseudo,
            gameStarted: !!room.gameStarted,
            hands: room.hands || null,
            currentPlayerIndex: room.currentPlayerIndex || 0,
            gameState: room.gameState || null
        });
        io.to(data.code).emit("updatePlayers", room.players);
    });

    socket.on("syncHands", (data) => {
        let room = rooms[data.roomCode];
        if (room) {
            room.hands = data.hands;
            room.gameStarted = true
        };
        socket.to(data.roomCode).emit("receiveHands", data.hands);
    });
    socket.on("playCard", (data) => socket.to(data.roomCode).emit("cardPlayed", data));
    socket.on("lockExchange", (data) => socket.to(data.roomCode).emit("teamExchangeLocked", data));
    socket.on("endTurn", (data) => {
        let room = rooms[data.roomCode];
        if (room) room.currentPlayerIndex = data.currentPlayerIndex;
        socket.to(data.roomCode).emit("turnChanged");
    });
    socket.on("movePawn", (data) => socket.to(data.roomCode).emit("pawnMoved", data));

    socket.on('changePlayerColor', (data) => {
        let room = rooms[data.roomCode];
        if (room) {
            
            let playerIndex = room.players.findIndex(p => p.id === data.playerId);
            if (playerIndex !== -1) {
                let oldColor = room.players[playerIndex].color;
                let otherPlayerIndex = room.players.findIndex(p => p.color === data.newColor);

                if (otherPlayerIndex !== -1) room.players[otherPlayerIndex].color = oldColor;
                room.players[playerIndex].color = data.newColor;

                io.to(data.roomCode).emit('updatePlayers', room.players);
            }
        }
    });

    socket.on("updateGameState", (data) => {
        let room = rooms[data.roomCode];
        if (room) room.gameState = data.gameState;
    });

    socket.on("leaveRoom", (data) => {
        socket.leave(data.roomCode);
        removePlayerFromRoom(socket, data.roomCode);
    });

    socket.on("disconnect", () => {
        console.log("Déconnexion : " + socket.id);
        
        for (let code in rooms) {
            let playerExists = rooms[code].players.some(p => p.id === socket.id);
            if (playerExists) {
                removePlayerFromRoom(socket, code);
                break;
            }
        }
    });
});

http.listen(process.env.PORT || 5500, () => console.log("Serveur lancé ! Ouvre http://localhost:5500 dans ton navigateur"));