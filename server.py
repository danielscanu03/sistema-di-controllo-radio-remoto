from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
import uvicorn

from Fhtml import index_html, clientA_html, clientB_html
from Fscript import websocket_script_js, module_js


from pathlib import Path
import os
import json

import random
import string

from MessageHandler import MessageHandler, ClientData
from BufferManager import BufferManager

app = FastAPI(title = "radio server",description = "")
@app.middleware("http")
async def no_cache_middleware(request: Request, call_next):
    response: Response = await call_next(request)

    # Se non hai impostato tu un header di cache, lo metto io
    if "Cache-Control" not in response.headers:
        response.headers["Cache-Control"] = "no-store"

    return response



class ChatHandler(MessageHandler):
    def __init__(self):
        super().__init__()
        self.buffer = BufferManager(8192);
        self.bufferPCM = BufferManager(24576);
    async def forward_message(self, message: str, data: ClientData, 
                              message2: str, sender=None):
        #print(f"forward_message to {data.pack}:{data.pack2}")
        if sender is None:
            # broadcast a tutti i client in clientAs
            if message:
                modified_message = {
                    "from": "server",
                    "pack": data.pack,
                    "data": message
                }
                for ws, client_data in self.clients.getL("A"):
                    try:
                        await ws.send_text(json.dumps(modified_message))
                    except Exception as e:
                        print(f"Failed to send to client {client_data.username}: {e}")
                data.pack += 1
            return  # esci: non c’è sender specifico
        # altrimenti: logica per inoltro al sender specifico
    
        if message and sender:
            
            sendedby = self.clients.get(sender)[1]
            
            # costruisci nome come IP:Port
            # name = f"{sender.client.host}:{sender.client.port}"
            modified_message = {
                "from": sendedby.codelogin,
                "pack": data.pack,
                "data": message
            }
            msg_json = json.dumps(modified_message)
            
            for i,(ws,cli) in self.clients.getL(sendedby.connections):
                await ws.send_text(msg_json)
            

            # # se sender è in clientBs → manda a tutti clientAs
            # if any(ws == sender for i,(ws, _) in self.clients.getL("B")):
                # for i2,(ws, _) in self.clients.getL("A"):
                    # try:
                        # await ws.send_text(msg_json)
                    # except Exception as e:
                        # print(f"Failed to send to client A: {e}")

            # # se sender è in clientAs → manda a tutti clientBs
            # elif any(ws == sender for i,(ws, _) in self.clients.getL("A")):
                # for i2,(ws, _) in self.clients.getL("B"):
                    # try:
                        # await ws.send_text(msg_json)
                    # except Exception as e:
                        # print(f"Failed to send to client B: {e}")

            data.pack += 1

    
        if message2 and sender and (message2 == "end" and data.pack2 !=0 or message2 != "end"):
            name = "server"
            modified_message = {
                "from": name,
                "pack": data.pack2,
                "data": message2
            }
            try:
                await sender.send_text(json.dumps(modified_message))
            except Exception as e:
                print(f"Failed to send to client: {e}")
            data.pack2 += 1


    async def onConnect(self, websocket: WebSocket, path: str, arg=None):
        code = websocket.query_params.get("login")
        client_ip = websocket.client.host
        client_port = websocket.client.port
        default_data = ClientData(f"{client_ip}:{client_port}/{code}", 0, True)
        default_data.codelogin = code
        default_data.typewb = "A" if path == "/websocketA" else "B"
        print(default_data.getcode())
        self.clients.add(websocket, default_data)
        if path == "/websocketA":
            self.clientAs.append((websocket, default_data))
            #default_data.connections.append("B")
        else:
            self.clientBs.append((websocket, default_data))
            #default_data.connections.append("A")
        print(f"Client connected to {path}: {client_ip}")

        # puoi salvare il websocket in una lista se vuoi broadcast
    async def remove_client(self,websocket: WebSocket, webSocketPath: str):
        clients = self.clientAs if webSocketPath == "/websocketA" else self.clientBs
        # trova e rimuove il client
        
        removed = self.clients.disconnect(websocket)
        print(f"client removed {removed[1].username}")
        
        for (i,item),sub in [(item,sub) for sub in [self.clientAs,self.clientBs] for item in enumerate(sub)]:
            (ws, data) = item
            if ws == websocket:
                sub.pop(i)
                print(f"Client disconnected from {webSocketPath}: {data.username}")
            
            
            

    async def onDisconnect(self, websocket: WebSocket, path: str, arg=None):
        print(f"Disconnected: {path}")
        await self.remove_client(websocket, path)



    async def onMessage(self, websocket: WebSocket, message: str, path: str, arg=None):
        # Recupera i dati associati al client
        data = self.get_data(websocket)

        # Gestione lasting (simulazione di frameInfo->len)
        if data.lasting == 0:
            data.lasting = len(message)  # in C++ era frameInfo->len
        data.lasting -= len(message)

        # Finale o meno
        data.final = data.lasting <= 0

        #print(f"onMessage updating data N:{data.username} end:{data.final} L:{len(message)} to:{data.lasting}")

        # Aggiorna i dati del client
        self.update_data(websocket, data)

        # Processa il messaggio
        await self.processWebSocketMessage(message, buffer_size=0, speaker_on=True,
                                        BUFFER_SIZE=16384, buffer=self.buffer, sender=websocket)
    

