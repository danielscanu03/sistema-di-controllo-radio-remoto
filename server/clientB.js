  import { jsonfind } from './module.js';
  let SampleRate = 8000;
  let audioContext = new AudioContext({ sampleRate: SampleRate });
  let socket;
  let radioInfo;

  let audioQueue = []; // Queue for incoming audio data
  let isPlaying = false; // Flag to track if audio is currently playing

  manageWebSocket(true);
  async function manageWebSocket(start) {

    if(start){
      if(!socket || socket.readyState==3){
        console.log('WebSocket opening');
        socket = new WebSocket('wss://' + window.location.hostname + '/websocketB');
        setupWebSocket();
      }
    }else{
      if(socket&&socket.readyState==1){
        console.log('WebSocket closing');
        socket.close(1000, "Normal closure");
      }else if(socket&&socket.readyState==3)socket=null;
    }
  }
  function playAudioFromQueue() {
    // Stop if the queue is empty
    if (audioQueue.length === 0) {
        isPlaying = false;
        return;
    }

    isPlaying = true;
    const audioBuffer = audioQueue.shift(); // Get the next audio buffer

    try {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start();

        source.onended = () => {
            source.disconnect(); // Clean up resources
            playAudioFromQueue(); // Continue with the next buffer
        };
    } catch (E) {
        console.error("Audio playback error:", E);
        isPlaying = false; // Reset playback flag
    }
  }
  function setupWebSocket(){
  socket.onopen = () => {
    console.log('WebSocket connected');
  };

let incomingData = JSON.parse("{\"Nconn\":0}");

  socket.onmessage = async (event) => {
    const data = JSON.parse(event.data);            // Parse the incoming JSON
    const key = jsonfind(incomingData, data.from);  // Use jsonfind to generate or locate the key
    //console.log("Assigned key:", jsonfind(incomingData, data.from));
    if (!incomingData[key]) {
      // Initialize the structure if this is the first packet from this source
      incomingData[key] = { completed: false, paks: 0, from: data.from };
    }

    if (data.data === "end") {
      incomingData[key].paks = data.pack;

      // Simplified check for all packets
      const allPacketsReceived = Array.from({ length: incomingData[key].paks })
                                  .every((_, i) => incomingData[key][`paket${i}`]);

      if (allPacketsReceived) {
        incomingData[key].completed = true;
      }

      //console.log(`End received from ${data.from}: Updated total packets to ${data.pack}. Completion status: ${incomingData[key].completed}.`);
    } else {
      incomingData[key][`paket${data.pack}`] = data.data;

      if (incomingData[key].paks > 0) {
        const allPacketsReceived = Array.from({ length: incomingData[key].paks })
                                    .every((_, i) => incomingData[key][`paket${i}`]);

        if (allPacketsReceived) {
          incomingData[key].completed = true;
        }
      }

      //console.log(`Packet${data.pack} received from ${data.from}: ${data.data}`);
    }

    //console.log("Updated incomingData:", incomingData);
    if (incomingData[key].completed) {
      try {
        const allPacketsData = Array.from({ length: incomingData[key].paks }).map((_, i) => incomingData[key][`paket${i}`]).filter(data => data).join("");
        console.log("allincomingDatarow:",incomingData[key]);
        const alldata = JSON.parse(allPacketsData);
        //console.log("allincomingData:",alldata);
        if (alldata.type === 'message') {
          const msg = document.createElement('div');
          msg.textContent = alldata.message;
          document.getElementById('chatLog').appendChild(msg);
        }else if (alldata.type === 'commandresponse') {
          console.log(alldata);
        }else if (alldata.type === 'update') {
          console.log(alldata);
          radioInfo=alldata.data;
          document.getElementById("radioLog").style.display = "block";
          document.getElementById("radioLog").innerHTML = JSON.stringify(radioInfo, null, 2);
          let VFOAindics = document.getElementById("VFOAindics");
          let VFOBindics = document.getElementById("VFOBindics");
          let FMindics = document.getElementById("FMindics");
          let AMindics = document.getElementById("AMindics");
          let USBindics = document.getElementById("USBindics");
          let LSBindics = document.getElementById("LSBindics");
          let CWindics = document.getElementById("CWindics");
          if(radioInfo["BAND TX"] && radioInfo["BAND TX"] === "VFOA"){VFOAindics.innerHTML = "VFOA TX/RX";VFOAindics.style.color="#0f0";VFOBindics.style.color="#555";}
          if(radioInfo["BAND TX"] && radioInfo["BAND TX"] === "VFOB"){VFOAindics.innerHTML = "VFOA RX";VFOBindics.innerHTML = "VFOB TX";VFOAindics.style.color="#0f0";VFOBindics.style.color="#0f0";}
          
          
          FMindics.innerHTML="FM";FMindics.style.color="#555";
          AMindics.innerHTML="AM";AMindics.style.color="#555";
          USBindics.innerHTML="USB";USBindics.style.color="#555";
          LSBindics.innerHTML="LSB";LSBindics.style.color="#555";
          CWindics.innerHTML="CW";CWindics.style.color="#555";
          

          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "FM"){FMindics.style.color="#0f0";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "AM"){AMindics.style.color="#0f0";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "USB"){USBindics.style.color="#0f0";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "LSB"){LSBindics.style.color="#0f0";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "CW"){CWindics.style.color="#0f0";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "RTTY-LSB"){LSBindics.style.color="#0f0";LSBindics.innerHTML = "RTTY-LSB";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "CW-R"){CWindics.style.color="#0f0";CWindics.innerHTML = "CW-R";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "DATA-LSB"){LSBindics.style.color="#0f0";LSBindics.innerHTML = "DATA-LSB";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "RTTY-USB"){USBindics.style.color="#0f0";USBindics.innerHTML = "RTTY-USB";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "DATA-FM"){FMindics.style.color="#0f0";FMindics.innerHTML = "DATA-FM";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "FM-N"){FMindics.style.color="#0f0";FMindics.innerHTML = "FM-N";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "DATA-USB"){USBindics.style.color="#0f0";USBindics.innerHTML = "DATA-USB";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "AM-N"){AMindics.style.color="#0f0";AMindics.innerHTML = "AM-N";}
          if(radioInfo["VFOA MODE"] && radioInfo["VFOA MODE"] === "C4FM"){CWindics.style.color="#0f0";CWindics.innerHTML = "RTTY-LSB";}
          

          if(document.getElementById("radioinfo")){
            document.getElementById("radioinfo").value = JSON.stringify(radioInfo, null, 2);
            const event = new Event("valueChanged"); // Create a custom event
            document.getElementById("radioinfo").dispatchEvent(event); // Dispatch the event
          }
        } else if (alldata.type === 'ping') {
          // Respond with a pong message
          const pongData = {
            type: 'pong',
            time: alldata.time,
            device: navigator.userAgent,
            payload: alldata.payload
          };
          socket.send(JSON.stringify(pongData));
          const connectionDiv = document.getElementById("connection");
          connectionDiv.textContent = "online";
        } else if (alldata.type === 'audio') {
          if (alldata.hasOwnProperty("paket")) {
              if(alldata.time)document.getElementById('chatLog').innerText = alldata.paket + "  ping:" + (Date.now()-alldata.time) + "ms";
              else document.getElementById('chatLog').innerText = alldata.paket;
              if(alldata.sampleRate)SampleRate=alldata.sampleRate;
          }

          // Decode Base64 audio data into Float32Array
          const uint8Array = new Uint8Array(atob(alldata.audio).split("").map((char) => char.charCodeAt(0)));
          const float32Array = new Float32Array(uint8Array.length);
          for (let i = 0; i < uint8Array.length; i++) {
              float32Array[i] = (uint8Array[i] - 128) / 128; // Map 0-255 to -1.0 to 1.0
          }
          

          if (!audioContext || audioContext.state === "closed") {
              audioContext = new AudioContext({ sampleRate: SampleRate });
          }
          const audioBuffer = audioContext.createBuffer(1, float32Array.length, audioContext.sampleRate);
          
          if(audioContext.state === "suspended"){
            const button = document.getElementById('BTvanish');
            button.style.display = 'flex';
            button.addEventListener('click', async () => {
                // Hide the button when clicked
                button.style.display = 'none';
                try {
                    await audioContext.resume();
                    console.log("AudioContext resumed successfully.");
                } catch (error) {
                    console.error("Error resuming AudioContext:", error);
                }
            });
            throw Error("audioContext suspend");
          }

          // Create and store the AudioBuffer in the queue
          audioBuffer.copyToChannel(float32Array, 0);
          audioQueue.push(audioBuffer); // Add audio buffer to the queue

          // If not already playing, start playback
          if (!isPlaying) {
              playAudioFromQueue();
          }
        }
      } catch (e) {
        console.error("message error: ",e);
        // Incomplete JSON, keep accumulating data
      }
      delete incomingData[key];
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.onclose = (event) => {
    console.log('WebSocket closed:', event);
    const connectionDiv = document.getElementById("connection");
    connectionDiv.textContent = "offline";
    manageWebSocket(true);
  };
  }
  document.getElementById('sendBtn').addEventListener('click', () => {
    const message = document.getElementById('chatInput').value;
    if (message) {
      const data = {
        type: 'message',
        message: message
      };
      socket.send(JSON.stringify(data));
      document.getElementById('chatInput').value = '';
    }
  });
  document.getElementById('serverreset').addEventListener('click', async () => {
    if(document.getElementById("connection").textContent!="offline"){
    console.log('trying to server reset....');
    let response = await fetch('https://' + window.location.hostname + '/reset');
    while(!response.ok&&(document.getElementById("connection").textContent!="offline"))response = await fetch('https://' + window.location.hostname + '/reset');
    }
    console.log('server reset');
    location.reload(true);
  });
if(document.getElementById('serverping'))document.getElementById('serverping').addEventListener('valueChanged', () => {
  const serverpingElement = document.getElementById('serverping');
  console.log('serverping value:',JSON.parse(serverpingElement.value)[1]);
  if(JSON.parse(serverpingElement.value)[1]=="false"){
    manageWebSocket(false);
  }else if(JSON.parse(serverpingElement.value)[1]=="true"){
    manageWebSocket(true);
  }
});
document.getElementById('sendcommBtn').addEventListener('click', async () => {
  const message = document.getElementById('radioInput').value; // Retrieve the input message
    if (message) {
      const data = {
        type: 'command',
        message: message
      };
      socket.send(JSON.stringify(data));
      document.getElementById('radioInput').value = '';
    }
});
if(document.getElementById('radioinfo'))document.getElementById('radioinfo').addEventListener('valueChanged', () => {
  const serverpingElement = document.getElementById('radioinfo');
  let jsri = JSON.parse(serverpingElement.value);
  
  if(JSON.stringify(radioInfo) !== JSON.stringify(jsri)){
    const data = {
        type: 'update',
        time: Date.now(),
        device: navigator.userAgent,
        data: jsri
      };
      socket.send(JSON.stringify(data));
  }


});
document.getElementById('BANDUP').addEventListener('click', () => {
  const serverpingElement = document.getElementById('radioinfo');
  let jsri = JSON.parse(serverpingElement.value);
  
  const data = {
    type: 'setEvent',
    event: 'BAND UP',
  };
  socket.send(JSON.stringify(data));
});
["LSB", "USB", "CW", "FM", "AM", "RTTY-LSB", "CW-R", "DATA-LSB", "RTTY-USB", "DATA-FM", "FM-N", "DATA-USB", "AM-N", "C4FM"].forEach(function(item) {
  if(document.getElementById(item))document.getElementById(item).addEventListener('click', () => {
    const serverpingElement = document.getElementById('radioinfo');
    let jsri = JSON.parse(serverpingElement.value);
    jsri["VFOA MODE"] = item;
    const data = {
      type: 'update',
      time: Date.now(),
      device: navigator.userAgent,
      data: jsri,
    };
    socket.send(JSON.stringify(data));
  });
});

document.getElementById('BANDDOWN').addEventListener('click', () => {
  const serverpingElement = document.getElementById('radioinfo');
  let jsri = JSON.parse(serverpingElement.value);
  
  const data = {
    type: 'setEvent',
    event: 'BAND DOWN',
  };
  socket.send(JSON.stringify(data));
});
document.addEventListener("DOMContentLoaded", () => {
    const advancedBtn = document.getElementById("advancedBtn");
    const advancedBtn2 = document.getElementById("advancedBtn2");
    const advancedSettings = document.getElementById("advancedSettings");
    const advancedSettings2 = document.getElementById("advancedSettings2");

    advancedBtn.addEventListener("click", () => {
      if (advancedSettings.style.display === "block"){
        advancedSettings2.style.display = "block";
        advancedSettings.style.display = "none";
        advancedBtn2.textContent = "Hide Advanced Settings";
      }
    });
    advancedBtn2.addEventListener("click", () => {
      if (advancedSettings.style.display === "none" || advancedSettings.style.display === "") {
        advancedSettings2.style.display = "none";
        advancedSettings.style.display = "block";
        advancedBtn.textContent = "Show Advanced Settings";
      }
    });
  });