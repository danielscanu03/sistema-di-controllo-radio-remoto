from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

import uvicorn
import logging
import asyncio


from Fhtml import index_html, clientA_html, clientB_html
from Fscript import websocket_script_js, module_js

from debug.monitor import router as monitor_router
from debug.monitor import debug as debug_processor


from pathlib import Path
import os
import json

import random
import string

from MessageHandler import MessageHandler, ClientData
from BufferManager import BufferManager

app = FastAPI(title = "radio server",description = "")



app.include_router(monitor_router, prefix="/monitor")




@app.middleware("http")
async def no_cache_middleware(request: Request, call_next):
    try:
        response: Response = await call_next(request)
        # if server_info["host"] is None:
            # server_info["host"] = request.url.hostname
            # server_info["port"] = request.url.port

            # if not server_info["printed"]:
                # url = f"http://{server_info['host']}:{server_info['port']}/logger"
                # print(f"\n🔗 Vai a questo link per il logger: {url}\n")
                # server_info["printed"] = True

        # Se non hai impostato tu un header di cache, lo metto io
        if "Cache-Control" not in response.headers:
            response.headers["Cache-Control"] = "no-store"

        return response
    except Exception as e:
        await debug_processor("EXCEPTION", str(e),{},None)
        raise


class WebSocketLogHandler(logging.Handler):
    def emit(self, record):
        try:
            
            #print(record.__dict__);
            #if record.__dict__['msg']=='Uvicorn running on %s://%s:%d (Press CTRL+C to quit)':
            #    print(record.__dict__);
            
            
            data = {"msg":self.format(record)}
            if record.name in ["uvicorn","uvicorn.access","uvicorn.error"]:
                slots = [None, None, None, None, None]
                args = record.__dict__["args"]
                slots[:len(args)] = args[:5]
                ip, url, httpV, code ,_ = slots
                if len(args)==5:
                    ip, url, url2, httpV, code = slots
                    url = f"{url} {url2}"
                data["uvicorn.log"]={
                    "ip": ip,
                    "method": url,
                    "htttpV":httpV, 
                    "code":code
                }
            
            asyncio.create_task(debug_processor("internal_state",record.levelname, data, None))
        except Exception:
            pass
 

@app.on_event("startup")
async def setup_logging():
    handler = WebSocketLogHandler()
    formatter = logging.Formatter("%(levelname)s: %(message)s")
    handler.setFormatter(formatter)
    logging.getLogger("uvicorn").info("Monitor logging attivato")
    logging.getLogger("fastapi").info("Monitor logging attivato")

    # Attacca l’handler ai logger principali
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"): #remove handlers
        logger = logging.getLogger(name)
        logger.handlers = []      # rimuove gli handler che stampano
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access","fastapi","asyncio"): #add handlers
        logger = logging.getLogger(name)
        logger.addHandler(handler)
    for name in ("uvicorn.error", "uvicorn.access"): #remove propagation
        logger = logging.getLogger(name)
        logger.propagate = False

    # Log di test



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
        print(f"Client connected to {path}: {client_ip}")
        # puoi salvare il websocket in una lista se vuoi broadcast
    async def remove_client(self,websocket: WebSocket, webSocketPath: str):
        # trova e rimuove il client
        
        removed = self.clients.disconnect(websocket)
        print(f"client removed {removed[1].username}")

            
            
            

    async def onDisconnect(self, websocket: WebSocket, path: str, arg=None):
        print(f"Disconnected: {path}")
        await self.remove_client(websocket, path)

    async def serverresponse(self,Json,wb,data):
        
        
        if Json["request"] == "getclients":
            cla = [{"codelogin":v.codelogin,"radio":v.radio,"type":v.typewb,"username":v.settedusername} for i,(c,v) in self.clients.getL(data.connections)] if data else []
            
            msg = json.dumps({"type": "server","data":cla})
            
            modified_message = {"from": "server","pack": "0","data": msg}
            modified_message2 = {"from": "server","pack": "1","data": "end"}
            await wb.send_text(json.dumps(modified_message))
            await wb.send_text(json.dumps(modified_message2))
            #print(Json,cla)
        
        
        
        
        
        

    async def onMessage(self, websocket: WebSocket, message: str, path: str, arg=None):
        # Recupera i dati associati al client
        data = self.get_data(websocket)
        jsonmsg = json.loads(message)
        if jsonmsg["type"] == "server":
            await self.serverresponse(jsonmsg,websocket,data)
            return
        
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
class DataLog(BaseModel):
    model_config = {'extra': 'allow'}

@app.post("/log/error")
async def log_error(data: ErrorLog, request: Request):
    print("Errore:", data.error)
    print("Stack:", data.stack)
    print("Time:", data.time)
    
    await debug_processor("remote_error",data.error,{"javascript.stack":data.stack},data.time)
    
    return {"status": "ok"}

def generate_random_code(length=6):
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

@app.get("/signin")
def signin():
    code = generate_random_code()
    code2 = generate_random_code()
    return {"code": code,"session":code2}
@app.get("/login")
def signin(request: Request):
    login = request.query_params.get("login")
    username = request.query_params.get("username")
    code = generate_random_code()
    if login and username:
        logindata=chatHandler.clients.get(login)[1]
        if not logindata:
            logindata=ClientData("", 0, False)
            logindata.codelogin = f"{login}-{code}"
        logindata.settedusername=username
        logindata.save()
    return {"session": code}
    
@app.get("/hosts")
def hosts():
    cla = [{"codelogin":v.codelogin,"radio":v.radio,"username":v.settedusername} for i,(c,v) in chatHandler.clients.getL("A")]
    return {"hosts": cla}
@app.post("/setinfo")
def setinfo(data: DataLog, request: Request):
    login = request.query_params.get("login")
    logindata=chatHandler.clients.get(login)[1]
    
    
    if 'radio' in data.data:
        logindata.radio=data.data['radio']
    if 'username' in data.data:
        logindata.settedusername=data.data['username']
    
    
    print("set",data.data,login);
    return {"status": "ok"}
    
@app.get("/clients")
def clients(request: Request):
    login = request.query_params.get("login")
    logindata=chatHandler.clients.get(login)[1]
    cla = [{"codelogin":v.codelogin,"radio":v.radio,"type":v.typewb,"username":v.settedusername} for i,(c,v) in chatHandler.clients.getL(logindata.connections)] if logindata else []
    #print("cli..",cla);
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
        host.connect(login)
        client.connections=[set]
        #print(host,host.connections)
    elif client and add:
        host=chatHandler.clients.get(add)[1]
        if not host:
            return {"state": "listen not found"}
        host.connect(login)
        client.connect(add)
        #print(host,host.connections)
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