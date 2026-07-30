package com.dada.websocket.model;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class Room {
    private final String code;
    private final List<Player> players = new CopyOnWriteArrayList<>();
    private boolean gameStarted = false;
    private Object hands;
    private int currentPlayerIndex = 0;
    private Object gameState;

    public Room(String code) {
        this.code = code;
    }

    public String getCode() { return code; }
    public List<Player> getPlayers() { return players; }
    public boolean isGameStarted() { return gameStarted; }
    public void setGameStarted(boolean gameStarted) { this.gameStarted = gameStarted; }
    public Object getHands() { return hands; }
    public void setHands(Object hands) { this.hands = hands; }
    public int getCurrentPlayerIndex() { return currentPlayerIndex; }
    public void setCurrentPlayerIndex(int i) { this.currentPlayerIndex = i; }
    public Object getGameState() { return gameState; }
    public void setGameState(Object gameState) { this.gameState = gameState; }
}