package com.dada.websocket;

import com.dada.websocket.model.Player;
import com.dada.websocket.model.Room;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;

@Component
public class DadaWebSocketHandler extends TextWebSocketHandler {

    private final RoomManager roomManager;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String serverInstanceId = String.valueOf(System.currentTimeMillis());

    public DadaWebSocketHandler(RoomManager roomManager) {
        this.roomManager = roomManager;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("Un joueur est connecté : " + session.getId());
        send(session, obj("type", "serverInstance").put("id", serverInstanceId));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        JsonNode data = mapper.readTree(message.getPayload());
        String type = data.get("type").asString();

        switch (type) {
            case "createRoom" -> handleCreateRoom(session, data);
            case "joinRoom" -> handleJoinRoom(session, data);
            case "leaveRoom" -> {
                String roomCode = (String) session.getAttributes().get("roomCode");
                if (roomCode != null) {
                    removePlayerFromRoom(session, roomCode);
                    session.getAttributes().remove("roomCode");
                }
            }
            case "playCard" -> relaySimple(session, data, "cardPlayed");
            case "lockExchange" -> relaySimple(session, data, "teamExchangeLocked");
            case "movePawn" -> relaySimple(session, data, "pawnMoved");
            case "endTurn" -> handleEndTurn(session, data);
            case "changePlayerColor" -> handleChangePlayerColor(session, data);
            case "updateGameState" -> handleUpdateGameState(session, data);
            case "syncHands" -> handleSyncHands(session, data);
            case "rejoinRoom" -> handleRejoinRoom(session, data);
            default -> System.out.println("Type de message inconnu : " + type);
        }
    }

    private void handleCreateRoom(WebSocketSession session, JsonNode data) throws IOException {
        String pseudo = data.get("pseudo").asString();

        Room room = roomManager.createRoom();
        String color = RoomManager.COLOR_ORDER[0];
        room.getPlayers().add(new Player(session, pseudo, color));

        session.getAttributes().put("roomCode", room.getCode());

        send(session, obj("type", "roomCreated").put("code", room.getCode()).put("color", color));
        broadcastUpdatePlayers(room);
    }

    private void handleJoinRoom(WebSocketSession session, JsonNode data) throws IOException {
        String code = data.get("code").asString();
        String pseudo = data.get("pseudo").asString();

        Room room = roomManager.getRoom(code);
        if (room == null) {
            send(session, obj("type", "errorMsg").put("message", "Ce code de salon n'existe pas !"));
            return;
        }

        int currentNbPlayers = room.getPlayers().size();
        if (currentNbPlayers >= 4) {
            send(session, obj("type", "errorMsg").put("message", "Ce salon est plein !"));
            return;
        }

        String assignedColor = RoomManager.COLOR_ORDER[currentNbPlayers];
        room.getPlayers().add(new Player(session, pseudo, assignedColor));
        session.getAttributes().put("roomCode", code);

        send(session, obj("type", "roomJoined").put("code", code).put("color", assignedColor));
        broadcastUpdatePlayers(room);
    }

    // ─── Helpers ────────────────────────────────────────────

    private void broadcastUpdatePlayers(Room room) throws IOException {
        ObjectNode msg = obj("type", "updatePlayers");
        msg.putPOJO("players", playersToJson(room.getPlayers()));
        broadcastToRoom(room, msg);
    }

    private List<Object> playersToJson(List<Player> players) {
        return players.stream()
                .map(p -> (Object) obj("id", p.getId()).put("pseudo", p.getPseudo()).put("color", p.getColor()))
                .toList();
    }

    private void broadcastToRoom(Room room, ObjectNode message) throws IOException {
        String json = mapper.writeValueAsString(message);
        for (Player p : room.getPlayers()) {
            if (p.getSession().isOpen()) {
                p.getSession().sendMessage(new TextMessage(json));
            }
        }
    }

    private void send(WebSocketSession session, ObjectNode message) throws IOException {
        session.sendMessage(new TextMessage(mapper.writeValueAsString(message)));
    }

    private ObjectNode obj(String key, String value) {
        return mapper.createObjectNode().put(key, value);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        System.out.println("Déconnexion : " + session.getId());
        String roomCode = (String) session.getAttributes().get("roomCode");
        if (roomCode != null) {
            removePlayerFromRoom(session, roomCode);
        }
    }

