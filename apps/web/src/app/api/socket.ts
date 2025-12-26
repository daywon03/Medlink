import type { NextApiRequest, NextApiResponse } from "next";
import { Server as IOServer, Socket } from "socket.io";
import type { Server as HTTPServer } from "http";

type NextApiResponseServerIO = NextApiResponse & {
  socket: {
    server: {
      io?: IOServer;
    };
  };
};

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server as unknown as HTTPServer, {
      path: "/api/socketio",
      addTrailingSlash: false,
      cors: { origin: "*" },
    });

    io.on("connection", (socket: Socket) => {
      // Ping de test
      socket.emit("arm:connected", { ok: true, at: new Date().toISOString() });

      // Exemple: réception d'actions depuis l'UI (assign, edit, notify)
      socket.on("arm:action", (payload: unknown) => {
        // Ici tu brancheras ton backend réel
        // Pour l’instant on broadcast un event “incident:update”
        io.emit("incident:update", {
          type: "action",
          payload,
          at: new Date().toISOString(),
        });
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}
