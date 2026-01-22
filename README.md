\# Setup del progetto



Questo progetto utilizza un ambiente virtuale Python (`venv`) che \*\*non è incluso nel repository\*\*.  

Per iniziare, esegui lo script di setup che crea automaticamente il venv e installa le dipendenze.



Setup (Windows)



Apri PowerShell nella cartella del progetto ed esegui:



```powershell

powershell -ExecutionPolicy Bypass -File setup.ps1


Avvio del progetto

Ogni volta che vuoi avviare il progetto:
```powershell

.\\venv\\Scripts\\Activate.ps1

python .\\server.py

> Nota importante  

> Il progetto potrebbe avere problemi nell’accesso all’audio se eseguito senza HTTPS.  

> Si consiglia di utilizzare un dispositivo o un ambiente dotato di certificati SSL validi.



versione 1.1.0
aggiunta la radio ft-718
problemi molti pulsanti hanno smesso di funzionare