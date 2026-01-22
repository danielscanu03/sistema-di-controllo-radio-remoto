from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import time
import json

from BufferManager import BufferManager

class ClientData:
    def __init__(self, username="", size=0, connected=True):
        self.final = False
        self.lasting = 0
        self.username = username
        self.lastMessageSize = size
        self.isConnected = connected
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




class MessageHandler:
    def __init__(self):
        self.clientAs: list[tuple[WebSocket, ClientData]] = []
        self.clientBs: list[tuple[WebSocket, ClientData]] = []
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
        for i, (ws, cd) in enumerate(self.clientAs):
            if ws == websocket:
                self.clientAs[i] = (ws, data)

        # aggiorna clientBs
        for i, (ws, cd) in enumerate(self.clientBs):
            if ws == websocket:
                self.clientBs[i] = (ws, data)

    def get_data(self, websocket: WebSocket) -> ClientData:
        # cerca in clientAs
        for ws, cd in self.clientAs:
            if ws == websocket:
                return cd
        # cerca in clientBs
        for ws, cd in self.clientBs:
            if ws == websocket:
                return cd
        print("getData error")
        return ClientData()  # ritorna un ClientData di default
    

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
        
    def save_json_to_fs(json_str: str, reset: bool = False, filename: str = "server/datatemp.json"):
        try:
            # Modalità: overwrite ("w") oppure append ("a")
            mode = "w" if reset else "a"
            with open(filename, mode, encoding="utf-8") as f:
                f.write(json_str)
            print(f"Saved JSON to {filename} (reset={reset})")
        except Exception as e:
            print(f"Failed to save JSON: {e}")
    def parse_json_from_fs(filename: str, filter_keys: list[str] | None = None) -> dict:
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
        print(f"processing L {alength_value}")
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
            temp_data = ClientData(data.username)
            self.update_data(sender, temp_data)
        else:
            self.update_data(sender, data)

        