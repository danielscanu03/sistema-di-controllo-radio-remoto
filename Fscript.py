websocket_script_js = """
  import { updateElement,fetchWithTimeout } from './module.js';
  const serverResetElement = document.getElementById('serverreset');
  const serverpingElement = document.getElementById('serverping');
  let pingServer;
  if(serverResetElement)serverResetElement.addEventListener('click', async () => {
    if(document.getElementById("connection").textContent=="offline"){location.reload(true);return;}
    console.log('trying to server reset....');
    let response = await fetch('https://' + window.location.hostname + '/reset');
    while(!response.ok&&(document.getElementById("connection").textContent!="offline"))response = await fetch('https://' + window.location.hostname + '/reset');
    console.log('server reset');
  });
  if(serverpingElement&&JSON.parse(serverpingElement.value)[0]!="true"||!serverpingElement){
    if(serverpingElement)updateElement(serverpingElement,"true",0);
    pingServer = () => {
      
      fetchWithTimeout('/ping',5000)
        .then(response => response.text())
        .then(data => {
          console.log('Server ping:', data);
          if(serverpingElement)updateElement(serverpingElement,"true",1);
        })
        .catch(error => {
          if(serverpingElement)updateElement(serverpingElement,"false",1);
        });
    };
    setInterval(pingServer, 5000); // Ping the server every 5 seconds
  }
""";

module_js = """
  function updateElement(Element,newValue,i) {
    if (arguments.length === 3) {
      if(!Element)return;
      const valueArray = JSON.parse(Element.value);
      valueArray[i] = newValue;
      updateElement(Element,JSON.stringify(valueArray));
    }else if (arguments.length === 2) {
      if(!Element)return;
      Element.value = newValue;
      const event = new Event("valueChanged"); // Create a custom event
      Element.dispatchEvent(event); // Dispatch the event
    }
  }
  function fetchWithTimeout(url, timeout) {
    const controller = new AbortController(); // Create an AbortController
    const signal = controller.signal;
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {controller.abort();reject(new Error('Request timed out'));}, timeout);
    });
    return Promise.race([fetch(url, { signal }), timeoutPromise]);
  }
  function jsonfind(data, from) {
    let key = null;
    for (let i = 0; i < data.Nconn; i++) {
      if (data[`from${i}`] !== undefined){
      if (data[`from${i}`].from === from) {
        key = `from${i}`;
        break;
      } else if (data[`from${i}`].from === undefined && key === null) {
        key = `from${i}`;
      }} else {
        key = `from${i}`;
      }
    }
    if (key === null) {
      key = `from${data.Nconn}`;
      data.Nconn++; // Increment connection counter for new key
    }
    return key; // Return the key associated with the 'from' value
  }
  export { updateElement,fetchWithTimeout,jsonfind };
""";
# import { myFunction } from './script1.js';

