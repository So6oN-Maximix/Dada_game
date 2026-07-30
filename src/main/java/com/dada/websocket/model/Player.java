package com.dada.websocket.model;

import org.springframework.web.socket.WebSocketSession;

public class Player {
    private WebSocketSession session;
    private String pseudo;
    private String color;

    public Player(WebSocketSession session, String pseudo, String color) {
        this.session = session;
        this.pseudo = pseudo;
        this.color = color;
    }

    public WebSocketSession getSession() { return session; }
    public void setSession(WebSocketSession session) { this.session = session; }
    public String getPseudo() { return pseudo; }
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    public String getId() { return session.getId(); }
}