chatHandler = ChatHandler()

from pydantic import BaseModel

class ErrorLog(BaseModel):
    error: str
    time: int
    stack: str


@app.post("/log/error")
def log_error(request: ErrorLog):
    print("Errore:", request.error)
    print("Stack:", request.stack)
    print("Time:", request.time)
    return {"status": "ok"}

def generate_random_code(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

@app.get("/signin")
def signin():
    code = generate_random_code()
    return {"code": code}
    
@app.get("/hosts")
def hosts():
    cla = [{"codelogin":v.codelogin,"radio":v.radio} for i,(c,v) in chatHandler.clients.getL("A")]
    return {"hosts": cla}
    
@app.get("/clients")
def clients(request: Request):
    login = request.query_params.get("login")
    logindata=chatHandler.clients.get(login)[1]
    cla = [{"codelogin":v.codelogin,"radio":v.radio,"type":v.typewb} for i,(c,v) in chatHandler.clients.getL(logindata.connections)] if logindata else []
    return {"clients": cla}
    
@app.get("/listen")
def listen(request: Request):
    login = request.query_params.get("login")
    set = request.query_params.get("set")
    add = request.query_params.get("add")
    
    client=chatHandler.clients.get(login)[1]
    
    
    if client and set:
        host=chatHandler.clients.get(set)[1]
        if not host:
            return {"state": "listen not found"}
        host.connections.append(login)
        client.connections=[set]
        print(host,host.connections)
    elif client and add:
        host=chatHandler.clients.get(add)[1]
        if not host:
            return {"state": "listen not found"}
        host.connections.append(login)
        client.connections.append(add)
        print(host,host.connections)
    else:
        print(f"error client not found:{login} / {set} / {add}")
    return {"state": "OK"}


@app.get("/infoss")
async def root(request: Request):
    client_ip = f"{request.client.host}:{request.client.port}"
    cla = [(v.username,v.codelogin,v.getcode()) for (c,v) in chatHandler.clientAs]
    clb = [(v.username,v.codelogin,v.getcode()) for (c,v) in chatHandler.clientBs]
    clr = [(v.username,v.codelogin,v.getcode(),v.typewb) for (c,v) in chatHandler.clients.clients]
    print(cla)
    print(clb)
    print(clr)
    return {"ip": client_ip}



@app.get("/", response_class=HTMLResponse)
async def root():
    #return index_html
    from pathlib import Path
    html_path = Path("server/radiocontroller.html")
    return html_path.read_text(encoding="utf-8")
    

@app.get("/clientA.html", response_class=HTMLResponse)
async def root():
    return clientA_html
@app.get("/clientB.html", response_class=HTMLResponse)
async def root():
    return clientB_html
    

@app.get("/websocket_script.js", response_class=HTMLResponse)
async def root():
    return Response(content=websocket_script_js, media_type="application/javascript")


@app.get("/module.js")
async def root():
    return Response(content=module_js, media_type="application/javascript")

    
@app.get("/ping")
async def root():
    return Response(content="pong", media_type="text/plain")

@app.websocket("/websocketA")
async def websocket_a(websocket: WebSocket):
    await websocket.accept()
    await chatHandler.onConnect(websocket, "/websocketA")
    try:
        while True:
            data = await websocket.receive_text()
            await chatHandler.onMessage(websocket, data, "/websocketA")
    except WebSocketDisconnect:
        await chatHandler.onDisconnect(websocket, "/websocketA")
    except RuntimeError:
        print("error");

@app.websocket("/websocketB")
async def websocket_b(websocket: WebSocket):
    await websocket.accept()
    await chatHandler.onConnect(websocket, "/websocketB")
    try:
        while True:
            data = await websocket.receive_text()
            await chatHandler.onMessage(websocket, data, "/websocketB")
    except WebSocketDisconnect:
        await chatHandler.onDisconnect(websocket, "/websocketB")


app.mount("/",StaticFiles(directory="server"),name="server")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0",port=80)