import { jsonfind } from './module.js';
let port;
var buff = "";
var icomm = false;
var valrusb;
let pingInterval;
let refreshInterval;
let stream = null;
let source = null;
let socket;
let jsonConfig;
let sampleRate = 8000;

let radioInfo = {};

manageWebSocket(true);

async function manageWebSocket(start) {
  console.log('manageWebSocket value:',start,socket?socket.readyState:"null");
  if(start){
    if(!socket || socket.readyState==3){
      console.log('WebSocket opening');
      socket = new WebSocket('wss://' + window.location.hostname + '/websocketA');
      setupWebSocket();
    }
  }else{
    if(socket&&socket.readyState==1){
      console.log('WebSocket closing');
      socket.close(1000, "Normal closure");
    }else if(socket&&socket.readyState==3)socket=null;
  }
}

function toBytes(commL) {
  // Caso 1: è già un array di byte (Uint8Array o array normale)
  if (Array.isArray(commL)) {
    return commL.map(comm => toBytes(comm));
  }

  // Caso 2: è una stringa esadecimale tipo "FE FE 5E E0 05 FD"
  if (typeof commL === "string") {
    return Uint8Array.from(
      commL
        .trim()
        .split("")        // split su spazi multipli
        .map(b => parseInt(b, 16))
    );
  }

  throw new Error("commL deve essere una stringa o un array di byte");
}

async function setupWebSocket() {
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
        //console.log("allincomingDatarow:",allPacketsData);
        const alldata = JSON.parse(allPacketsData);
        //console.log("allincomingData:",alldata);
        if (alldata.type === 'message') {
          const msg = document.createElement('div');
          msg.textContent = alldata.message;
          document.getElementById('chatLog').appendChild(msg);
        }if (alldata.type === 'command') {
          console.log(alldata);
          const writer = port.writable.getWriter();
          let oldvalrusb = valrusb;
          writer.write(new TextEncoder().encode(alldata.message)).then(() => {
            writer.releaseLock();
            // Check for changes in valrusb asynchronously
            const checkForUpdate = async () => {
              let rep = 0;
              while (oldvalrusb === valrusb) {
                await new Promise(resolve => setTimeout(resolve, 50)); // Wait 50ms before re-checking
                rep++;
                if(rep>20)break;
              }

              // After valrusb changes, proceed
              const pongData = {
                type: 'commandresponse',
                message: oldvalrusb === valrusb?"err":valrusb,
                data: radioInfo
              };
              console.log(valrusb,pongData);
              socket.send(JSON.stringify(pongData));
            };

            checkForUpdate();
          }).catch(error => {
            console.error("Failed to write message:", error);
          });
        } else if (alldata.type === 'pong') {
          const elapsed = Date.now() - alldata.time;
          console.log('Pong received, round-trip time: ' + elapsed + ' ms');
          const connectionDiv = document.getElementById("connection");
          connectionDiv.textContent = "online";
        } else if (alldata.type === 'update') {
          
          let commL = await generateSetCommands(radioInfo,alldata.data);
          console.log(commL);
          document.getElementById("Freq").innerHTML = JSON.stringify(radioInfo, null, 2);
          const writer = port.writable.getWriter();
          
	  let bytes = toBytes(commL);
	  const selectedRadio = getOV("Radio", 1);
	  if(!Array.isArray(commL))bytes=[bytes];
          for (const cmd of bytes) {
          writer.write(cmd).then(() => {
            writer.releaseLock();
          }).catch(error => {
            console.error("Failed to write message:", error);
          });
          await new Promise(r => setTimeout(r, 20,jsonConfig.radio[selectedRadio]["awaitms"]));
	  }
        } else if (alldata.type === 'setEvent') {
          let commL = await generateCommand(radioInfo,alldata.event,"setformat",radioInfo);
	  console.log(commL);
          // Update the innerHTML with the result
          document.getElementById("Freq").innerHTML = JSON.stringify(radioInfo, null, 2);
          const writer = port.writable.getWriter();
          writer.write(new TextEncoder().encode(commL)).then(() => {
            writer.releaseLock();
          }).catch(error => {
            console.error("Failed to write message:", error);
          });
        }
      } catch (e) {
        console.error("SMS err:", e);
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
// Send Button Functionality
document.getElementById('sendBtn').addEventListener('click', () => {
  const message = document.getElementById('chatInput').value;
  if (message) {
    const data = {
      type: 'message',
      message: message,
    };
    socket.send(JSON.stringify(data));
    document.getElementById('chatInput').value = ''; // Clear the input field
  }
});
// Ping Functionality
document.getElementById('startPingBtn').addEventListener('click', () => {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    let load = 100; // Example payload size
    if (document.getElementById("connection").textContent == "online") load = 10;
    const data = {
      type: 'ping',
      time: Date.now(),
      device: navigator.userAgent,
      payload: 'a'.repeat(load) // Example payload for testing
    };
    socket.send(JSON.stringify(data));
  }, 5000); // Ping every 5 seconds
  console.log('Ping started');
});
// Ping Functionality
    let oldinfo = {};