clientA_js = """
import { jsonfind } from './module.js';
let port;
var buff = "";
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
              console.log(pongData);
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
          writer.write(new TextEncoder().encode(commL)).then(() => {
            writer.releaseLock();
          }).catch(error => {
            console.error("Failed to write message:", error);
          });
        } else if (alldata.type === 'setEvent') {
          let commL = await generateCommand(radioInfo,alldata.event,"setformat",radioInfo);
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
    refreshInterval = setInterval( async () => {
      
      const writer = port.writable.getWriter();
      
      await writer.write(new TextEncoder().encode("IF;OI;FT;RM0;SC;"));
      
      writer.releaseLock();
      
      
        const data = {
          type: 'update',
          time: Date.now(),
          device: navigator.userAgent,
          data: radioInfo // Example payload for testing
        };
        
        if(JSON.stringify(radioInfo) !== JSON.stringify(oldinfo)){socket.send(JSON.stringify(data));oldinfo = radioInfo;}
      
    }, 500); // Ping every 5 seconds
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
  await writer.write(new TextEncoder().encode("IF;"));
  writer.releaseLock();
});
document.getElementById('SetRadio').addEventListener('click', async () => {
port = await navigator.serial.requestPort({});
var speed = getOV("SerialSpeed",0);
var stopbits = getOV("stopBits",0);
var databits = getOV("dataBits",0);
var parity = getOV("parity",1);
console.log("baudRate:"+speed+"\nstopBits:"+stopbits+"\nparity:"+parity+"\ndataBits:"+databits);
await port.open({ baudRate: [speed] , stopBits: [stopbits] , parity: [parity] , dataBits: [databits]});  
const appendStream = new WritableStream({write(chunk) {
  buff = buff + chunk;
  if(chunk==";"){
    //console.log("USB:"+buff);
    valrusb = buff;
    buff = "";
    
      decodeString(valrusb,radioInfo).then(async (decoded) => {
          let tempinf = {};
          tempinf["VFOA frequency"] = decoded["VFOA frequency"];
          await generateSetCommands({},tempinf);
          radioInfo=decoded;
          radioInfo["BAND"] = tempinf["BAND"];
          // Update the innerHTML with the result
          document.getElementById("Freq").innerHTML = JSON.stringify(decoded, null, 2);
          //createRequest("GT",decoded,"read").then(decoded => {console.log(decoded);});
          //createRequest("GT",decoded,"set").then(decoded => {console.log(decoded);});
        }).catch(error => {
          console.error("Error decoding string:", error);
        });
    
  }
}});
port.readable.pipeThrough(new TextDecoderStream()).pipeTo(appendStream);
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


async function decodeString(inputString, oldresult = {}, codeformat = "answer") {
  // Extract the command identifier (e.g., "IF")
  const command = inputString.slice(0, 2);

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


  const dataString = inputString.slice(2, -1); // Remove command and semicolon
  const decodedResult = {};
  let currentIndex = 0;

  // Parse and decode the input string
  format.forEach(entry => {
    const { param, length } = entry;
    const segment = dataString.slice(currentIndex, currentIndex + length);
    currentIndex += length;
    decodedResult[param] = {
      value: segment,
      description: commandConfig[param]
    };
  });

  // Merge decodedResult into oldresult
  const updatedResult = { ...oldresult };
  for (const key in decodedResult) {
    const paramDescription = decodedResult[key].description;
    const rawValue = decodedResult[key].value;

    // Handle decoding from "information" if it exists
    const info = jsonConfig.radio[selectedRadio].information?.[paramDescription];
    let finalValue = rawValue;
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

  return resultString + ";"; // Append the semicolon to finalize the request
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
        if (Array.isArray(formatReference)) {
          let allParamsExist = true;

          // Map the P list to actual keys (e.g., P1 -> VFOA frequency)
          const resolvedKeys = formatReference.map(entry => command[entry.param]); // Resolve keys like P1 -> VFOA frequency

          // Check if the current key is in the resolved keys
          if (!resolvedKeys.includes(key)) {
          continue; // Skip this command if the key isn't in the resolved keys
          }

          // Ensure all required keys exist in oldresult or newresult
          for (const param of resolvedKeys) {
          if (!(param in { ...oldresult, ...newresult })) if(information[param] && information[param].preset){
            oldresult[param] = information[param].preset;
            newresult[param] = information[param].preset;
          }else{
            allParamsExist = false; // One required key is missing
            break; // Exit early
          }
          }

          // If all conditions are satisfied, assign the command
          if (allParamsExist) {
          commandKey = cmd; // Set the command key
          setFormat = formatReference; // Set the format reference
          break; // Exit the loop after finding a valid command
          }
        }
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
  //console.log("Sc:",ScommandKey," ck:",commandKey," tf:",typeFormat);
  if(commandKey)setFormat=Array.isArray(typeFormat)?typeFormat:commandsConfig[commandKey][typeFormat];
	if (commandKey && setFormat) {
        // Build the command using the setformat
        let command = commandsConfig[commandKey];
        let commandString = commandKey;

        for (const { param, length } of setFormat) {
        	// Resolve the human-readable key (e.g., P1 -> VFOA frequency)
          const resolvedKey = command[param];

          // Get the value from oldresult or newresult
          let value = newresult[resolvedKey] || oldresult[resolvedKey] || "";

          // Check if the value needs validation/decoding
          if (information && information[resolvedKey]) {
          let Iformat = "format";
          let Idecode = "decode";
          let typeF = Array.isArray(typeFormat)?"setformat":typeFormat;
          if(!information[resolvedKey][Iformat])Iformat = typeF === "setformat"?"setformat":typeF === "answerformat"?"ansformat":"readformat";
          if(!information[resolvedKey][Idecode])Idecode = typeF === "setformat"?"setdecode":typeF === "answerformat"?"ansdecode":"readdecode";
          const format = information[resolvedKey][Iformat];
          const decode = information[resolvedKey][Idecode];

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

          // Pad the value to match the required length
          commandString += value.toString().padStart(length, "0");
        }

        if(command.beforeset)commandList.push(await generateCommandsupport(oldresult,command.beforeset,newresult,[],jsonConfig));
        
        commandList.push(commandString + ";"); // Append the command with a semicolon
        if(command.ausiliar)await setausiliar(oldresult,command.ausiliar,newresult);
      } else {
        console.warn(`No valid set command found for parameter "${key}".`);
      }
	return commandList.join("");
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
""";

