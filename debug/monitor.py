# monitor.py
from fastapi import APIRouter, WebSocket
from debug.events import register, unregister, emit_event

from pathlib import Path
from fastapi.responses import HTMLResponse,PlainTextResponse

import re
import hashlib


router = APIRouter()
log = {}


@router.get("/webdebug", response_class=HTMLResponse)
def UI():
    html_path = Path("debug/webdebug.html")
    return html_path.read_text(encoding="utf-8")
    
@router.get("/monitorscript.js", response_class=PlainTextResponse)
def JS():
    return PlainTextResponse(open("debug/monitorscript.js", encoding="utf-8").read(), media_type="text/javascript")

@router.websocket("/events")
async def events_ws(ws: WebSocket):
    await ws.accept()
    await register(ws)
    try:
        while True:
            await ws.receive_text()  # tieni vivo il WS
    except:
        await unregister(ws)
        
def normalize_stack(detail: str) -> str:
    lines = detail.strip().split("\n")
    cleaned = []
    for line in lines:
        # Rimuovi numeri di riga
        line = re.sub(r"line \d+", "line X", line)
        # Rimuovi percorsi assoluti
        line = re.sub(r"[A-Z]:\\\\[^:]+", "<PATH>", line)
        cleaned.append(line.strip())
    return "\n".join(cleaned)

def stack_signature(detail: str) -> str:
    normalized = normalize_stack(detail)
    return hashlib.sha1(normalized.encode()).hexdigest()

def deep_merge(a, b):
    for key, value in b.items():
        if (
            key in a
            and isinstance(a[key], dict)
            and isinstance(value, dict)
        ):
            deep_merge(a[key], value)
        else:
            a[key] = value
    return a


async def debug(type,name,data,time):
    temp = {f"{type}":{f"{name}":{"data":data,"time":time}}}
    if "uvicorn.log" in data:
        temp[type][name]={"uvicorn.log":{}}
        cache=temp[type][name]["uvicorn.log"]
        method = data["uvicorn.log"]["method"]
        if method:
            method = method.split("?")
            args = "&".join(sorted(method[len(method)-1].split("&"))) if len(method)>1 else None
            method=" ".join(method[:len(method)-1 if args else len(method)])
            temp[type][name]["uvicorn.log"][method]={}
            if args:
                temp[type][name]["uvicorn.log"][method][args]={}
                cache=temp[type][name]["uvicorn.log"][method][args]
            else:
                cache=temp[type][name]["uvicorn.log"][method]
        msg=data["msg"]
        if data["uvicorn.log"]["ip"]:
            msg=msg.replace(data["uvicorn.log"]["ip"],"{{ip}}")
        cache[msg]={}
        cache=cache[msg]
        cache["data"]={}
        cache["data"]["ip"]=data["uvicorn.log"]["ip"]
        cache["data"]["time"]=time
        #print(temp)
        
    entry = None
    signature=None
    
    if "javascript.stack" in data:
        stack = data["javascript.stack"]
        signature = stack_signature(stack)
        normalized = normalize_stack(stack)

        if signature not in temp[event_type][name]:
            temp[event_type][name][signature] = {
                "detail": normalized,
                "count": 0,
                "times": []
            }
     
        entry = temp[event_type][name][signature]

        entry["count"] += 1
        entry["times"].append(time)

        # Mantieni solo gli ultimi 20 timestamp
        entry["times"] = entry["times"][-20:]

        # Invia solo la versione compressa
    
    try:
        deep_merge(log,temp)
    except Exception as e:
        print(f"{name}:\t{str(e)}")
        
    await emit_event("update",temp)
    
    