document.getElementById('autorefresh').addEventListener('click', async () => {

  if (refreshInterval) {clearInterval(refreshInterval);console.log('refresh started');document.getElementById('autorefresh').textContent = "start autorefresh";}else {      
    await decodeString("",{});
    const selectedRadio = getOV("Radio", 1);
    refreshInterval = setInterval( async () => {
      
      const writer = port.writable.getWriter();
	  const req = jsonConfig.radio[selectedRadio]["inforequest"];

      if(jsonConfig.radio[selectedRadio]["type"]==="text")await writer.write(new TextEncoder().encode(req));
      if(jsonConfig.radio[selectedRadio]["type"]==="binary")if (Array.isArray(req[0])) {
			// È una lista di comandi
			for (const cmd of req) {
				await writer.write(new Uint8Array(cmd));
			}
		} else {
			// È un singolo comando
			await writer.write(new Uint8Array(req));
		}
      
      writer.releaseLock();
      
      
        const data = {
          type: 'update',
          time: Date.now(),
          device: navigator.userAgent,
          data: radioInfo // Example payload for testing
        };
        
        if(JSON.stringify(radioInfo) !== JSON.stringify(oldinfo)){socket.send(JSON.stringify(data));oldinfo = radioInfo;}
      
    }, 20*jsonConfig.radio[selectedRadio]["awaitms"]); // Ping every 5 seconds
    console.log('refresh started');
    document.getElementById('autorefresh').textContent = "stop autorefresh";
  }
});

document.getElementById('stopPingBtn').addEventListener('click', () => {
  clearInterval(pingInterval);
  console.log('Ping stopped');
});

document.getElementById('startRecordingBtn').addEventListener('click', async () => {
  if (stream) return; // Prevent multiple streams

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new AudioContext({ sampleRate: sampleRate });

    // Load the AudioWorkletProcessor module
    await audioContext.audioWorklet.addModule('audio_processor.js');

    // Create AudioWorkletNode and connect it to the audio graph
    const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio_processor');
    source = audioContext.createMediaStreamSource(stream);
    source.connect(audioWorkletNode);
    let Pk = 0;
    // Send data from the AudioWorkletNode to the WebSocket
    audioWorkletNode.port.onmessage = (event) => {
      if (event.data.type === "int" && document.getElementById("connection").textContent === "online") {
        const uint8Array = new Uint8Array(event.data.data);
        //const uint8Array = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18,19,20]);
        const base64String = btoa(String.fromCharCode(...uint8Array));
        let timedel = 0;
        try{timedel=Date.now()-(base64String.length/sampleRate)*1000;}catch (err) {console.error('Error initializing audio timedel:', err);}
        const data = {
          type: 'audio',
          time: timedel,
          sampleRate: sampleRate,
          alength: base64String.length,
          audio: base64String,
          paket: Pk,
        };
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(data));
        } else {
          console.error("WebSocket is not open.");
        }
        Pk++;
      }
      
    };

    console.log('Recording started with AudioWorkletNode');
  } catch (error) {
    console.error('Error initializing audio recording:', error);
  }
});

document.getElementById('stopRecordingBtn').addEventListener('click', () => {
  if (source) {
    source.disconnect(); // Disconnect the audio graph
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop()); // Stop the microphone
    stream = null; // Clear the stream reference
  }
  console.log('Recording stopped');
});