clientB_js = """
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
        //console.log("allincomingDatarow:",allPacketsData);
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
""";

processor_js = """
class MyProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'samplerate',
        defaultValue: 4096, // Default rate value
        minValue: 512,   // Minimum rate
        maxValue: 16384    // Maximum rate
      }
    ];
  }

  constructor() {
    super();
    this.bufferI255 = [];
    this.frameCounter = 0;
  }


  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const samplerate = parameters.samplerate[0];

    if (input && input.length > 0 && input[0] && input[0].length > 0) {
        const inputChannel = input[0];

        const normalizedI255 = inputChannel.map(sample =>
            Math.min(255, Math.max(0, Math.round((Math.max(-1, Math.min(1, sample)) + 1) * 127.5)))
        );

        this.bufferI255.push(...normalizedI255);
        this.frameCounter++;

        if (this.bufferI255.length >= samplerate) {
            this.port.postMessage({
                type: "int",
                data: this.bufferI255,
                timestamp: Date.now()
            });
            this.bufferI255 = []; // Retain excess data
            this.frameCounter = 0;
        }
    } else {
        console.warn("No valid audio input for this frame.");
    }

    return true;
}
}

registerProcessor('audio_processor', MyProcessor);
""";

frequence_js = """
if(document.getElementById('radioinfo'))document.getElementById('radioinfo').addEventListener('valueChanged', () => {
  const serverpingElement = document.getElementById('radioinfo');
  let jsri = JSON.parse(serverpingElement.value);
  updatefrequence(jsri['VFOA frequency']);
});
function updateRadioInfo() {
  const frequencyDisplay = document.getElementById("frequencyDisplay");
  const digitElements = frequencyDisplay.querySelectorAll(".digit");

  // Combine digits into a single number
  let frequencyValue = "";
  digitElements.forEach((digitElement) => {
    frequencyValue += digitElement.textContent;
  });

  // Convert to a number for proper formatting (remove leading zeros)
  frequencyValue = parseInt(frequencyValue, 10);

  // Update the hidden input field with the new frequency
  const radioinfoElement = document.getElementById("radioinfo");
  let jsri = JSON.parse(radioinfoElement.value);
  jsri['VFOA frequency'] = frequencyValue;
  radioinfoElement.value = JSON.stringify(jsri);

  // Trigger the valueChanged event
  const event = new Event("valueChanged");
  radioinfoElement.dispatchEvent(event);

  console.log("Updated radioinfo:", radioinfoElement.value);
}
function updatefrequence(frequencyValue) {
  // Convert the frequencyValue to a string to access individual digits
  const frequencyString = frequencyValue.toString().padStart(9, "0");

  // Ensure the frequency has consistent formatting (e.g., length and separators)
  // Example: Pad the frequency to match expected format (e.g., 145450000 -> "145.450.000")
  const formattedFrequency = frequencyString.slice(0, 3) + "." + frequencyString.slice(3, 6) + "." + frequencyString.slice(6);

  // Map formattedFrequency digits to the corresponding digit elements
  const frequencyDisplay = document.getElementById("frequencyDisplay");
  const digitElements = frequencyDisplay.querySelectorAll(".digit, .separator");

  let currentIndex = 0;

  formattedFrequency.split("").forEach((char, index) => {
    const element = digitElements[currentIndex];
    if (element) {
      element.textContent = char; // Update digit or separator
      currentIndex++;
    }
  });
}
// Function to handle updating a specific digit
    function updateDigit(digitElement, increment) {
      let idtarget = digitElement.id;
      let parreN = idtarget.substring(1);
      let currentValue = parseInt(digitElement.textContent, 10);
      let newValue = increment ? currentValue + 1 : currentValue - 1;

      // Keep value between 0 and 9 for individual digits
      if (newValue > 9) {newValue = 0;updateDigit(document.getElementById("d"+(parreN-1)),true);}
      if (newValue < 0) {newValue = 9;updateDigit(document.getElementById("d"+(parreN-1)),false);}

      digitElement.textContent = newValue;
      updateRadioInfo();
    }

    const frequencyDisplay = document.getElementById("frequencyDisplay");

    // Event listener for PC clicks
    frequencyDisplay.addEventListener("click", (event) => {
      if (event.target.classList.contains("digit")) {
        const rect = event.target.getBoundingClientRect();
        const clickY = event.clientY;
        // Upper part clicked - increment digit
        if (clickY < rect.top + rect.height / 2) {
          updateDigit(event.target, true);
        } else {
          // Lower part clicked - decrement digit
          updateDigit(event.target, false);
        }
      }
    });

    // Variables for mobile swipe gestures
    let touchStartY = null;
		let time = 0;
    // Event listeners for mobile swipe gestures
    frequencyDisplay.addEventListener("touchstart", (event) => {
      if (event.target.classList.contains("digit")) {
        time = Date.now();
        touchStartY = event.touches[0].clientY;
      }
      event.preventDefault();
      const clickEvent = new MouseEvent('click', {
        bubbles: true, // Allow event to propagate
        cancelable: true, // Allow the event to be canceled
        clientY: touchStartY,
        view: window, // Set the view to the current window
      });
      event.target.dispatchEvent(clickEvent);
    });
		function delay(ms){return new Promise(resolve => setTimeout(resolve, ms));}
    frequencyDisplay.addEventListener("touchend", async (event) => {
      if (event.target.classList.contains("digit")) {
        const touchEndY = event.changedTouches[0].clientY;
        let repeat = 1;
        if((Date.now()-time)<300)repeat = 300-(Date.now()-time);
        time = Date.now();
        if (touchStartY && touchEndY) {
          if (touchEndY < touchStartY-10){
            // Swipe up - increment digit
            for(let i = 0;i<repeat;i++){updateDigit(event.target, true);await delay(1);}
          }else if (touchEndY < touchStartY) {
            updateDigit(event.target, true);
          } else if (touchEndY > touchStartY+10){
            // Swipe down - decrement digit
            for(let i = 0;i<repeat;i++){updateDigit(event.target, false);await delay(1);}
          } else if (touchEndY > touchStartY){
            // Swipe down - decrement digit
            updateDigit(event.target, false);
          }
        }
        touchStartY = null; // Reset touchStartY
      }
    });
""";

