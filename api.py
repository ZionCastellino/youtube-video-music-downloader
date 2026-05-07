from fastapi import FastAPI
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yt_dlp
import os
import requests

app = FastAPI()

# Allow hosted frontends (different origin) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    # If someone opens the FastAPI server root, take them to the download UI.
    return RedirectResponse(url="/download")

@app.get("/home")
def home_alias():
    # Keep backward compatibility if the frontend hits `/home`.
    return RedirectResponse(url="/download")

@app.get("/download")
def download_page():
    # Simple HTML UI that calls the existing POST /download endpoint.
    html = """
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Music Downloader</title>
  </head>
  <body style="font-family: Arial, sans-serif; max-width: 900px; margin: 24px auto;">
    <h2>Music Downloader</h2>
    <p>Send a link to download audio. This page calls <code>POST /download</code>.</p>

    <form id="downloadForm" style="display: grid; gap: 12px; max-width: 700px;">
      <label>
        Query (YouTube/Spotify link or search query)
        <input name="query" type="text" style="width: 100%; padding: 8px;" required />
      </label>
      <label>
        Save path (must exist)
        <input name="save_path" type="text" style="width: 100%; padding: 8px;" required />
      </label>
      <button type="submit" style="padding: 10px 14px;">Download</button>
    </form>

    <pre id="out" style="margin-top: 16px; background: #f5f5f5; padding: 12px; white-space: pre-wrap;"></pre>

    <script>
      const form = document.getElementById('downloadForm');
      const out = document.getElementById('out');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        out.textContent = 'Submitting...';

        const payload = {
          query: form.query.value,
          save_path: form.save_path.value
        };

        try {
          const res = await fetch('/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          out.textContent = JSON.stringify(data, null, 2);
        } catch (err) {
          out.textContent = String(err);
        }
      });
    </script>
  </body>
</html>
    """.strip()

    return HTMLResponse(html)

class Request(BaseModel):
    query: str
    save_path: str
    media_type: str = "audio"
    quality: str = "high"


def download_media(query, save_path, media_type, quality):
    if media_type == "audio":
        preferredquality = "320"
        if quality == "high":
            preferredquality = "320"
        elif quality == "medium":
            preferredquality = "192"
        elif quality == "low":
            preferredquality = "128"
            
        options = {
            'format': 'bestaudio/best',
            'outtmpl': os.path.join(save_path, '%(title)s.%(ext)s'),
            'default_search': 'ytsearch1',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': preferredquality,
            }],
        }
    else:
        # video
        format_str = 'bestvideo+bestaudio/best'
        if quality == "1080p":
            format_str = 'bestvideo[height<=1080]+bestaudio/best'
        elif quality == "720p":
            format_str = 'bestvideo[height<=720]+bestaudio/best'
        elif quality == "480p":
            format_str = 'bestvideo[height<=480]+bestaudio/best'
            
        options = {
            'format': format_str,
            'outtmpl': os.path.join(save_path, '%(title)s.%(ext)s'),
            'default_search': 'ytsearch1',
            'merge_output_format': 'mp4',
        }

    with yt_dlp.YoutubeDL(options) as ydl:
        ydl.download([query])


def spotify_to_query(link):
    try:
        html = requests.get(link, headers={'User-Agent': 'Mozilla/5.0'}).text
        title = html.split("<title>")[1].split("</title>")[0]
        title = title.replace(" - song and lyrics by ", " ")
        title = title.replace(" | Spotify", "")
        # Do not append ' official audio' because obscure songs might return 0 search results
        return title.strip()
    except:
        return link

@app.get("/pick-folder")
def pick_folder():
    import subprocess
    import sys
    script = """
import tkinter as tk
from tkinter import filedialog
import sys
root = tk.Tk()
root.withdraw()
root.attributes("-topmost", True) # Force window to the front
path = filedialog.askdirectory(title="Select Download Folder")
root.destroy()
sys.stdout.write(path)
"""
    try:
        # Spawning directly using sys.executable protects us from Tkinter crashing Uvicorn's worker threads!
        result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True)
        folder_path = result.stdout.strip()
        return {"folder": folder_path}
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"error": str(e)})

@app.post("/download")
def download(data: Request):
    user_input = data.query
    
    # Expand ~ to the user's home directory if they use it
    save_path = os.path.expanduser(data.save_path)
    # If they just wrote "Downloads", let's default to the actual Windows Downloads folder
    if save_path.lower() == "downloads":
        save_path = os.path.join(os.path.expanduser("~"), "Downloads")
    # Resolve to absolute path so it doesn't just save locally if they type a relative path
    save_path = os.path.abspath(save_path)

    if "spotify.com" in user_input:
        query = f"ytsearch1:{spotify_to_query(user_input)}"
    elif "youtube.com" in user_input or "youtu.be" in user_input:
        query = user_input
    else:
        query = f"ytsearch1:{user_input}"

    # If the folder doesn't exist yet, try creating it (helps deployments).
    if not os.path.exists(save_path):
        try:
            os.makedirs(save_path, exist_ok=True)
        except Exception:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=400, content={"error": f"Invalid folder path: cannot create '{save_path}'"})

    try:
        download_media(query, save_path, data.media_type, data.quality)
        return {"message": "Download completed!", "saved_to": save_path}
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=500, content={"error": str(e)})