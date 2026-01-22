import os
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse, Response, FileResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
import psutil

from Fhtml import manager_html, upload_page_html

app = FastAPI()

app.mount("/static",StaticFiles(directory="static"),name="static")

@app.get("/config.json")
async def get_config():
    path = "config.json"   # percorso del file sul tuo server
    if os.path.exists(path):
        # Restituisce il file con Content-Type application/json
        return FileResponse(path, media_type="application/json")
    else:
        # Restituisce un JSON di errore con status 404
        return JSONResponse(
            status_code=404,
            content={"error": "config.json not found"}
        )
@app.get("/manager", response_class=HTMLResponse)
async def manager():
  return manager_html
@app.get("/", response_class=HTMLResponse)
async def manager():
  return manager_html

@app.get("/upload", response_class=HTMLResponse)
async def manager():
  return upload_page_html


@app.post("/uploadConfig")
async def upload_config(file: UploadFile = File(...)):
    path = "config.json"   # nome fisso, come su ESP32
    with open(path, "wb") as f:
        f.write(await file.read())
    return PlainTextResponse("Config file uploaded!")

# Upload di un file generico dentro /data/
@app.post("/uploadData")
async def upload_data(file: UploadFile = File(...)):
    os.makedirs("data", exist_ok=True)   # crea la cartella se non esiste
    path = os.path.join("data", file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())
    return PlainTextResponse("Data file uploaded!")





@app.get("/stats")
async def stats():
    # Memoria
    virtual_mem = psutil.virtual_memory()
    free_heap = virtual_mem.available
    heap_size = virtual_mem.total

    # Disco (simile a SPIFFS)
    disk_usage = psutil.disk_usage(os.getcwd())
    total_bytes = disk_usage.total
    used_bytes = disk_usage.used

    # CPU
    cpu_freq = psutil.cpu_freq().current if psutil.cpu_freq() else None
    cpu_load = psutil.cpu_percent(interval=0.1)  # percentuale di utilizzo

    # Flash size → su PC non ha senso, puoi omettere o usare total_bytes
    flash_size = total_bytes

    # Costruisci JSON
    data = {
        "freeHeap": free_heap,
        "HeapSize": heap_size,
        "flashSize": flash_size,
        "cpuFreq": cpu_freq,
        "totalBytes": total_bytes,
        "usedBytes": used_bytes,
        "cpuLoad": cpu_load,
    }

    return JSONResponse(content=data)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0",port=8080)