script_js = """
document.addEventListener('DOMContentLoaded', function() {
  const checkboxes = document.querySelectorAll('.page-checkbox');
  const renameButton = document.getElementById('renameButton');
  const editButton = document.getElementById('editButton');
  const deleteButton = document.getElementById('deleteButton');

  // Update the state of the global buttons.
  function updateButtons() {
    const checked = document.querySelectorAll('.page-checkbox:checked');
    const enable = (checked.length === 1);
    renameButton.disabled = !enable;
    editButton.disabled = !enable;
    deleteButton.disabled = !enable;
  }
  
  // Add event listeners for checkbox changes.
  checkboxes.forEach(chk => {
    chk.addEventListener('change', updateButtons);
  });
  
  // Rename button click: redirect to /rename?name=...
  renameButton.addEventListener('click', function() {
    const checked = document.querySelectorAll('.page-checkbox:checked');
    if (checked.length === 1) {
      const pageName = checked[0].getAttribute('data-id');
      window.location.href = "/rename?name=" + encodeURIComponent(pageName);
    }
  });
  
  // Edit button click: redirect to /edit?name=...
  editButton.addEventListener('click', function() {
    const checked = document.querySelectorAll('.page-checkbox:checked');
    if (checked.length === 1) {
      const pageName = checked[0].getAttribute('data-id');
      window.location.href = "/edit?name=" + encodeURIComponent(pageName);
    }
  });
  
  // Delete button click: confirm and redirect to /delete?name=...
  deleteButton.addEventListener('click', function() {
    const checked = document.querySelectorAll('.page-checkbox:checked');
    if (checked.length === 1) {
      const pageName = checked[0].getAttribute('data-id');
      if (confirm("Are you sure you want to delete '" + pageName + "'?")) {
        window.location.href = "/delete?name=" + encodeURIComponent(pageName);
      }
    }
  });
});
""";

