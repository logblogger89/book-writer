import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import choices, pipeline, projects, websocket


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Nova Writer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(pipeline.router)
app.include_router(choices.router)
app.include_router(websocket.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
