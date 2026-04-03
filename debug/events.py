# events.py
connections = set()

async def register(ws):
    connections.add(ws)

async def unregister(ws):
    connections.remove(ws)

async def emit_event(event_type, data):
    message = {"type": event_type, "data": data}
    dead = []
    for ws in connections:
        try:
            await ws.send_json(message)
        except:
            dead.append(ws)
    for ws in dead:
        connections.remove(ws)