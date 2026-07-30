package com.dada.websocket;

import com.dada.websocket.model.Room;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RoomManager {
    public static final String[] COLOR_ORDER = {"red", "blue", "yellow", "green"};
    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    private final Random random = new Random();

    public Room createRoom() {
        String code = generateRoomCode();
        Room room = new Room(code);
        rooms.put(code, room);
        return room;
    }

    public Room getRoom(String code) {
        return rooms.get(code);
    }

    public void removeRoomIfEmpty(String code) {
        Room room = rooms.get(code);
        if (room != null && room.getPlayers().isEmpty()) {
            rooms.remove(code);
        }
    }

    private String generateRoomCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) {
                sb.append(CHARACTERS.charAt(random.nextInt(CHARACTERS.length())));
            }
            code = sb.toString();
        } while (rooms.containsKey(code));
        return code;
    }
}