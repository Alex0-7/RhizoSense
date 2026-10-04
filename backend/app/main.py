import asyncio
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import router as api_router
from backend.app.events.websocket_manager import ws_manager
from backend.app.services.rules_engine import get_current_iso_time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rhizosense.backend")


async def heartbeat_worker():
    while True:
        try:
            await asyncio.sleep(15)
            await ws_manager.broadcast_event(
                "system.heartbeat",
                {"serverTime": get_current_iso_time()},
            )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Error in heartbeat worker: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("RhizoSense FastAPI Backend initializing...")
    heartbeat_task = asyncio.create_task(heartbeat_worker())
    yield
    logger.info("RhizoSense FastAPI Backend shutting down...")
    heartbeat_task.cancel()
    try:
        await heartbeat_task
    except asyncio.CancelledError:
        pass


import os

cors_env = os.environ.get("CORS_ORIGINS", "*")
allowed_origins = [orig.strip() for orig in cors_env.split(",") if orig.strip()] if cors_env != "*" else ["*"]

app = FastAPI(
    title="RhizoSense Data Service",
    description="Field-deployable AI-powered Smart Farming Assistant backend service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Initial greeting and connection acknowledgment
        await websocket.send_json({
            "event": "system.heartbeat",
            "timestamp": get_current_iso_time(),
            "payload": {"serverTime": get_current_iso_time(), "message": "Connected to RhizoSense Live Telemetry"},
        })
        while True:
            # Keep receiving any client messages or pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    uvicorn.run("backend.app.main:app", host=host, port=port, ws="websockets", reload=True)
