import json
import logging
from typing import List, Any
from fastapi import WebSocket

from backend.app.services.rules_engine import get_current_iso_time

logger = logging.getLogger("rhizosense.websocket")


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Remaining clients: {len(self.active_connections)}")

    async def broadcast_event(self, event_type: str, payload: Any):
        if not self.active_connections:
            return

        envelope = {
            "event": event_type,
            "timestamp": get_current_iso_time(),
            "payload": payload,
        }

        # Convert Pydantic models or dicts to json serializable format with camelCase
        if hasattr(payload, "model_dump"):
            envelope["payload"] = payload.model_dump(by_alias=True)
        elif isinstance(payload, dict):
            # Already dict
            pass

        message_str = json.dumps(envelope)
        disconnected_clients = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.warning(f"Error sending message to client: {e}")
                disconnected_clients.append(connection)

        for client in disconnected_clients:
            self.disconnect(client)


ws_manager = ConnectionManager()
