

index_html = """
<!DOCTYPE html>
<html lang="en">
<input type="hidden" id="serverping" value='["false","false"]'>
<head>
  <meta charset="UTF-8">
  <title>WebSocket Example</title>
  <script type="module" src="/websocket_script.js"></script>
</head>
<body>
  <h1>WebSocket Example</h1>
  <p><a href="/clientA.html">Client A</a></p>
  <p><a href="/clientB.html">Client B</a></p>
  <button id="serverreset">reset server</button>
  <script type="module" src="/websocket_script.js"></script>
</body>
</html>
""";

clientA_html = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebSocket Client A</title>
  <script type="module" src="/websocket_script.js"></script>
  <link rel="stylesheet" href="/clientA.css">
</head>
<body>
  <script type="module" src="/clientA.js"></script>
  <div class="container">
    <div class="flex-row">
      <h1>ClientA</h1>
      <div id="connection"></div>
    </div>
    <div id="chatLog" style="min-height: 150px; background-color: #e9e9e9; padding: 10px; border-radius: 4px;"></div>
    <input type="text" id="chatInput" placeholder="Type your message here">
    <button id="sendBtn">Send</button>
    <button id="startPingBtn">Start Ping</button>
    <button id="stopPingBtn">Stop Ping</button>
    <button id="startRecordingBtn">Start Recording</button>
    <button id="stopRecordingBtn">Stop Recording</button>
    <button id="serverreset">Reset Server</button>
    <br><br>
    <button id="SetRadio">Set Radio</button>
    <button id="serialWrite0">Request Frequency</button>
    <input type="" id="radioInput" placeholder="Type your command here">
    <button id="sendcommBtn">Send</button>
    <button id="autorefresh">start autorefresh</button>
    <div id="Freq" style="min-height: 150px; background-color: #e9e9e9; padding: 10px; border-radius: 4px;"></div>
    <br><br>
    <div>
  <label for="Radio">Serial port Radio:</label>
  <select name="Radio" id="Radio">
  </select>
</div>

<!-- Advanced Settings Button -->
<button id="advancedBtn">Show Advanced Settings</button>

<!-- Advanced Settings Container -->
<div id="advancedSettings" style="display: none;">
  <div>
    <label for="SerialSpeed">Serial port speed:</label>
    <select name="speed" id="SerialSpeed">
    </select>
  </div>
  <div>
    <label for="stopBits">Serial port stopBits:</label>
    <select name="stopBits" id="stopBits">
    </select>
  </div>
  <div>
    <label for="parity">Serial port parity:</label>
    <select name="parity" id="parity">
    </select>
  </div>
  <div>
    <label for="dataBits">Serial port dataBits:</label>
    <select name="dataBits" id="dataBits">
    </select>
  </div>
  </div>
  <div>
    <label for="audiooutdevices">Connection audioout:</label>
    <select type="HTMLInputElement" name="audioout" id="audiooutdevices">
      <option value="none">none</option>
    </select>
  </div>
  <div>
    <label for="audioindevices">Connection audioin:</label>
    <select type="HTMLInputElement" name="audioin" id="audioindevices">
      <option value="none">none</option>
    </select>
  </div>
  </div>
</body>
</html>
""";

clientB_html = """
<!DOCTYPE html>
<html lang="en">
<input type="hidden" id="serverping" value='["false","false"]'>
<input type="hidden" id="radioinfo" value='{"VFOA frequency":145450000}'>
<script type="module" src="/websocket_script.js"></script>
<head>
  <meta charset="UTF-8">
  <title>WebSocket Client B</title>
  <link rel="stylesheet" href="/clientA.css">