    private void removePlayerFromRoom(WebSocketSession session, String roomCode) throws IOException {
        Room room = roomManager.getRoom(roomCode);
        if (room == null) return;

        room.getPlayers().removeIf(p -> p.getId().equals(session.getId()));

        if (room.getPlayers().isEmpty()) {
            roomManager.removeRoomIfEmpty(roomCode);
            System.out.println("Salle " + roomCode + " supprimée car vide.");
        } else {
            broadcastUpdatePlayers(room);
        }
    }

    private void broadcastToRoomExceptSender(WebSocketSession sender, Room room, JsonNode originalMessage, String outType) throws IOException {
        ObjectNode msg = mapper.createObjectNode();
        msg.put("type", outType);
        msg.setAll((ObjectNode) originalMessage);
        msg.put("type", outType);

        String json = mapper.writeValueAsString(msg);
        for (Player p : room.getPlayers()) {
            if (!p.getId().equals(sender.getId()) && p.getSession().isOpen()) {
                p.getSession().sendMessage(new TextMessage(json));
            }
        }
    }

    private void relaySimple(WebSocketSession session, JsonNode data, String outType) throws IOException {
        String roomCode = data.get("roomCode").asString();
        Room room = roomManager.getRoom(roomCode);
        if (room != null) {
            broadcastToRoomExceptSender(session, room, data, outType);
        }
    }

    private void handleEndTurn(WebSocketSession session, JsonNode data) throws IOException {
        String roomCode = data.get("roomCode").asString();
        Room room = roomManager.getRoom(roomCode);
        if (room != null) {
            room.setCurrentPlayerIndex(data.get("currentPlayerIndex").asInt());
            broadcastToRoomExceptSender(session, room, data, "turnChanged");
        }
    }

    private void handleChangePlayerColor(WebSocketSession session, JsonNode data) throws IOException {
        String roomCode = data.get("roomCode").asString();
        Room room = roomManager.getRoom(roomCode);
        
        if (room != null) {
            String newColor = data.get("color").asString();
            for (Player p : room.getPlayers()) {
                if (p.getId().equals(session.getId())) {
                    p.setColor(newColor);
                    break;
                }
            }
            broadcastUpdatePlayers(room);
        }
    }

    private void handleUpdateGameState(WebSocketSession session, JsonNode data) throws IOException {
        String roomCode = data.get("roomCode").asString();
        Room room = roomManager.getRoom(roomCode);
        
        if (room != null) {
            room.setGameState(data.get("gameState"));
            broadcastToRoomExceptSender(session, room, data, "gameStateUpdated");
        }
    }

    private void handleRejoinRoom(WebSocketSession session, JsonNode data) throws IOException {
        String pseudo = data.get("pseudo").asString();
        String roomCode = data.get("code").asString();
        Room room = roomManager.getRoom(roomCode);
        
        if (room != null) {
            Player rejoiningPlayer = null;
            boolean isHost = false;
            
            for (int i = 0; i < room.getPlayers().size(); i++) {
                Player p = room.getPlayers().get(i);
                if (p.getPseudo().equals(pseudo)) {
                    rejoiningPlayer = p;
                    isHost = (i == 0);
                    break;
                }
            }
            
            if (rejoiningPlayer != null) {
                rejoiningPlayer.setSession(session);
                session.getAttributes().put("roomCode", roomCode);
                
                ObjectNode response = mapper.createObjectNode();
                response.put("type", "rejoinSuccess");
                response.put("code", roomCode);
                response.put("color", rejoiningPlayer.getColor());
                response.put("isHost", isHost);
                response.put("gameStarted", room.isGameStarted());
                
                if (room.isGameStarted()) {
                    response.putPOJO("gameState", room.getGameState());
                    response.putPOJO("hands", room.getHands());
                    response.put("currentPlayerIndex", room.getCurrentPlayerIndex());
                }
                
                session.sendMessage(new TextMessage(mapper.writeValueAsString(response)));
                
                broadcastUpdatePlayers(room);
                return;
            }
        }
        ObjectNode failResponse = mapper.createObjectNode();
        failResponse.put("type", "rejoinFailed");
        session.sendMessage(new TextMessage(mapper.writeValueAsString(failResponse)));
    }

    private void handleSyncHands(WebSocketSession session, JsonNode data) throws IOException {
        String roomCode = data.get("roomCode").asString();
        Room room = roomManager.getRoom(roomCode);
        
        if (room != null) {
            room.setHands(data.get("hands"));
            room.setGameStarted(true);
            
            if (data.has("nextStarter")) {
                room.setCurrentPlayerIndex(data.get("nextStarter").asInt());
            }
            broadcastToRoomExceptSender(session, room, data, "receiveHands");
        }
    }
}