manager_js = """
/**
     * Custom plugin to draw centered text in doughnut charts with defensive checks.
     */
    const centerTextPlugin = {
      id: 'centerText',
      beforeDraw: function(chart) {
        if (
          chart.config &&
          chart.config.options &&
          chart.config.options.elements &&
          chart.config.options.elements.center
        ) {
          const ctx = chart.ctx;
          const centerConfig = chart.config.options.elements.center;
          const txt = centerConfig.text || "";
          const fontStyle = centerConfig.fontStyle || 'Arial';
          const color = centerConfig.color || '#000';
          let fontSize = centerConfig.fontSize || 20;
          const sidePadding = centerConfig.sidePadding || 20;
          const sidePaddingCalculated = (sidePadding / 100) * (chart.innerRadius * 2);
  
          ctx.font = `bold ${fontSize}px ${fontStyle}`;
          const stringWidth = ctx.measureText(txt).width;
          const elementWidth = (chart.innerRadius * 2) - sidePaddingCalculated;
          const widthRatio = elementWidth / stringWidth;
          fontSize = Math.min(fontSize, Math.floor(fontSize * widthRatio));
  
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
          const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;
  
          ctx.font = `bold ${fontSize}px ${fontStyle}`;
          ctx.fillStyle = color;
          ctx.fillText(txt, centerX, centerY);
        }
      }
    };
  
    // Register the custom plugin with Chart.js.
    Chart.register(centerTextPlugin);
  
    // Define the total available heap memory (adjust as needed for your device).
  
    let heapChart, spiffsChart;
  
    // Function to create/update the charts with the latest stats.
    function createCharts(HeapData, spiffsData, cpu, flashSize) {
      const usedHeap = HeapData.totalBytes - HeapData.freeBytes;
      const heapCtx = document.getElementById('heapChart').getContext('2d');
      if (heapChart) { heapChart.destroy(); }
      heapChart = new Chart(heapCtx, {
        type: 'doughnut',
        data: {
          labels: ['Free Heap', 'Used Heap'],
          datasets: [{
            data: [HeapData.freeBytes, usedHeap],
            backgroundColor: ['#27ae60', '#c0392b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '70%',
          animation: { // Disable animations
            duration: 0
          },
          elements: {
            // Center text configuration shows CPU frequency.
            center: {
              text: cpu.Freq + " MHz\n" + cpu.Load + "%",
              color: '#34495e',
              fontStyle: 'Arial',
              sidePadding: 20,
              fontSize: 20
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 21 } }
            }
          }
        }
      });
  
      // Create the SPIFFS usage chart.
      const spiffsFree = spiffsData.totalBytes - spiffsData.usedBytes;
      const spiffsCtx = document.getElementById('spiffsChart').getContext('2d');
      if (spiffsChart) { spiffsChart.destroy(); }
      spiffsChart = new Chart(spiffsCtx, {
        type: 'doughnut',
        data: {
          labels: ['Used SPIFFS', 'Free SPIFFS'],
          datasets: [{
            data: [spiffsData.usedBytes, spiffsFree],
            backgroundColor: ['#e67e22', '#16a085']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '70%',
          animation: { // Disable animations
            duration: 0
          },
          elements: {
            // Center text configuration shows CPU frequency.
            center: {
              text: ( flashSize / (1024 * 1024) ) + "MB",
              color: '#34495e',
              fontStyle: 'Arial',
              sidePadding: 20,
              fontSize: 20
            }
          },
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { font: { size: 14 } }
            }
          }
        }
      });
    }
  
    // Function to fetch stats from the ESP32 /stats endpoint and update the charts.
    function updateCharts() {
      fetch('/stats')
        .then(response => response.json())
        .then(data => {
          // Expected data: freeHeap, cpuFreq, totalBytes, usedBytes.
          createCharts({
            totalBytes:data.HeapSize,
            freeBytes: data.freeHeap
          }, { 
            totalBytes: data.totalBytes, 
            usedBytes: data.usedBytes 
          }, {
            Freq: data.cpuFreq, 
            Load: data.cpuLoad
          },data.flashSize );
        })
        .catch(err => console.error("Failed to update charts:", err));
    }
  
    // Update charts on load and every 10 seconds.
    updateCharts();
    setInterval(updateCharts, 1000);
  
    // Manual refresh button handler.
    document.getElementById('refreshCharts').addEventListener('click', updateCharts);
""";