</head>
<body>
  <button id="BTvanish" style="display: none;" class="vanisherButton">Click Me!</button>
  <div id="advancedSettings" class="advancedcontainer" style="display: block;">
  <div class="container">
  <div style="display: flex; align-items: center;">
    <h1>ClientB</h1>
    <div id="connection"></div>
  </div>
  <div id="chatLog" id="chatLog" style="min-height: 150px; background-color: #e9e9e9; padding: 10px; border-radius: 4px;"></div>
  <input type="text" id="chatInput" placeholder="Type your message here">
  <button id="sendBtn">Send</button>
  <button id="serverreset">reset server</button>
  <br><br>
  <input type="" id="radioInput" placeholder="Type your command here">
  <button id="sendcommBtn">Send</button><button id="advancedBtn">Show Advanced Settings</button>
  <br><br>
  
  <br><br>
  <div id="radioLog" id="chatLog" style="display: none;min-height: 150px; background-color: #e9e9e9; padding: 10px; border-radius: 4px;"></div>
  </div>
  </div>
  <div id="advancedSettings2" class="advancedcontainer" style="display: none;">
    <div class="container">
    <button id="advancedBtn2">Hide Advanced Settings</button>
      <div class="containerblack">
    <!-- Indicators -->
    <div class="indicators">
      <span id="VFOAindics">VFOA</span>
      <span id="VFOBindics">VFOB</span>
      <span id="CWindics">CW</span>
      <span id="USBindics">USB</span>
      <span id="LSBindics">LSB</span>
      <span id="FMindics">FM</span>
      <span id="AMindics">AM</span>
    </div>

    <!-- Frequency Display -->
  <div class="frequency" id="frequencyDisplay">
    <!-- Individual spans for digits -->
    <span class="digit" id="d1">1</span>
    <span class="digit" id="d2">4</span>
    <span class="digit" id="d3">5</span>
    <span class="separator">.</span>
    <span class="digit" id="d4">4</span>
    <span class="digit" id="d5">5</span>
    <span class="digit" id="d6">0</span>
    <span class="separator">.</span>
    <span class="digit" id="d7">0</span>
    <span class="digit" id="d8">0</span>
    <span class="digit" id="d9">0</span>
  </div>
    <div class="clarifier" id="clarifier">0.00</div>
    <div class="keyboard-container">
      <!-- Left Side Buttons -->
      <button style="top: 2%; left: 1%; position: absolute;">A/B</button>
      <button style="top: 18%; left: 1%; position: absolute;">A=B</button>

      <!-- Right Side Buttons -->
      <button id="BAND UP" style="top: 2%; left: 81%; position: absolute;">Up</button>
      <button id="BAND DOWN" style="top: 18%; left: 81%; position: absolute;">Down</button>

      <!-- Bottom Button -->
      <button id="FM" style="top: 7%; left: 33%; position: absolute;">FM</button>
      <button id="USB" style="top: 24%; left: 33%; position: absolute;">USB</button>
      <button id="CW" style="top: 41%; left: 33%; position: absolute;">CW</button>
      <button id="RTTY-LSB" style="top: 58%; left: 33%; position: absolute;">RTTY-LSB</button>
      <button id="AM" style="top: 7%; left: 49%; position: absolute;">AM</button>
      <button id="LSB" style="top: 24%; left: 49%; position: absolute;">LSB</button>
      <button id="CW-R" style="top: 41%; left: 49%; position: absolute;">CW-R</button>
      <button id="RTTY-USB" style="top: 58%; left: 49%; position: absolute;">RTTY-USB</button>
            
      <button id="FM-N" style="top: 7%; left: 17%; position: absolute;">FM-N</button>
      <button id="AM-N" style="top: 7%; left: 65%; position: absolute;">AM-N</button>
            
      <button id="DATA-USB" style="top: 75%; left: 33%; position: absolute;">DATA-USB</button>
      <button id="DATA-LSB" style="top: 75%; left: 49%; position: absolute;">DATA-LSB</button>
      <button id="DATA-FM" style="top: 75%; left: 17%; position: absolute;">DATA-FM</button>
      <button id="C4FM" style="top: 75%; left: 65%; position: absolute;">C4FM</button>
      
    </div>
	</div>
    </div> 
    <script src="/frequence.js"></script>
  </div> 
  <script type="module" src="/clientB.js"></script>
</body>
</html>
""";

upload_page_html = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Upload New Page</title>
</head>
<body>
  <h1>Upload New Page to Managed Server</h1>
  <form method="POST" enctype="multipart/form-data" action="/upload">
    <input type="file" name="uploadFile">
    <input type="submit" value="Upload">
  </form>
</body>
</html>
""";
# Manager interface page for the Manager Server (server 1)
# You might include forms for file upload, file listings, etc.
manager_html = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Server Manager Interface</title>
  <link rel="stylesheet" href="/static/manager.css">
  <script src="static/script.js"></script>
  <!-- Include Chart.js from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <div id="outerContainer">
    <!-- Main Interface Container -->
    <div id="mainContainer" class="container">
      <h1>Server Manager Interface</h1>
      
      <div class="section">
        <h2>Upload Config</h2>
        <form method="POST" enctype="multipart/form-data" action="/uploadConfig">
          <input type="file" name="uploadFile">
          <input type="submit" value="Upload Config">
        </form>
      </div>
      
      <div class="section">
        <h2>Upload Data</h2>
        <form method="POST" enctype="multipart/form-data" action="/uploadData">
          <input type="file" name="uploadFile">
          <input type="submit" value="Upload Data">
        </form>
      </div>
    </div>
    
    <!-- Charts Container -->
    <div id="chartsContainer" class="container">
      <h1>ESP32 Memory Charts</h1>
      
      <div class="chart-container">
        <!-- Canvas for Heap Usage Chart -->
        <canvas class="chart-canvas" id="heapChart"></canvas>
        <!-- Canvas for SPIFFS Usage Chart -->
        <canvas class="chart-canvas" id="spiffsChart"></canvas>
        <button id="refreshCharts">Refresh Charts</button>
      </div>
      
      
    </div>
  </div>
  <footer>
    &copy; 2025 Your Company Name - Memory Statistics
  </footer>
  <script src="/static/manager.js"></script>
  <script src="/static/script.js"></script>
</body>
</html>
""";

