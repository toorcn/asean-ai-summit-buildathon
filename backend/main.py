from dotenv import load_dotenv
load_dotenv()  # <-- makes .env available to all imported modules

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apis.nearby import router as nearby_router
from apis.wait_time import router as wait_router
from apis.camera import router as camera_router
from apis.recommend import router as smart_router
from apis.live_status import router as live_status_router

app = FastAPI(title="Hospital Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

app.include_router(nearby_router)
app.include_router(wait_router)
app.include_router(camera_router)
app.include_router(smart_router)
app.include_router(live_status_router)

@app.get("/")
def root():
    return {"ok": True, "service": "Hospital Backend"}