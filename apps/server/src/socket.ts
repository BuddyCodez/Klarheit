import { Server } from "socket.io";
import { env } from "@Klarheit/env/server";

export const io = new Server({
    cors: {
        origin: true,
        methods: ["GET", "POST"]
    }
});

export function setupSocket() {
    io.on("connection", (socket) => {
        console.log(`[SOCKET] Client connected: ${socket.id}`);
        socket.on("disconnect", () => {
            console.log(`[SOCKET] Client disconnected: ${socket.id}`);
        });
    });

    io.listen(3001);
    console.log("Socket.io is running on http://localhost:3001");
}