document.getElementById('serverreset').addEventListener('click', async () => {
  if (document.getElementById("connection").textContent == "offline") {
    location.reload(true);
    return;
  }
  console.log('Trying to server reset...');
  let response = await fetch('https://' + window.location.hostname + '/reset');
  while (
    !response.ok &&
    document.getElementById("connection").textContent != "offline"
  )
    response = await fetch('https://' + window.location.hostname + '/reset');
  console.log('Server reset');
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
document.getElementById('serialWrite0').addEventListener('click', async () => {
  const writer = port.writable.getWriter();
  await decodeString("",{});
  const selectedRadio = getOV("Radio", 1);
  if(jsonConfig.radio[selectedRadio]["type"]==="text")await writer.write(new TextEncoder().encode(jsonConfig.radio[selectedRadio]["frequencerequest"]));
  if(jsonConfig.radio[selectedRadio]["type"]==="binary")await writer.write(Uint8Array.from(jsonConfig.radio[selectedRadio]["frequencerequest"]));
  writer.releaseLock();
});

function getBytes(chunk) {
    // Caso 1: stringa (uno o più caratteri)
    if (typeof chunk === "string") {
        const arr = [];
        for (let i = 0; i < chunk.length; i++) {
            arr.push(chunk.charCodeAt(i));
        }
        return arr;
    }

    // Caso 2: numero singolo
    if (typeof chunk === "number") {
        return [chunk];
    }

    // Caso 3: Uint8Array
    if (chunk instanceof Uint8Array) {
        return Array.from(chunk);
    }

    // Caso 4: ArrayBuffer
    if (chunk instanceof ArrayBuffer) {
        return Array.from(new Uint8Array(chunk));
    }

    console.warn("Tipo sconosciuto:", chunk);
    return [];
}

function endsWithAwaitend(buff, awaitend) {
    // Caso 1: awaitend è un singolo carattere
    if (typeof awaitend === "string" && awaitend.length === 1) {
        return buff.endsWith(awaitend);
    }

    // Caso 2: awaitend è una stringa lunga
    if (typeof awaitend === "string") {
        return buff.endsWith(awaitend);
    }

    // Caso 3: awaitend è un numero (byte)
    if (typeof awaitend === "number") {
        return buff.charCodeAt(buff.length - 1) === awaitend;
    }

    // Caso 4: awaitend è un array di byte
    if (Array.isArray(awaitend)) {
        if (buff.length < awaitend.length) return false;

        for (let i = 0; i < awaitend.length; i++) {
            const buffByte = buff.charCodeAt(buff.length - awaitend.length + i);
            if (buffByte !== awaitend[i]) return false;
        }
        return true;
    }

    console.warn("Tipo awaitend non gestito:", awaitend);
    return false;
}

document.getElementById('SetRadio').addEventListener('click', async () => {
port = await navigator.serial.requestPort({});
var speed = getOV("SerialSpeed",0);
var stopbits = getOV("stopBits",0);
var databits = getOV("dataBits",0);
var parity = getOV("parity",1);
console.log("baudRate:"+speed+"\nstopBits:"+stopbits+"\nparity:"+parity+"\ndataBits:"+databits);
await port.open({ baudRate: [speed] , stopBits: [stopbits] , parity: [parity] , dataBits: [databits]});
await decodeString("",{});
const selectedRadio = getOV("Radio", 1);  
const appendStream = new WritableStream({write(bytes) {
const byte = getBytes(bytes);

for (const biit of byte) {
const chunk = String.fromCharCode(biit);

  buff = buff + chunk;
  if(!icomm && jsonConfig.radio[selectedRadio]["awaitstart"] && endsWithAwaitend(buff,jsonConfig.radio[selectedRadio]["awaitstart"])){
    icomm=true;
    buff = String.fromCharCode(...jsonConfig.radio[selectedRadio]["awaitstart"]);
  }
  if(endsWithAwaitend(buff,jsonConfig.radio[selectedRadio]["awaitend"])){
    console.log("USB:"+buff);
    valrusb = buff;
    buff = "";
    icomm = false;
    
      decodeString(valrusb,radioInfo).then(async (decoded) => {
          //let tempinf = {};
          //tempinf["VFOA frequency"] = decoded["VFOA frequency"];
          //await generateSetCommands({},tempinf);
          radioInfo=decoded;
          //radioInfo["BAND"] = tempinf["BAND"];
          // Update the innerHTML with the result
          document.getElementById("Freq").innerHTML = JSON.stringify(decoded, null, 2);
          //createRequest("GT",decoded,"read").then(decoded => {console.log(decoded);});
          //createRequest("GT",decoded,"set").then(decoded => {console.log(decoded);});
        }).catch(error => {
          console.error("Error decoding string:", error);
        });
    
  }
}}});
port.readable.pipeTo(appendStream);
});
function getOV(ss,i){var e = document.getElementById(ss);var strSpd = e.options[e.selectedIndex].value;return i==0?parseInt(strSpd):strSpd;}

document.getElementById('sendcommBtn').addEventListener('click', async () => {
  const message = document.getElementById('radioInput').value; // Retrieve the input message
  const writer = port.writable.getWriter(); // Get the writable stream writer
  
  // Write the message to the serial port
  await writer.write(new TextEncoder().encode(message));
  
  // Release the lock after writing
  writer.releaseLock();
});
function normalizeRadioInfo(decoded) {
    const selectedRadio = getOV("Radio", 1);
    const info = jsonConfig.radio[selectedRadio].information;

    // Copia per evitare mutazioni indesiderate
    const result = { ...decoded };

    // 1) Applica preset per i campi mancanti
    for (const key in info) {
        if (!(key in result)) {
            const entry = info[key];
            if (entry && entry.preset !== undefined) {
                result[key] = entry.preset;
            }
        }
    }

    // 2) Applica preset per i campi dei comandi (P1, P2, P3…)
    const commands = jsonConfig.radio[selectedRadio].commands;
    for (const cmd in commands) {
        const command = commands[cmd];

        for (const p in command) {
            if (p.startsWith("P")) {
                const desc = command[p]; // es: "PC", "RADIO", "VFOA frequency"
                if (!(desc in result)) {
                    // Se esiste un preset in information, applicalo
                    if (info[desc] && info[desc].preset !== undefined) {
                        result[desc] = info[desc].preset;
                    }
                }
            }
        }
    }

    return result;
}
function decodeWithWildcard(dataString, format, commandConfig = {}) {
  const decodedResult = {};
  let currentIndex = 0;
  const totalLength = dataString.length;
  // Get the selected radio
  const selectedRadio = getOV("Radio", 1);
  // Trova se esiste un campo wildcard
  const wildcardIndex = format.findIndex(f => f.length === "...");
  const hasWildcard = wildcardIndex !== -1;
  format.forEach((entry, i) => {
    const { param, length } = entry;

    // Caso 1: campo normale a lunghezza fissa
    if (length !== "...") {
      const segment = dataString.slice(currentIndex, currentIndex + length);
      currentIndex += length;
      let desk = commandConfig?commandConfig[param]:null;
    let val = "";
    
    if(jsonConfig.radio[selectedRadio]["type"]==="binary")if (segment instanceof Uint8Array) {
    val = Array.from(segment).join(",");
} else if (typeof segment === "string") {
    // Converti ogni carattere in byte
    const arr = Array.from(segment, c => c.charCodeAt(0));
    val = arr.join(",");
} else {
    val = segment;
}
    if(jsonConfig.radio[selectedRadio]["type"]==="text")val = segment;
      decodedResult[param] = {
        value: val,
        description: desk
      };
      return;
    }

    // Caso 2: campo wildcard
    // Tutto ciò che resta, esclusi i campi dopo il wildcard
    const fieldsAfter = format.length - i - 1;

    // Calcola quanti caratteri devono essere riservati ai campi successivi
    let reservedLength = 0;
    for (let j = i + 1; j < format.length; j++) {
      reservedLength += format[j].length;
    }

    const endWildcard = totalLength - reservedLength;
    const segment = dataString.slice(currentIndex, endWildcard);
    currentIndex = endWildcard;
    let desk = commandConfig?commandConfig[param]:null;
    let val = "";
    
    if(jsonConfig.radio[selectedRadio]["type"]==="binary")if (segment instanceof Uint8Array) {
    val = Array.from(segment).join(",");
} else if (typeof segment === "string") {
    // Converti ogni carattere in byte
    const arr = Array.from(segment, c => c.charCodeAt(0));
    val = arr.join(",");
} else {
    val = segment;
}
    if(jsonConfig.radio[selectedRadio]["type"]==="text")val = segment;
    decodedResult[param] = {
      value: val,
      description: desk
    };
  });

  return decodedResult;
}
function decodeBCD5(byteString) {
    const bytes = byteString.split(",").reverse().map(n => parseInt(n));
    let result = "";
    for (const b of bytes) {
        const hi = (b >> 4) & 0x0F;
        const lo = b & 0x0F;
        result += hi.toString() + lo.toString();
    }
    return parseInt(result, 10);
}
function encodeBCD5(freq) {
    // freq deve essere un numero, es: 7039000
    let s = freq.toString().padStart(10, "0"); // 10 cifre per 5 byte BCD
    const bytes = [];

    for (let i = 0; i < 10; i += 2) {
        const hi = parseInt(s[i], 10);
        const lo = parseInt(s[i + 1], 10);
        bytes.push((hi << 4) | lo);
    }

    return bytes.reverse().join(",");
}
function validateCapturedParams(decodedResult, information) {
    for (const paramName in information) {
        const config = information[paramName];

        // Se esiste un preset, confrontalo
        if (config.preset) {
            const expected = config.preset;
            const actual = decodedResult[paramName]?.value;

            if(actual && expected!==actual)return false;
        }
    }

    return true;
}
function findMatchingFormat(inputString, format, information, commandConfig) {
    const inputLength = inputString.length;
    console.log("find f for:",inputString);
    // Normalizza: se format è singolo array → lo mette dentro un array
    const formats = Array.isArray(format[0]) ? format : [format];

    for (const fmt of formats) {
		const totalLength = fmt.reduce((sum, item) => sum + (item.length || 0), 0);
        const decodedResult=decodeWithWildcard(inputString, fmt, commandConfig);
		
	    
        console.log("format",totalLength,"/",inputLength,":",fmt,);
        console.log(decodedResult);
        if (totalLength === inputLength && validateCapturedParams(decodedResult,information)) {
            return fmt; // ritorna il format che combacia
        }
    }

    return null; // nessun format con la stessa lunghezza
}
async function decodeString(inputString, oldresult = {}, codeformat = "answer") {
  // Fetch the configuration JSON asynchronously
  if(!jsonConfig)try {
    const response = await fetch("/config.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    jsonConfig = await response.json();
  } catch (error) {
    console.error("Error fetching config.json:", error);
    return oldresult; // Return oldresult unchanged if fetch fails
  }

  // Get the selected radio
  const selectedRadio = getOV("Radio", 1);
  if (!jsonConfig.radio[selectedRadio]) {
    console.error(`Radio "${selectedRadio}" not found in configuration.`);
    return oldresult; // Return oldresult unchanged if radio is not found
  }
  if(inputString==="")return;
  // Extract the command identifier (e.g., "IF")
  let jsonr=decodeWithWildcard(inputString, jsonConfig.radio[selectedRadio]["struct"]);
  const command = jsonr.command.value;
  console.log(command);
  
  // Get the command configuration
  const commandConfig = jsonConfig.radio[selectedRadio].commands[command];
  if (!commandConfig) {
    console.error(`Command "${command}" not found for radio "${selectedRadio}".`);
    return oldresult; // Return oldresult unchanged if command is not found
  }

  // Resolve the format dynamically
  let format;

	// Resolve the format dynamically based on all cases
	if (codeformat === "answer") {
	  format = commandConfig.answerformat;
	} else if (codeformat === "set") {
	  format = commandConfig.setformat === "answerformat"
		? commandConfig.answerformat
		: (commandConfig.setformat === "readformat"
		  ? commandConfig.readformat
		  : commandConfig.setformat);
	} else if (codeformat === "read") {
	  format = commandConfig.readformat === "answerformat"
		? commandConfig.answerformat
		: (commandConfig.readformat === "setformat"
		  ? commandConfig.setformat
		  : commandConfig.readformat);
	} else {
	  console.error(`Unknown codeformat "${codeformat}"`);
	  return oldresult; // Return oldresult unchanged if codeformat is invalid
	}

	// Validate the format
	if (!format || format.length === 0) {
	  console.error(`Resolved format for "${codeformat}" is empty or undefined.`);
	  return oldresult; // Return oldresult unchanged if format is empty
	}


  // Parse and decode the input string
  
  format=findMatchingFormat(inputString, format, jsonConfig.radio[selectedRadio].information, commandConfig)
  if (!format) {
      throw new Error(`format is no founded on ${codeformat}`);
  }
  const decodedResult=decodeWithWildcard(inputString, format, commandConfig);
  console.log(decodedResult);

  // Merge decodedResult into oldresult
  let updatedResult = { ...oldresult };
  for (const key in decodedResult) {
    const paramDescription = decodedResult[key].description;
    const rawValue = decodedResult[key].value;

    // Handle decoding from "information" if it exists
    const info = jsonConfig.radio[selectedRadio].information?.[paramDescription];
    let finalValue = rawValue;
	if (info && info.decodeType === "BCD5") {
		finalValue = decodeBCD5(rawValue);
	}
    if (info) {
    let Iformat = "format";
    let Idecode = "decode";
    if(!info[Iformat])Iformat = codeformat === "set"?"setformat":codeformat === "answer"?"ansformat":"readformat";
    if(!info[Idecode])Idecode = codeformat === "set"?"setdecode":codeformat === "answer"?"ansdecode":"readdecode";
    
      // Decode value using "decode" if available
	  if (info[Idecode] && Array.isArray(info[Idecode])) {
	    const decodedValue = info[Idecode].find((_, index) => info[Iformat][index] === rawValue);
	    finalValue = decodedValue !== undefined ? decodedValue : rawValue;
	  }


      // Validate using "format" if applicable
      if (Array.isArray(info[Iformat])) {
      if (info[Idecode] && Array.isArray(info[Idecode])) {
        // Case: format is a list of acceptable values
        if (!info[Iformat].includes(rawValue)) {
          console.warn(`Value ${rawValue} is not an acceptable value for ${paramDescription}`);
        }
      } else if (info[Iformat].length === 2 && typeof info[Iformat][0] === "number" && typeof info[Iformat][1] === "number") {
        // Case: format is a range [min, max]
        const [min, max] = info[Iformat];
        const numericValue = parseInt(rawValue, 10);
        if (!isNaN(numericValue) && (numericValue < min || numericValue > max)) {
        console.warn(`Value ${numericValue} out of range for ${paramDescription}`);
        }
        } else {
          console.warn(`Unexpected format structure for ${paramDescription}`);
        }
      }
    }

    // Update the oldresult with the decoded value
    updatedResult[paramDescription] = finalValue;
  }
  updatedResult = normalizeRadioInfo(updatedResult);
  return updatedResult; // Return the updated result
}


async function createRequest(inputString, oldresult = {}, codeType = "read") {
  let codeTypeformat = codeType=="read"?"readreqsimp":(codeType=="set"?"setreqsimp":(codeType=="answer"?"answersimp":"NULL"));
  if(codeTypeformat=="NULL") {
    console.error(`codeType "${codeType}" errated.`);
    return ""; // Return an empty string if command is not found
  }
  // Fetch the configuration JSON asynchronously
  if(!jsonConfig)try {
    const response = await fetch("/config.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    jsonConfig = await response.json();
  } catch (error) {
    console.error("Error fetching config.json:", error);
    return ""; // Return an empty string if fetch fails
  }

  // Extract the command identifier (e.g., "IF")
  const command = inputString.trim(); // Input is just "IF"
  const selectedRadio = getOV("Radio", 1);

  // Ensure the radio and command are valid
  if (!jsonConfig.radio[selectedRadio]) {
    console.error(`Radio "${selectedRadio}" not found in configuration.`);
    return ""; // Return an empty string if radio is not found
  }

  const commandConfig = jsonConfig.radio[selectedRadio].commands[command];
  if (!commandConfig) {
    console.error(`Command "${command}" not found for radio "${selectedRadio}".`);
    return ""; // Return an empty string if command is not found
  }

  // Get the example format (readreqsimp or setreqsimp)
  const exampleFormat = commandConfig[codeTypeformat];
  if (!exampleFormat) {
    console.error(`Code type "${codeType}" not found for command "${command}".`);
    return ""; // Return an empty string if code type is not defined
  }

  // Decode the example format into a JSON structure
  const jsonExample = await decodeString(exampleFormat, {}, codeType);

  // Map human-readable descriptions in oldresult to parameter keys (e.g., "P1", "P2")
  const paramMapping = {};
  for (const key in commandConfig) {
    if (key.startsWith("P") && commandConfig[key]) {
      paramMapping[commandConfig[key]] = key; // Map "Memory channel" -> "P1"
    }
  }

  // Populate the JSON example with values from oldresult
  for (const description in oldresult) {
    const param = paramMapping[description]; // Get the parameter key (e.g., "P1")
    if (param) {
      jsonExample[param] = oldresult[description]; // Replace placeholder with actual data
    }
  }

  // Generate the final request string
  let resultString = command; // Start with the command (e.g., "IF")
  const format = codeTypeformat === "readreqsimp"
    ? commandConfig.readformat
    : (codeTypeformat === "setreqsimp" ? commandConfig.setformat : commandConfig.answerformat);

  let currentIndex = 2;
  format.forEach(entry => {
    const { param, length } = entry;
    const value = jsonExample[param] || "0".repeat(length); // Use placeholder if undefined
	resultString += value.padEnd(length, "0"); // Ensure the length matches
    currentIndex += length;
  });

  return resultString + jsonConfig.radio[selectedRadio]["awaitend"]; // Append the semicolon to finalize the request
}
function capturecommand(key,formatReference,command,information){
	if (!Array.isArray(formatReference))return null;
	if(Array.isArray(formatReference[0])){formatReference.forEach(format => capturecommand(key,format,command));return null;}
	let allParamsExist = true;

    // Map the P list to actual keys (e.g., P1 -> VFOA frequency)
    const resolvedKeys = formatReference.map(entry => command[entry.param]); // Resolve keys like P1 -> VFOA frequency

    // Check if the current key is in the resolved keys
    if (!resolvedKeys.includes(key)) {
        return; // Skip this command if the key isn't in the resolved keys
    }

    // If all conditions are satisfied, assign the command
    if (allParamsExist) {
		return {"commandKey":key,"setFormat":formatReference};
    }
}
async function generateSetCommands(oldresult, newresult) {
  // Fetch the configuration JSON asynchronously
  if(!jsonConfig)try {
    const response = await fetch("/config.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    jsonConfig = await response.json();
  } catch (error) {
    console.error("Error fetching config.json:", error);
    return ""; // Return an empty string if fetch fails
  }

  const selectedRadio = getOV("Radio", 1);

  // Ensure the radio exists in the configuration
  if (!jsonConfig.radio[selectedRadio]) {
    console.error(`Radio "${selectedRadio}" not found in configuration.`);
    return ""; // Return an empty string if radio is not found
  }

  const commandsConfig = jsonConfig.radio[selectedRadio].commands;
  const information = jsonConfig.radio[selectedRadio].information;

  // Initialize an empty array to hold the generated commands
  let commandList = [];

  // Loop through the keys in newresult to find differences
  for (const key in newresult) {
    if (newresult[key] !== oldresult[key]) {
      const newValue = newresult[key];
      const oldValue = oldresult[key];

      // Search for a command that can handle this parameter
      let commandKey = null;
      let setFormat = null;

      for (const cmd in commandsConfig) {
        const command = commandsConfig[cmd];

        // Skip invalid commands (setformat is [] and setreqsimp is "")
        if (Array.isArray(command.setformat) && command.setformat.length === 0 && command.setreqsimp === "") {
          continue; // Skip this command
        }

        // Ensure the parameter exists in the command's setformat
        const formatReference = Array.isArray(command.setformat)
          ? command.setformat // Already an array
          : commandsConfig[cmd][command.setformat]; // Resolve string reference

        // Check if the key exists in the parameters and ensure all required params exist
        const cmdk = capturecommand(key, formatReference, command, information);

		//if (cmdk?.commandKey) commandKey = cmdk.commandKey;
		if (cmdk)commandKey=cmd;
		if (cmdk?.setFormat) setFormat = cmdk.setFormat;
        
      }

      await generateCommand(oldresult,commandKey, setFormat,newresult, commandList, jsonConfig,key);
    }
  }

  // Join the commands into a single string separated by semicolons
  return commandList.join("");
}

async function generateCommand(oldresult,ScommandKey, typeFormat,newresult={}, commandList = [], jsonConfig = {},key = "") {
  if(key==="")key=ScommandKey;
  if(Object.keys(jsonConfig).length === 0)try {
    
    const response = await fetch("/config.json");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    jsonConfig = await response.json();
  } catch (error) {
    console.error("Error fetching config.json:", error);
    return ""; // Return an empty string if fetch fails
  }

  const selectedRadio = getOV("Radio", 1);

  // Ensure the radio exists in the configuration
  if (!jsonConfig.radio[selectedRadio]) {
    console.error(`Radio "${selectedRadio}" not found in configuration.`);
    return ""; // Return an empty string if radio is not found
  }

  const commandsConfig = jsonConfig.radio[selectedRadio].commands;
  const information = jsonConfig.radio[selectedRadio].information;
  const commandlist = jsonConfig.radio[selectedRadio].commandlist;
	let setFormat;
  
  let commandKey=!commandsConfig[ScommandKey]?commandlist[ScommandKey]:ScommandKey;
  console.log("Sc:",ScommandKey," ck:",commandKey," tf:",typeFormat);
  if(commandKey)setFormat=Array.isArray(typeFormat)?typeFormat:commandsConfig[commandKey][typeFormat];
        console.log("comm:",commandKey);console.log("set:",setFormat);
        console.log("conf:",commandsConfig);console.log("list:",commandlist);
	if (commandKey && setFormat) {
        // Build the command using the setformat
        let command = commandsConfig[commandKey];
        let commandString = "";//commandKey;

        for (const { param, length } of setFormat) {
        	// Resolve the human-readable key (e.g., P1 -> VFOA frequency)
          const resolvedKey = command[param];
          //console.log("information:",information);console.log("resolvedKey:",resolvedKey);
          // Get the value from oldresult or newresult
          let value = newresult[resolvedKey] || oldresult[resolvedKey] || "";
          // Encoding custom

          // Check if the value needs validation/decoding
          if (information && information[resolvedKey]) {
          let Iformat = "format";
          let Idecode = "decode";

	  if (information[resolvedKey].encodeType) {
		const enc = information[resolvedKey].encodeType;

		if (enc === "BCD5") {
			value = encodeBCD5(parseInt(value, 10));
		}
	  }else{

          let typeF = Array.isArray(typeFormat)?"setformat":typeFormat;
          if(!information[resolvedKey][Iformat])Iformat = typeF === "setformat"?"setformat":typeF === "answerformat"?"ansformat":"readformat";
          if(!information[resolvedKey][Idecode])Idecode = typeF === "setformat"?"setdecode":typeF === "answerformat"?"ansdecode":"readdecode";
          const format = information[resolvedKey][Iformat];
          const decode = information[resolvedKey][Idecode];
          
          //console.log("format:",format);console.log("decode:",decode);
          if(format==="command")value=commandKey;
          if (decode && Array.isArray(decode)) {
            // Map value using decode array
            const decodedIndex = decode.indexOf(value);
            if (decodedIndex !== -1 && Array.isArray(format)) {
            value = format[decodedIndex]; // Map decode to format value
            }
          }

          // Validate ranges (if format is a range like [min, max])
          if (Array.isArray(format) && format.length === 2 && typeof format[0] === "number" && typeof format[1] === "number") {
            const numericValue = parseInt(value, 10);
            if (numericValue < format[0] || numericValue > format[1]) {
            console.warn(`Value ${numericValue} is out of range for parameter "${resolvedKey}".`);
            continue; // Skip this parameter if the value is invalid
            }
          }
          }
          }
          let ndec = value;
          // Pad the value to match the required length
	  if(jsonConfig.radio[selectedRadio]["type"]==="text")value=value.toString().padStart(length, "0")
	  if(jsonConfig.radio[selectedRadio]["type"]==="binary"){const bytes = value.split(",").map(n => parseInt(n, 10));
	  value = String.fromCharCode(...bytes);}

          console.log("for:",resolvedKey,"param:",param," value:",value," no decode:",ndec);

          commandString += value;
        }

        if(command.beforeset)commandList.push(await generateCommandsupport(oldresult,command.beforeset,newresult,[],jsonConfig));
        
        commandList.push(commandString); // Append the command with a semicolon
        if(command.ausiliar)await setausiliar(oldresult,command.ausiliar,newresult);
      } else {
        console.warn(`No valid set command found for parameter "${key}".`);
      }
        const split = jsonConfig.radio[selectedRadio]["splitcmd"];
	if(split && split==1)return commandList;
	if(!split || split==0)return commandList.join("");
}
async function setausiliar(oldresult,ausiliar,newresult={}) {
	for(const {action,Nlist,list,incision} of ausiliar){
		if(action === "+" || action === "-"){
      if(incision === "old" && oldresult[Nlist]){oldresult[Nlist] = list[list.indexOf(oldresult[Nlist])+(action === "+"?1:-1)];newresult[Nlist] = oldresult[Nlist];}
      if(incision === "new" && newresult[Nlist]){newresult[Nlist] = list[list.indexOf(newresult[Nlist])+(action === "+"?1:-1)];oldresult[Nlist] = newresult[Nlist];}
      if(incision === "bot" && oldresult[Nlist]){oldresult[Nlist] = list[list.indexOf(oldresult[Nlist])+(action === "+"?1:-1)];}
      if(incision === "bot" && newresult[Nlist]){newresult[Nlist] = list[list.indexOf(newresult[Nlist])+(action === "+"?1:-1)];}
		}
	}
}
async function generateCommandsupport(oldresult,ScommandKey,newresult={}, commandList = [], jsonConfig = {}) {
	if(Object.keys(jsonConfig).length === 0)try {
		const response = await fetch("/config.json");
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		jsonConfig = await response.json();
	} catch (error) {
		console.error("Error fetching config.json:", error);
		return ""; // Return an empty string if fetch fails
	}

	const selectedRadio = getOV("Radio", 1);

	// Ensure the radio exists in the configuration
	if (!jsonConfig.radio[selectedRadio]) {
		console.error(`Radio "${selectedRadio}" not found in configuration.`);
		return ""; // Return an empty string if radio is not found
	}
	const commandsConfig = jsonConfig.radio[selectedRadio].commands;
	const information = jsonConfig.radio[selectedRadio].information;
	const commandlist = jsonConfig.radio[selectedRadio].commandlist;
	const thiscommandsConfig = commandsConfig[ScommandKey];
	if(!thiscommandsConfig){console.error(`support configuration ${ScommandKey} not found.`);return "";}
	let resolvedKeys = thiscommandsConfig.request.map(entry => ({
    result: entry.result,
    condition: thiscommandsConfig[entry.Presult]
  }));
	for(const {condition,range,result} of thiscommandsConfig.request){
		
		let isrange = (Array.isArray(range) && range.length === 2 && typeof range[0] === "number" && typeof range[1] === "number");
		
		let Vcondit = newresult[condition] || oldresult[condition];
		if(isrange){
			if (Vcondit < range[0] || Vcondit > range[1]) {
				resolvedKeys = resolvedKeys.filter(item => item.result !== result);
            }
		}else{
			if(!range.includes(Vcondit))resolvedKeys = resolvedKeys.filter(item => item.result !== result);
		}
	}
	let newResolvedKeys = [];
	for (const elem of resolvedKeys) {
	  if (
		newresult[elem.condition] !== elem.result &&
		oldresult[elem.condition] !== elem.result
	  ) {
		newResolvedKeys.push(elem); // Keep elements that don't meet the condition
	  }else return "";
	}
  resolvedKeys = newResolvedKeys; // Update the array after iteration
	for (const elem of resolvedKeys)newresult[elem.condition]=elem.result;
  for (const elem of resolvedKeys)oldresult[elem.condition]=elem.result;
  return await generateCommand(oldresult,ScommandKey, "setformat",newresult, commandList, jsonConfig);
}


  document.addEventListener("DOMContentLoaded", () => {
    const advancedBtn = document.getElementById("advancedBtn");
    const advancedSettings = document.getElementById("advancedSettings");

    advancedBtn.addEventListener("click", () => {
      if (advancedSettings.style.display === "none" || advancedSettings.style.display === "") {
        advancedSettings.style.display = "block";
        advancedBtn.textContent = "Hide Advanced Settings";
      } else {
        advancedSettings.style.display = "none";
        advancedBtn.textContent = "Show Advanced Settings";
      }
    });
  });
    document.addEventListener("DOMContentLoaded", () => {
    // Fetch JSON configuration
    fetch("/config.json")
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(jsonData => {
        // Select elements from the DOM
        const radioSelect = document.getElementById("Radio");
        const serialSpeedSelect = document.getElementById("SerialSpeed");
        const stopBitsSelect = document.getElementById("stopBits");
        const paritySelect = document.getElementById("parity");
        const dataBitsSelect = document.getElementById("dataBits");

        // Populate the Radio dropdown
        jsonData.Radio.forEach(radio => {
          const opt = document.createElement("option");
          opt.value = radio;
          opt.textContent = radio;
          radioSelect.appendChild(opt);
        });

        // Set initial Radio value
        radioSelect.value = jsonData.Radio[0]; // Default to the first Radio option

        // Function to update dependent dropdowns
        const updateDependentDropdowns = (selectedRadio) => {
          const settings = jsonData.radio[selectedRadio];
          if (settings) {
            const populateDropdown = (selectElement, options, initialValue) => {
              selectElement.innerHTML = ""; // Clear existing options
              options.forEach(option => {
                const opt = document.createElement("option");
                opt.value = option;
                opt.textContent = option;
                selectElement.appendChild(opt);
              });
              selectElement.value = initialValue; // Set initial value
            };

            // Populate dependent dropdowns with corresponding settings
            populateDropdown(serialSpeedSelect, jsonData.SerialSpeed, settings.SerialSpeed);
            populateDropdown(stopBitsSelect, jsonData.stopBits, settings.stopBits);
            populateDropdown(paritySelect, jsonData.parity, settings.parity);
            populateDropdown(dataBitsSelect, jsonData.dataBits, settings.dataBits);
          }
        };

        // Initial population of dependent dropdowns based on the default Radio
        updateDependentDropdowns(radioSelect.value);

        // Update dropdowns when Radio selection changes
        radioSelect.addEventListener("change", () => {
          updateDependentDropdowns(radioSelect.value);
        });
      })
      .catch(error => {
        console.error("Error fetching config.json:", error);
      });
  });