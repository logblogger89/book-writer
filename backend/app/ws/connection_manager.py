import asyncio
import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # project_id -> list of WebSocket connections
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        self._connections[project_id].append(websocket)
        logger.info(f"WS connected: project={project_id}, total={len(self._connections[project_id])}")

    def disconnect(self, websocket: WebSocket, project_id: str):
        connections = self._connections.get(project_id, [])
        if websocket in connections:
            connections.remove(websocket)
        logger.info(f"WS disconnected: project={project_id}, remaining={len(connections)}")

    async def broadcast(self, project_id: str, event: dict):
        """Send a JSON event to all connections for a project."""
        message = json.dumps(event, default=str)
        dead: list[WebSocket] = []
        for ws in list(self._connections.get(project_id, [])):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, project_id)

    async def send_personal(self, websocket: WebSocket, event: dict):
        """Send a JSON event to a single WebSocket."""
        try:
            await websocket.send_text(json.dumps(event, default=str))
        except Exception as e:
            logger.warning(f"Failed to send personal message: {e}")

    def get_connection_count(self, project_id: str) -> int:
        return len(self._connections.get(project_id, []))


# Singleton shared across the app
manager = ConnectionManager()
