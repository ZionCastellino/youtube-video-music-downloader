from fastapi import FastAPI, Request, Response, BackgroundTasks
from fastapi.responses import HTMLResponse, RedirectResponse, FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import os
import requests
import tempfile
import shutil

app = FastAPI()

# Allow hosted frontends (different origin) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_pna_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

@app.get("/")
def root():
    return RedirectResponse(url="/api/download")

@app.get("/api/download")
def download_page():
    # Fallback UI for Vercel backend
    html = """
<!doctype html>
<html>
<head><title>API Backend</title></head>
<body style="font-family:sans-serif; padding:40px;">
  <h1>Backend is Running</h1>
  <p>This is the API server. Use the React frontend to interact with it.</p>
</body>
</html>
    """.strip()
    return HTMLResponse(html)

class DownloadRequest(BaseModel):
    query: str
    save_path: str = ""
    media_type: str = "audio"
    quality: str = "high"

def download_media(query, save_path, media_type, quality):
    # Check if ffmpeg is available
    has_ffmpeg = shutil.which("ffmpeg") is not None

    if media_type == "audio":
        options = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(save_path, '%(title)s.%(ext)s'),
            'default_search': 'ytsearch1',
        }
        if has_ffmpeg:
            options['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': "320" if quality == "high" else ("192" if quality == "medium" else "128"),
            }]
    else:
        # video
        if has_ffmpeg:
            format_str = 'bestvideo+bestaudio/best'
            if quality == "1080p":
                format_str = 'bestvideo[height<=1080]+bestaudio/best'
            elif quality == "720p":
                format_str = 'bestvideo[height<=720]+bestaudio/best'
            elif quality == "480p":
                format_str = 'bestvideo[height<=480]+bestaudio/best'
        else:
            format_str = 'best[ext=mp4]/best'

        options = {
            'format': format_str,
            'outtmpl': os.path.join(save_path, '%(title)s.%(ext)s'),
            'default_search': 'ytsearch1',
        }
        if has_ffmpeg:
            options['merge_output_format'] = 'mp4'

    # Use cookies from browser if local
    if not os.environ.get("VERCEL"):
        options['cookiesfrombrowser'] = ('chrome',)

    with yt_dlp.YoutubeDL(options) as ydl:
        ydl.download([query])

def spotify_to_query(link):
    try:
        html = requests.get(link, headers={'User-Agent': 'Mozilla/5.0'}).text
        title = html.split("<title>")[1].split("</title>")[0]
        title = title.replace(" - song and lyrics by ", " ")
        title = title.replace(" | Spotify", "")
        return title.strip()
    except:
        return link

@app.get("/api/pick-folder")
def pick_folder():
    if os.environ.get("VERCEL"):
        return JSONResponse(status_code=400, content={"error": "Folder picker only available locally."})
    
    import subprocess
    import sys
    script = """
import tkinter as tk
from tkinter import filedialog
import sys
root = tk.Tk()
root.withdraw()
root.attributes("-topmost", True)
path = filedialog.askdirectory(title="Select Download Folder")
root.destroy()
sys.stdout.write(path)
"""
    try:
        result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
        return {"folder": result.stdout.strip()}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/api/download")
def download(data: DownloadRequest, background_tasks: BackgroundTasks):
    user_input = data.query
    
    if "spotify.com" in user_input:
        query = f"ytsearch1:{spotify_to_query(user_input)}"
    elif "youtube.com" in user_input or "youtu.be" in user_input:
        query = user_input
    else:
        query = f"ytsearch1:{user_input}"

    is_cloud = os.environ.get("VERCEL") or not data.save_path
    
    if is_cloud:
        temp_dir = tempfile.mkdtemp()
        try:
            download_media(query, temp_dir, data.media_type, data.quality)
            downloaded_files = [f for f in os.listdir(temp_dir) if os.path.isfile(os.path.join(temp_dir, f))]
            if not downloaded_files:
                raise Exception("No file was downloaded.")
            file_path = os.path.join(temp_dir, downloaded_files[0])
            filename = downloaded_files[0]
            def cleanup():
                shutil.rmtree(temp_dir, ignore_errors=True)
            background_tasks.add_task(cleanup)
            return FileResponse(path=file_path, filename=filename, media_type='application/octet-stream')
        except Exception as e:
            shutil.rmtree(temp_dir, ignore_errors=True)
            return JSONResponse(status_code=500, content={"error": str(e)})
    else:
        save_path = os.path.expanduser(data.save_path)
        if save_path.lower() == "downloads":
            save_path = os.path.join(os.path.expanduser("~"), "Downloads")
        save_path = os.path.abspath(save_path)

        if not os.path.exists(save_path):
            os.makedirs(save_path, exist_ok=True)

        try:
            download_media(query, save_path, data.media_type, data.quality)
            return {"message": "Download completed!", "saved_to": save_path}
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})