# camera_agent.py
import cv2
from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI(title="Camera Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

def grab_frame_jpeg() -> bytes:
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)  # CAP_DSHOW helps on Windows
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Webcam not available")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    ok, frame = cap.read()
    cap.release()
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to capture frame")
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise HTTPException(status_code=500, detail="JPEG encode failed")
    return buf.tobytes()

@app.get("/capture.jpg")
def capture_jpg():
    data = grab_frame_jpeg()
    return Response(content=data, media_type="image/jpeg")

@app.get("/healthz")
def health():
    return {"ok": True}

if __name__ == "__main__":
    # Change port per laptop, e.g. 9001, 9002
    uvicorn.run(app, host="0.0.0.0", port=9001)