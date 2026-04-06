from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import json, time, os

from BufferManager import BufferManager


class ClientData:
    def __init__(self, username="", size=0, connected=True):
        self.username = username
        self.settedusername = None
        self.lastMessageSize = size
        self.isConnected = connected
        self.codelogin = None
        self.connections = []
        self.typewb = ""
        self.radio = ""
        self.clear()
    def getcode(self):
        sep = self.codelogin.find('-') if self.codelogin else None
        return (self.codelogin[:sep],self.codelogin[sep+1:]) if sep else None
        
    def disconnect(self,clicode):
        if not clicode:
            self.connections = []
        else:
            self.connections.pop(self.connections.find(clicode))
    def connect(self,clicode):
        self.connections.append(clicode)
        
    def clear(self):
        self.final = False
        self.lasting = 0
        self.isnew = True
        self.pack = 0
        self.pack2 = 0
        self.audio_buffered = 0
        self.buffree = True
        self.inAudio = False
        self.buffaudio = False
        self.audioStarted = False
        self.typeValue = ""
        self.alength = -1
        return self
    def to_dict(self,populate=None):
        if not populate:
            return {
                "settedusername": self.settedusername,
                "expires_at": self.expires_at,
                "sessions":{f"{self.getcode()[1]}":{
                    "username": self.username,
                    "codelogin": self.codelogin,
                    "isConnected": self.isConnected,
                    "typewb":self.typewb
                }}
            }
        self.settedusername=self.settedusername if self.settedusername else populate["settedusername"]
        populate["settedusername"]=self.settedusername
        populate["expires_at"]= self.expires_at
        if self.isConnected:
            populate["sessions"][self.getcode()[1]]={
                "username": self.username,
                "codelogin": self.codelogin,
                "isConnected": self.isConnected,
                "typewb":self.typewb
            }
        return populate
        
    def save(self, path="clients.json"):
        if not self.codelogin:
            return
        self.expires_at = time.time() + 3600 * 24
        if os.path.exists(path):
            with open(path, "r") as f:
                try:
                    db = json.load(f)
                except Exception:
                    db = {}
        else:
            db = {}
        #print(db,f"-{self.username}-")
        # if self.getcode()[0] in db and "settedusername" in db[self.getcode()[0]] and not self.settedusername:
            # print("???",self.settedusername,db[self.getcode()[0]])
            # self.settedusername=db[self.getcode()[0]]["settedusername"]
        db[self.getcode()[0]] = self.to_dict(db[self.getcode()[0]] if self.getcode()[0] in db else None)
        with open(path, "w") as f:
            json.dump(db, f, indent=4)
        self.cleanup_expired()
    def cleanup_expired(self,path="clients.json"):
        if not os.path.exists(path):
            return

        with open(path, "r") as f:
            db = json.load(f)
        
        now = time.time()
        newdb = {k: v for k, v in db.items() if v.get("expires_at", 0) > now}

        with open(path, "w") as f:
            json.dump(newdb, f, indent=4)


