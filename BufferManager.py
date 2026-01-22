from collections import deque

class BufferManager:
    def __init__(self, size: int):
        self.buffer = deque(maxlen=size)  # buffer circolare
        self.bufferSize = size

    def add_data(self, input_bytes: bytes):
        """Aggiunge dati al buffer (bytes o lista di int)."""
        for b in input_bytes:
            self.buffer.append(b)

    def read_data(self, length: int, update_tail: bool = True) -> list[int]:
        """Legge fino a 'length' elementi dal buffer."""
        output = []
        for i in range(min(length, len(self.buffer))):
            output.append(self.buffer[i])
        if update_tail:
            # rimuove gli elementi letti
            for _ in range(len(output)):
                self.buffer.popleft()
        return output

    def get_size(self) -> int:
        """Numero di elementi attualmente nel buffer."""
        return len(self.buffer)

    def get_total_size(self) -> int:
        """Capacità massima del buffer."""
        return self.bufferSize

    def reset(self):
        """Svuota il buffer."""
        self.buffer.clear()