class ClientManager():
    def __init__(self):
        self.clients: list[tuple[WebSocket, ClientData]] = []
        
    def add(self,websocket: WebSocket, default_data: ClientData):
        self.clients.append((websocket,default_data))
        default_data.save()
    
    def remove(self,element) -> tuple[WebSocket, ClientData]:
        i,(wb,cli)=self.getI(element)
        self.clients.pop(i)
        return (wb,cli)
    def get(self,element) -> tuple[WebSocket, ClientData]:
        getted=self.getI(element)
        if not getted:
            return None,None
        i,(wb,cli)=getted
        return wb,cli
    def getL(self,element) -> [tuple[int,tuple[WebSocket, ClientData]]]:
        ret = [] 
        def controll(i,wb,cli,conds):
            if isinstance(conds,WebSocket) and wb==conds:
                ret.append((i,(wb,cli)))
            elif isinstance(conds,ClientData) and cli==conds:
                ret.append((i,(wb,cli)))
            elif isinstance(conds,list):
                for cond in conds:
                    controll(i,wb,cli,cond)
            elif isinstance(conds,str):
                #print(f"str:{conds} == {cli.typewb} or {cli.codelogin} of {len(self.clients)}")
                if conds == cli.typewb:
                    ret.append((i,(wb,cli)))
                elif conds == cli.codelogin:
                    ret.append((i,(wb,cli)))
        for i,(wb,cli) in enumerate(self.clients):
            controll(i,wb,cli,element)
        
        return ret
        
        
    def getI(self,element) -> (int,tuple[WebSocket, ClientData]):
        list=self.getL(element)
        return list[0] if len(list)!=0 else None
        
    def update(self,websocket: WebSocket,clientdata: ClientData):
        i,(wb,cli)=self.getI(websocket)
        self.clients[i]=(wb,clientdata)
        
    def disconnect(self,element):
        clientdata=self.get(element)[1]
        for i,(wb,cli) in enumerate(self.clients):
            for i2,conn in enumerate(cli.connections):
                if conn==clientdata.codelogin:
                    cli.connections.pop(i2)
        clientdata.isConnected=False
        clientdata.save()
        return self.remove(clientdata)

class MessageHandler:
    def __init__(self):
        self.clientAs: list[tuple[WebSocket, ClientData]] = []
        self.clientBs: list[tuple[WebSocket, ClientData]] = []
        self.clients: ClientManager = ClientManager();
        self.Datatime = 0
        self.milltime = 0
        self.audiosampleRate = 8000
        self.updated = False

    def millis(self):
        """Ritorna il tempo corrente in millisecondi (simile ad Arduino)."""
        return int(time.monotonic() * 1000)

    def updatetime(self,data: int):
        delay = int(self.Datatime + self.millis() - self.milltime - data)
        if delay > 0 and delay < 2000:
            return
        self.Datatime = data
        self.milltime = self.millis()
    
    def getDatetime(self) -> int:
        return self.Datatime + millis() - self.milltime

    def update_data(self, websocket: WebSocket, data: ClientData):
        # aggiorna clientAs
        
        self.clients.update(websocket,data)
        
        for i, (ws, cd) in enumerate(self.clientAs):
            if ws == websocket:
                self.clientAs[i] = (ws, data)

        # aggiorna clientBs
        for i, (ws, cd) in enumerate(self.clientBs):
            if ws == websocket:
                self.clientBs[i] = (ws, data)

    def get_data(self, websocket: WebSocket) -> ClientData:
        # cerca in clientAs
        data = self.clients.get(websocket)[1]
        print("getData error") if not data else None
        return data if data else ClientData()  # ritorna un ClientData di default
    

    def change_var(self, message: str, key: str, value: str) -> str:
        search_string = f'"{key}":"'
        key_pos = message.find(search_string)
        if key_pos != -1:
            value_start = key_pos + len(search_string)
            value_end = message.find('"', value_start)
            if value_end != -1:
                # sostituisci il vecchio valore con quello nuovo
                return message[:value_start] + value + message[value_end:]
        return message
    
    def get_var(self, message: str, key_type: str) -> str:
        if not message or not key_type:
            return ""
        
        end = '"'
        if key_type.endswith(":"):
            end = ","
        
        key_start = message.find(key_type)
        if key_start != -1:
            value_start = key_start + len(key_type)
            value_end = message.find(end, value_start)
            if value_end != -1:
                return message[value_start:value_end]
        
        return ""
    
    async def forward_message(self, message: str,
                        data: ClientData,
                        message2: str = "",
                        sender=None):
        print("Forwarding message from base class")

    
    def escape_quotes(self,input_str: str) -> str:
        return input_str.replace('"', '\\"')
        
    def save_json_to_fs(self,json_str: str, reset: bool = False, filename: str = "server/datatemp.json"):
        try:
            # Modalità: overwrite ("w") oppure append ("a")
            mode = "w" if reset else "a"
            with open(filename, mode, encoding="utf-8") as f:
                f.write(json_str)
            #print(f"Saved JSON to {filename} (reset={reset})")
        except Exception as e:
            print(f"Failed to save JSON: {e}")
    def parse_json_from_fs(self,filename: str, filter_keys: list[str] | None = None) -> dict:
        try:
            with open(filename, "r", encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            print("Failed to open file for reading")
            return {}
        except json.JSONDecodeError as e:
            print(f"Failed to parse JSON: {e}")
            return {}

        # Se è presente un filtro → estrai solo le chiavi richieste
        if filter_keys:
            filtered = {k: data[k] for k in filter_keys if k in data}
            return filtered

        return data

    async def processWebSocketMessage(self,
                                        message: str,
                                        buffer_size: int,
                                        speaker_on: bool,
                                        BUFFER_SIZE: int,
                                        buffer: BufferManager,
                                        sender):
        data = self.get_data(sender)
        data.isnew = False
        data.typeValue = self.get_var(message,"\"type\":\"")
        alength_value = self.get_var(message,"\"alength\":")
        #print(f"processing L {alength_value}")
        if alength_value:
            if alength_value.isdigit():
                data.alength = int(alength_value)
            else:
                # chiudi la connessione se il valore non è numerico
                try:
                    sender.close()
                except Exception:
                    print("Errore: impossibile chiudere il sender")
        else:
            data.alength = 0
       
        time_value = self.get_var(message,"\"time\":");
        audiosample = self.get_var(message,"\"sampleRate\":");
        
        if data.typeValue == "audio":
            if audiosample:
                if audiosample.isdigit():
                    data.audiosampleRate = int(audiosample)
                else:
                    sender.close()
                    return
            else:
                data.audiosampleRate = 8000

            if time_value:
                if time_value.isdigit():
                    data.timeaudio = int(time_value)
                else:
                    sender.close()
                    return
            else:
                data.timeaudio = 0

        # gestione ping
        if data.typeValue == "ping":
            if time_value:
                if time_value.isdigit():
                    self.updatetime(int(time_value))
                else:
                    sender.close()
                    return

        # step 2: flags
        if data.alength != -1:
            data.buffree = (data.alength < BUFFER_SIZE - buffer.get_size())

        data.inAudio = (data.typeValue == "audio" and speaker_on and data.buffree)

        # aggiorna i dati del client
        self.update_data(sender, data)

        if data.typeValue == "update":
            if hasattr(data, "use_flag") and data.use_flag:
                self.save_json_to_fs(message, True)
            else:
                self.save_json_to_fs(message)

            if data.final:
                updated = True
        
        if data.inAudio:
            audio_start_pos = message.find('"audio":"')
            if audio_start_pos != -1:
                audio_start_pos += 9
            else:
                audio_start_pos = 0

            audio_end_pos = message.find('"', audio_start_pos)
            if audio_end_pos == -1:
                audio_end_pos = len(message)

            audio_chunk = message[audio_start_pos:audio_end_pos]

            data.audioStarted = True
            data.buffaudio = True

            # aggiungi i dati al buffer (convertiti in bytes)
            buffer.add_data(audio_chunk.encode("utf-8"))

            # aggiorna contatore
            data.audio_buffered += len(audio_chunk)

        # 1. audio info
        if data.audio_buffered > 0 and data.final:
            processed_audio_info = {
                "type": "info",
                "processedaudio": data.audio_buffered
            }
            await self.forward_message("", data, json.dumps(processed_audio_info), sender)

        # 2. messaggio normale
        if message:
            modified_message = message
            if data.typeValue == "ping":
                modified_message = self.change_var(modified_message, "type", "pong")

            await self.forward_message(
                message,
                data,
                modified_message if (speaker_on and modified_message != message) else "",
                sender
            )

        # 3. messaggio finale
        if data.final:
            await self.forward_message("end", data, "end", sender)

            # reset dei dati
            temp_data = data.clear()
            self.update_data(sender, temp_data)
        else:
            self.update_data(sender, data)

        