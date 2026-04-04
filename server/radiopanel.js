import { websoketA,websoketB,COM,Interpreter,requestSigninCode,getSigninCode,sendErrorToServer,getPorts } from '/tools.js';

window.onerror = function (message, source, lineno, colno, error) {
    sendErrorToServer(error || message);
};


async function getConfig(){
	try {
		const response = await fetch("/config.json");
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.json();
	} catch (error) {
		console.error("Error fetching config.json:", error);
	}
}
async function setlisten(listen){
	try {
		const response = await fetch(`/listen?login=${getSigninCode()}&set=${listen}`);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.json();
	} catch (error) {
		console.error("Error fetching config.json:", error);
	}
}
async function getHosts(){
	try {
		const response = await fetch("/hosts");
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.json();
	} catch (error) {
		console.error("Error fetching config.json:", error);
	}
}
async function getclients(){
	try {
		const response = await fetch(`/clients?login=${getSigninCode()}`);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.json();
	} catch (error) {
		console.error("Error fetching config.json:", error);
	}
}

function pickProps(source, props) {
    const result = {};
    props.forEach(p => result[p] = source[p]);
    return result;
}
function isPrimitive(x) {
    return x === null || (typeof x !== "object" && typeof x !== "function");
}
function flattenValues(obj) {
    const result = {};
    for (const key in obj) {
        if(isPrimitive(obj[key])||!obj[key].value)result[key] = obj[key];
		else result[key] = obj[key].value;
    }
    return result;
}



class RadioPanel extends HTMLElement {
    constructor() {
        super();
		this.settings={sampleRate:32000};
		this.radioinfo={};
		this.style.position= "relative";
    }
	
    async connectedCallback() {try{
		
		const code = await requestSigninCode();
		console.log("Codice:", code);

		
		
		this.parent=this.parentElement;
		this.jsonConfig = await getConfig();
		
		//console.log(this.jsonConfig);
		
		this.setup();
		
    } catch (error) {sendErrorToServer(error);}}
	disconnectedCallback() {
		this.parent.style.backgroundColor = "";
		this.parent.appendChild(document.createElement("radio-panel"));
	}
	
	async start(){

		this.parent.style.backgroundColor = "black";
		
		let ant = document.createElement("radio-antenna");
		if(this.settings["connectiontype"]=="hosting"){
			this.settings["awaitms"]=this.jsonConfig.radio[this.settings.radio.value]["awaitms"];
			this.settings["loopreq"]=this.jsonConfig.radio[this.settings.radio.value]["inforequest"];
			let mic = document.createElement("radio-mic")
			this.appendChild(mic);
			mic.changeIcon("speaker");
			ant.sokettype="A";
			
			mic.audiocatch = (audio) =>{
				try{ant.socket?.send(audio);}catch(e){}
			};
			
		}else if(this.settings["connectiontype"]=="guest"){
			this.appendChild(document.createElement("radio-speaker"));
			ant.sokettype="B";
		}
		
		this.appendChild(ant);
		ant.style.top="0%";
		ant.style.right="0%";
		ant.style.position="absolute";
		
		
		let setionU = document.createElement("div")
		let utentlist = document.createElement("radio-utentlist")
		setionU.style.top="0%";
		setionU.style.right="20%";
		setionU.style.width="20%";
		setionU.style.aspectRatio= "1 / 1";
		setionU.style.position="absolute";
		
		
		setionU.appendChild(utentlist);
		this.appendChild(setionU);
		this.appendChild(document.createElement("radio-board"));
		let radioinfo = document.createElement("radio-info");
		
		this.radiosearch = (val) => {
			if ((!radioinfo.radioinfo||!radioinfo.radioinfo[val])&&!this.settings.radio) {
				// Rimanda la chiamata finché il componente non è nel DOM
				requestAnimationFrame(() => this.radiosearch(val));
				return;
			}
			this.settings[val]={};
			this.settings[val].value=radioinfo.radioinfo[val];
		};
		
		if (!this.settings.radio)this.radiosearch("radio");else this.radioinfo["radio"]=this.settings.radio.value;
		
		this.appendChild(radioinfo);
		
		
		if(this.settings.com&&this.settings.COM){
			let interpreter = new Interpreter(this.jsonConfig,this.settings.radio.value);
			interpreter.newqueue = (queue) => {
				if(queue?.type=="answer"){
					let update = Object.keys(queue.format).filter(e => this.radioinfo[e]&&queue.format[e]!=this.radioinfo[e]).map(e => {return {[e]:queue.format[e]};});
					//if(update.length!=0)console.log(update);
					this.radioinfo={...this.radioinfo,...queue.format};
					this.update("radioinfo",{radioinfo:this.radioinfo});
					if(update.length!=0)this.update("update",this.radioinfo,this);
				}
				
			};
			let port = new COM(this.settings.com.coms[this.settings.COM.index],flattenValues(this.settings));
			port.interpreter = (bytes) => interpreter.check(bytes,()=>port.drain(bytes));
			port.traslate = (pack) => interpreter.traslate(pack.format,pack);
			await port.open();
			this.addEventListener("radio-command", (ev) => {let command = ev.detail;
				port.send({type:"pack",command:command.detail.command,format:"set"});
			});
			this.addEventListener("radio-radioinfo", (ev) => {let info = ev.detail;
				if(info.targetElement?.localName=="radio-antenna")
					port.send({type:"pack",update:info.detail.update,radioinfo:info.detail.radioinfo,format:"set"});
			});
		}
	}
	
	async setup(){
		const windowparams = new URLSearchParams(window.location.search);
		
		const choice = document.createElement("radio-choice");
		choice.items = {type:["hosting", "guest"]};
		choice.emitChoice=async (scelta) => {try{
			//console.log(scelta.type);
			this.settings["connectiontype"]=scelta.type.value;
			if(scelta.type.value=="hosting"){
				this.replaceChildren();
				let com = {comsnam:[],coms:[]};
				try{com = await getPorts();}catch (err){await sendErrorToServer(err);}
				
				let microphones = [];
				let mics = [];
				try{mics=(await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "audioinput");microphones = mics.map(obj => obj.label);}catch (err){console.log("???");}
				
				const choice = document.createElement("radio-choice");
				const advancedchoice = document.createElement("radio-choice");
				choice.items = {radio:this.jsonConfig.Radio,audioin:microphones,COM:[...com.comsnam,"new"]};//
				advancedchoice.items = pickProps(this.jsonConfig,["SerialSpeed","stopBits","parity","dataBits"]);
				
				advancedchoice.noconferm=true;
				advancedchoice.style.display="none";
				const advbutton = document.createElement("button");
				advbutton.innerHTML="avanzate";
				advbutton.addEventListener("click", () => {advancedchoice.style.display=advancedchoice.style.display=="none"?"":"none";});
				
				choice.changeEvent= async (key,value) => {
					if(key=="radio")advancedchoice.setCurrentSelection(pickProps(this.jsonConfig.radio[value],["SerialSpeed","stopBits","parity","dataBits"]));
					if(key=="COM"&&value=="new"){
						com = await getPorts(true);
						choice.items.COM = [...com.comsnam,"new"];
						choice.loadItemsIntoPanel();}
				};
				
				this.appendChild(choice);
				this.appendChild(advbutton);
				this.appendChild(advancedchoice);
				let value = this.jsonConfig.Radio[0];
				advancedchoice.setCurrentSelection(pickProps(this.jsonConfig.radio[value],["SerialSpeed","stopBits","parity","dataBits"]));
				
				choice.emitChoice=async (scelta) => {
					this.settings = {...this.settings,...scelta,...advancedchoice.getCurrentSelection(),com,mics};
					this.replaceChildren();
					this.start();
				};
				//let web = new websoketA();
			}
			if(scelta.type.value=="guest"){
				this.replaceChildren();
				const choice = document.createElement("radio-choice");
				let hosts = await getHosts()
				console.log(hosts.hosts);
				choice.items = {host:hosts.hosts.map(e => `${e.codelogin} ${e.radio}`)};
				choice.emitChoice= async (scelta) => {
					this.remoteradio=hosts.hosts[scelta.host.index].codelogin
					this.replaceChildren();
					await this.start();
					
				};
				this.appendChild(choice);

				//let web = new websoketB();
			}
		} catch (error) {sendErrorToServer(error);}};
		this.appendChild(choice);
		
		if(windowparams.get("connectiontype"))await choice.emitChoice({type:{value:windowparams.get("connectiontype")}});
		//console.log(windowparams.get("connectiontype"));
	}
	
	update(name,text,element) {
		//if(name=="update")console.log("dispach:",`radio-${name}`,text,element);
		this.dispatchEvent(new CustomEvent(`radio-${name}`, {detail:{
			detail: text,
			targetElement: element?element:this
		}}));
	}

	
}

class RadioBoard extends HTMLElement {


    constructor() {
        super();
	}
	async connectedCallback() {
        const html = await fetch("/radioboard.html").then(r => r.text());
        this.innerHTML =  `${html}`;
		
		this._listener = (ev) => {let e = ev.detail;
            this.querySelectorAll("display-frequence").forEach(el => {
				if(e.detail.radioinfo[el.getAttribute("VFO")])el.updatefrequence(e.detail.radioinfo[el.getAttribute("VFO")]);
			});
			this.querySelectorAll("radio-indicator").forEach(el => {
				
				const ind = el.getAttribute("ind");
				if(e.detail.radioinfo[ind]){
					el.querySelectorAll("span").forEach(elm => {
					if(elm.getAttribute("mode")?.split(",").includes(e.detail.radioinfo[ind])){
						elm.style.color="#0f0";
						elm.innerHTML=e.detail.radioinfo[ind];
					}else if(elm.getAttribute("mode")){
						elm.innerHTML=elm.getAttribute("mode").split(",")[0];
						elm.style.color="#555";
					}else{
						elm.style.color="#555";
					}
					});
				}
			});
			//updatefrequence()
        };
        this.parentElement.addEventListener("radio-radioinfo", this._listener);
		
		this.buttoncontrol = () => {
			let radiopanel = this.closest("radio-panel");
			if (!radiopanel?.jsonConfig||!radiopanel?.settings.radio?.value) {
				this.querySelectorAll("button").forEach(el => {el.className="inattivo";});
				// Rimanda la chiamata finché il componente non è nel DOM
				requestAnimationFrame(() => this.buttoncontrol());
				return;
			}
			let config = radiopanel.jsonConfig.radio[radiopanel.settings.radio.value];
			//console.log(config);
			this.querySelectorAll("button").forEach(el => {
				let type = el.getAttribute("type")?.split(",");
				if(type&&type[0]=="update"){
					el.className="";
				}else el.className=config.commandlist[el.id]?"":"inattivo";
				
			});
		};
		this.buttoncontrol();
		this.querySelectorAll(".keyboard-container").forEach(elk => elk.addEventListener("click", (event) => {
			let el = event.target;
			let type = el.getAttribute("type")?.split(",");
			if(type&&type[0]=="update"){
				this.closest("radio-panel")?.update("update",{[type[1]]:el.id},this);				
			}else this.closest("radio-panel")?.update("setEvent",el.id);
		}));
    }
}
class DisplayFrequence extends HTMLElement {


    constructor() {
        super();
	}
	async connectedCallback() {
		this.addEventListener("click", (event) => {
		  if (event.target.classList.contains("digit")) {
			const rect = event.target.getBoundingClientRect();
			const clickY = event.clientY;
			// Upper part clicked - increment digit
			if (clickY < rect.top + rect.height / 2) {
			  this.updateDigit(event.target, true);
			} else {
			  // Lower part clicked - decrement digit
			  this.updateDigit(event.target, false);
			}
			this.closest("radio-panel")?.update("update",{[this.getAttribute("VFO")]:this.getfrequence()},this);
		  }
		});
		this.addEventListener("touchstart", async (event) => {try{
		  if (event.target.classList.contains("digit")) {
			this.time = Date.now();
			this.touchStartY = event.touches[0].clientY;
		  }
		  event.preventDefault();
		  const clickEvent = new MouseEvent('click', {
			bubbles: true, // Allow event to propagate
			cancelable: true, // Allow the event to be canceled
			clientY: this.touchStartY,
			view: window, // Set the view to the current window
		  });
		  event.target.dispatchEvent(clickEvent);
		}catch (e) {await sendErrorToServer(e);}});
		this.addEventListener("touchend", async (event) => {try{
		  if (event.target.classList.contains("digit")) {
			const touchEndY = event.changedTouches[0].clientY;
			let repeat = 1;
			if((Date.now()-this.time)<300)repeat = 300-(Date.now()-this.time);
			this.time = Date.now();
			if (this.touchStartY && touchEndY) {
			  if (touchEndY < this.touchStartY-10){
				// Swipe up - increment digit
				for(let i = 0;i<repeat;i++){this.updateDigit(event.target, true);await this.delay(1);}
			  }else if (touchEndY < this.touchStartY) {
				this.updateDigit(event.target, true);
			  } else if (touchEndY > this.touchStartY+10){
				// Swipe down - decrement digit
				for(let i = 0;i<repeat;i++){this.updateDigit(event.target, false);await this.delay(1);}
			  } else if (touchEndY > this.touchStartY){
				// Swipe down - decrement digit
				this.updateDigit(event.target, false);
			  }
			  this.closest("radio-panel")?.update("update",{[this.getAttribute("VFO")]:this.getfrequence()},this);
			}
			this.touchStartY = null; // Reset touchStartY
		  }
		}catch (e){await sendErrorToServer(e);}});
    }
	delay(ms){return new Promise(resolve => setTimeout(resolve, ms));}
	updateDigit(digitElement, increment) {
      let idtarget = digitElement.id;
      let parreN = idtarget.substring(1);
      let currentValue = parseInt(digitElement.textContent, 10);
      let newValue = increment ? currentValue + 1 : currentValue - 1;

      // Keep value between 0 and 9 for individual digits
      if (newValue > 9) {newValue = 0;this.updateDigit(document.getElementById("d"+(parreN-1)),true);}
      if (newValue < 0) {newValue = 9;this.updateDigit(document.getElementById("d"+(parreN-1)),false);}

      digitElement.textContent = newValue;
	  
    }
	getfrequence() {
	  const frequencyDisplay = document.getElementById("frequencyDisplay");
	  const digitElements = frequencyDisplay.querySelectorAll(".digit");

	  // Combine digits into a single number
	  let frequencyValue = "";
	  digitElements.forEach((digitElement) => {
		frequencyValue += digitElement.textContent;
	  });

	  // Convert to a number for proper formatting (remove leading zeros)
	  frequencyValue = parseInt(frequencyValue, 10);
	  return frequencyValue;
	}
	updatefrequence(frequencyValue) {
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
}


class RadioUtentList extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
		let img = document.createElement("img");
		let Ulist = document.createElement("Ulist");
		let Unum = document.createElement("div");
		let style = document.createElement("style");
		style.innerHTML = `
		Ulist {display: none;}
		radio-utentlist[open] Ulist {display: block;top:20%;position:absolute;}
		radio-utentlist[open] img {display: block;width:20%;left:40%;}
		radio-utentlist img {display:block;width:40%;left:60%;position:absolute;}
		radio-utentlist[B] img {pointer-events:none;}
		radio-utentlist span {color: #0f0;display: block;}`;
		img.id = "icon"; 
		img.src="/immagini/utents.svg";
		this.style.overflow= "hidden";
		this.appendChild(style);
		this.appendChild(img);
		this.appendChild(Ulist);
		this.appendChild(Unum);
		this.style.width="100%";
		this.toggleAttribute("B",true);
		
		this.querySelector("#icon").addEventListener("click", () => {
            this.toggleAttribute("open");
        });
		
		
		this.closest("radio-panel").addEventListener("radio-clientAdded", (ev)=>{let utent = ev.detail.detail.client;
			console.log(utent);
			if(utent.type=="B")this.toggleAttribute("B",false);
			let U = document.createElement("span");
			U.id = `id-${utent.codelogin}`;
			U.textContent = utent.codelogin;
			this.querySelector("Ulist").appendChild(U);
		});
		this.closest("radio-panel").addEventListener("radio-clientRemoved", (ev)=>{let utent = ev.detail.detail.client;
			console.log("remove",utent);
			let nodeut = this.querySelector("Ulist").querySelector(`#id-${utent.codelogin}`);
			this.querySelector("Ulist").removeChild(nodeut);
		});
		
    }

}
class RadioInfo extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: "open" });

        this.shadowRoot.innerHTML = `
            <style>
                :host {display: block;font-family: sans-serif;user-select: none;}
                .header {display: flex;align-items: center;gap: 6px;font-weight: bold;cursor: pointer;}
                .arrow {transition: transform 0.2s ease;color: var(--arrow-color, green);}
                .content {margin-top: 6px;padding: 8px;border: 1px solid #ccc;border-radius: 6px;background: #f8f8f8;display: none;}
                :host([open]) .content {display: block;}
                :host([open]) .arrow {transform: rotate(90deg);}
            </style>
            <div class="header">
                <span class="arrow">▶</span>
            </div>
            <div class="content">
                <slot></slot>
            </div>
        `;
    }

    connectedCallback() {
		this.radioinfo={};
        this.shadowRoot.querySelector(".header").addEventListener("click", () => {
            this.toggleAttribute("open");
        });
		// ascolta l’evento del parent
        this._listener = (ev) => {let e = ev.detail;
			this.radioinfo={...this.radioinfo,...e.detail.radioinfo};
            this.shadowRoot.querySelector(".content").innerHTML = JSON.stringify(this.radioinfo);
        };

        this.parentElement.addEventListener("radio-radioinfo", this._listener);
    }

}

class RadioMic extends HTMLElement {
	constructor() {
        super();
		this.on=true;
    }
	changeIcon(ic){
		const icon = this.querySelector("#icon");
		icon.src = `/immagini/${ic}.svg`;
	}
	connectedCallback() {
		let img = document.createElement("img");
		img.id = "icon"; 
		img.src="/immagini/mic.svg";
		img.style.display="block";
		img.style.width="100%";
		this.appendChild(img);
		this.style.display="block";
		this.style.width="20%";
		
		this.addEventListener("click", () => {if(this.on)this.disactive();else this.active()});
		this.active();
	}
	disactive(){
		this.style.opacity= 0.3;
		this.on=false;
		if (this.source) {
			this.source.disconnect(); // Disconnect the audio graph
		}
		if (this.stream) {
			this.stream.getTracks().forEach((track) => track.stop()); // Stop the microphone
			this.stream = null; // Clear the stream reference
		}
		if (this.audioWorkletNode) {
			this.audioWorkletNode.disconnect();
		}
		if (this.audioContext) {
			this.audioContext.close();
		}
	}
	async active(){
		this.style.opacity= 1;
		this.on=true;
		const microphones = this.parentElement.settings.mics;
		
		this.microphone = microphones[this.parentElement.settings.audioin.index];
		this.stream = await navigator.mediaDevices.getUserMedia({audio: {deviceId: { exact: this.microphone.deviceId }}});

		
		this.audioContext = new AudioContext({ sampleRate: this.parentElement.settings.sampleRate });
		await this.audioContext.audioWorklet.addModule('audio_processor.js');
		
		this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio_processor');
		this.audioWorkletNode.parameters.get('samplerate').setValueAtTime(this.parentElement.jsonConfig.audiopack, this.audioContext.currentTime);
		this.source = this.audioContext.createMediaStreamSource(this.stream);
		this.source.connect(this.audioWorkletNode);
		let Pk = 0;
		this.audioWorkletNode.port.onmessage = (event) => {
			const uint8Array = new Uint8Array(event.data.data);
			//const uint8Array = new Uint8Array([ 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,15,16,17,18,19,20]);
			const base64String = btoa(String.fromCharCode(...uint8Array));
			let timedel = 0;
			try{timedel=Date.now()-(this.parentElement.jsonConfig.audiopack/this.parentElement.jsonConfig.sampleRate)*1000;}catch (err) {console.error('Error initializing audio timedel:', err);}
			const data = {
			  type: 'audio',
			  time: timedel?timedel:0,
			  sampleRate: this.parentElement.jsonConfig.sampleRate,
			  alength: base64String.length,
			  audio: base64String,
			  paket: Pk,
			};
			this.audiocatch?.(JSON.stringify(data));
			Pk++;
        }
	}
}

class RadioAntenna extends HTMLElement {
	constructor() {
        super();
		this.on=true;
    }
	connectedCallback() {
		let img = document.createElement("img");
		img.id = "icon"; 
		img.src="/immagini/antenna.svg";
		img.style.display="block";
		img.style.width="100%";
		let freezed = document.createElement("img");
		freezed.id = "iced"; 
		freezed.src="/immagini/ice.svg";
		freezed.style.position="absolute";
		freezed.style.top="0%";
		freezed.style.width="100%";
		freezed.style.opacity= "0";
		this.appendChild(img);
		this.appendChild(freezed);
		this.style.display="block";
		this.style.width="20%";
		
		this.addEventListener("click", () => {if(this.on)this.disactive();else this.active()});
		this.active();
		this._listener = (ev) => {let e = ev.detail;
			this.socket?.send(JSON.stringify({type:"update",data:e.detail,time: Date.now(),device: navigator.userAgent,freeze:window.pageThrottled?true:false}));
        };
		this._listener2 = (ev) => {let e = ev.detail;
			this.socket?.send(JSON.stringify({type:"setEvent",event:e.detail,time: Date.now(),device: navigator.userAgent}));
        };

        this.parentElement.addEventListener("radio-update", this._listener);
        this.parentElement.addEventListener("radio-setEvent", this._listener2);
		
		
	}
	disactive(){
		this.style.opacity= 0.3;
		this.on=false;
		
		// Chiudi socket se esiste
		if (this.socket && this.socket.close) {
			try { this.socket.close(); } catch(e) {}
			this.socket=null;
		}
		
		clearInterval(this.connections);
		
	}
	async active(){
		this.style.opacity= 1;
		this.on=true;
		
		let newsocket = null;
		
		// Crea socket corretto
		if (this.sokettype === "A") {
			newsocket = new websoketA();
		} else if (this.sokettype === "B") {
			newsocket = new websoketB();
		}
		
		
		newsocket.onlinechek = (from,ping) => {if(ping&&from!="server")this.ping(`${ping}ms`);};
		newsocket.updatehandler = update => {
			//console.log(update.data);
			if(!("state" in update.data)){
				this.parentElement.radioinfo={...this.parentElement.radioinfo,...update.data};
				this.parentElement.update("radioinfo",{radioinfo:this.parentElement.radioinfo,update:update.data},this);
			}
			if(update.data.state!="ok")this.parentElement.update("update",{state:"ok"},this);
			
			if(update.freeze!=undefined&&this.sokettype==="B")this.querySelector("#iced").style.opacity=update.freeze?"0.5":"0";
			
		};
		newsocket.audiohandler = audio => {
			this.parentElement.update("playaudio",audio.audio);
		};
		newsocket.seteventhandler = set => {
			this.parentElement.update("command",{command:set.event});
		};
		newsocket.serverhandler = request => {
			
			console.log(request);
			this.clientsort(request.data);
		};
		newsocket.handlerclose = close => {
			console.log(close);
			this.disactive();
			if(close.code==1006)this.active();
		};
		this.socket=newsocket;
		
		let remoteradio = this.closest("radio-panel")?.remoteradio
		if(remoteradio){
			await this.socket.waitConnected();
			await setlisten(remoteradio)
		}
		
		this.connections = setInterval(async () => {
			
			this.socket?.send(JSON.stringify({
				type:"server",
				request:"getclients"
			}));
		}, 5000);
		
	}
	
	clientsort(newClients){
		let new_list = {};
		let old_list = {};
		newClients?.forEach(c =>{new_list[c.codelogin]=c;});
		this.clients?.forEach(o =>{old_list[o.codelogin]=o;});
		let all_clients = {...old_list,...new_list};
		let clientAdded = {...all_clients};
		let clientRemoved = {...all_clients};
		
		Object.entries(all_clients).forEach(([key,cli],index) => {
			Object.entries(new_list).forEach(([key2,cli2],index) => {
				if(key==key2)delete clientRemoved[key];
			});
			Object.entries(old_list).forEach(([key2,cli2],index) => {
				if(key==key2)delete clientAdded[key];
			});
		});
		
		//console.log(this.clients,newClients,clientAdded,clientRemoved,newClients?.some(o => o.codelogin === this.clients?.[0]?.codelogin)?true:false);
		this.clients = newClients;
		Object.entries(clientAdded).forEach(([key,cli],index) => this.parentElement.update("clientAdded",{client:cli}));
		Object.entries(clientRemoved).forEach(([key,cli],index) => this.parentElement.update("clientRemoved",{client:cli}));
		
		if(Object.entries(clientAdded).length!=0)this.closest("radio-panel")?.update("update",this.closest("radio-panel").querySelector("radio-info").radioinfo,this);
	}
	
	
	ping(text) {
		let label = this.querySelector(".label-above");

		if (!label) {
			label = document.createElement("div");
			label.className = "label-above";
			label.style.position = "absolute";
			label.style.top = "50%";
			label.style.left = "50%";
			label.style.transform = "translateX(-50%)";
			label.style.color = "red";
			label.style.fontWeight = "bold";
			label.style.pointerEvents = "none";

			//this.style.position = "relative";
			this.appendChild(label);
		}
		label.style.visibility="";
		label.textContent = text;
		if (this._msgTimer) {
			clearTimeout(this._msgTimer);
		}

		// crea un nuovo timer
		this._msgTimer = setTimeout(() => {
			label.style.visibility="hidden";
			this._msgTimer = null;
		}, 2000);

	}


	
}

class RadioSpeaker extends HTMLElement {
    constructor() {
        super();
		this.on=true;
		this.volume=4;
    }
	changeIcon(ic){
		const icon = this.querySelector("#icon");
		icon.src = `/immagini/${ic}.svg`;
	}

    connectedCallback() {
		let img = document.createElement("img");
		img.id = "icon"; 
		img.src="/immagini/speaker.svg";
		img.style.display="block";
		img.style.width="100%";
		this.appendChild(img);
		this.style.display="block";
		this.style.width="20%";

        this.addEventListener("click", () => {
            if (this.on) this.disactive();
            else this.active();
        });

        this.active();
		this._listener = (ev) => {let e = ev.detail;
            this.playBase64(e.detail);
        };

        this.parentElement.addEventListener("radio-playaudio", this._listener);
    }

    disactive() {
        this.style.opacity = 0.3;
        this.on = false;

        if (this.audioWorkletNode) {
            this.audioWorkletNode.disconnect();
        }

        if (this.audioContext) {
            this.audioContext.close();
        }
		this.gainNode = null;
		this.audioQueue=null;
		this.isPlaying = false;
    }

    async active() {
        this.style.opacity = 1;
        this.on = true;

        // Crea AudioContext
        this.audioContext = new AudioContext({
            sampleRate: this.parentElement.settings.sampleRate
        });
		this.gainNode = null;
		if(this.audioContext.state === "suspended"){
			this.disactive();
			return;
		}
		this.audioQueue=[];
		const sampleRate = this.audioContext.sampleRate;
		const duration = 0.1; // 100ms
		const length = sampleRate * duration;

    }
	
	playBase64(paket){
		// Decode Base64 audio data into Float32Array
        const uint8Array = new Uint8Array(atob(paket).split("").map((char) => char.charCodeAt(0)));
        const float32Array = new Float32Array(uint8Array.length);
        for (let i = 0; i < uint8Array.length; i++) {
            float32Array[i] = (uint8Array[i] - 128) / 128; // Map 0-255 to -1.0 to 1.0
        }
		
		this.play(float32Array);
	}
	getQueueTime() {
		if (!this.audioQueue || this.audioQueue.length === 0) return 0;

		let totalSeconds = 0;

		for (const buffer of this.audioQueue) {
			totalSeconds += buffer.length / buffer.sampleRate;
		}

		return totalSeconds;
	}
	play(paket){
		if(!this.audioQueue)return;
		const audioBuffer = this.audioContext.createBuffer(1, paket.length, this.audioContext.sampleRate);
		audioBuffer.copyToChannel(paket, 0);
		if(this.getQueueTime()>2)this.audioQueue=[];
		this.audioQueue.push(audioBuffer);
		if (!this.isPlaying) {
            this.playAudioFromQueue();
        }
		
	}
	async playAudioFromQueue(){
		// Stop if the queue is empty
		if (!this.audioQueue||this.audioQueue.length === 0) {
			this.isPlaying = false;
			return;
		}

		this.isPlaying = true;
		const audioBuffer = this.audioQueue.shift(); // Get the next audio buffer
		


		
		try {
			const source = this.audioContext.createBufferSource();
			source.buffer = audioBuffer;
			
			if (!this.gainNode) {
				this.gainNode = this.audioContext.createGain();
				this.gainNode.gain.value = this.volume ?? 1; // volume di default
				this.gainNode.connect(this.audioContext.destination);
			}
			source.connect(this.gainNode);
			source.start();

			source.onended = () => {
				source.disconnect(); // Clean up resources
				this.playAudioFromQueue(); // Continue with the next buffer
			};
		} catch (E) {
			await sendErrorToServer(E);
			console.error("Audio playback error:", E);
			isPlaying = false; // Reset playback flag
		}
	}
}



class RadioChoice extends HTMLElement {
    constructor() {
        super();
		this.items = {result:["A", "B"]};
		this.noconferm=false;
    }
	loadItemsIntoPanel() {
		const choice = this.querySelector("#grid");

		Object.entries(this.items).forEach(([key, list], index) => {


			// Cerca se esiste già il select
			let scroll = choice.querySelector(`select[data-key="${key}"]`);
			let label  = choice.querySelector(`span[data-key="${key}"]`);

			// Se non esiste, lo crea
			if (!scroll) {
				scroll = document.createElement("select");
				scroll.className = "scroll-area";
				scroll.dataset.key = key;

				scroll.addEventListener("change", () => {
					this.changeEvent?.(key, scroll.value);
				});

				choice.appendChild(scroll);
			}

			// Se non esiste la label, la crea
			if (!label) {
				label = document.createElement("span");
				label.dataset.key = key;
				label.textContent = key;
				choice.appendChild(label);
			}

			// Posizionamento nella grid
			scroll.style.gridRow = index + 1;
			scroll.style.gridColumn = 2;

			label.style.gridRow = index + 1;
			label.style.gridColumn = 1;

			// Aggiorna le opzioni SENZA duplicare
			scroll.innerHTML = "";
			list.forEach(item => {
				const el = document.createElement("option");
				el.value = item;
				el.textContent = item;
				scroll.appendChild(el);
			});
		});
	}

    connectedCallback() {
        this.innerHTML = `
            <style>
                .scroll-area {width: 100%;max-width: 100%;min-width: 0;box-sizing: border-box;max-height: 200px;overflow-y: auto;border: 1px solid #ccc;padding: 8px;}
                button {margin-top: 10px;}
            </style>
			<div id="grid" style="display: grid;">
				<div id="confirmbox" style="display: flex;justify-content: center;"><button id="confirm" style="width: 50%;">Conferma scelta</button></div>
			</div>
        `;
		
		
		const choice = this.querySelector("#grid");
		
		let cols = 2;
		let rows = Object.keys(this.items).length+1;
		if(this.noconferm)rows-=1;
			
		choice.style.gridTemplateColumns = `25% repeat(${cols - 1}, 1fr)`;
		//choice.style.gridTemplateColumns = `repeat(${cols}, minmax(calc(100% / ${cols}), 1fr))`;
		choice.style.gridAutoRows = `calc(100% / ${rows})`;
		choice.style['min-height'] = "100%";
		
		if(this.noconferm)this.querySelector("#confirmbox").style.visibility="hidden";
		this.querySelector("#confirmbox").style.gridRow=`${rows}`;
		this.querySelector("#confirmbox").style.gridColumn =`1 / span 2`;
		
        this.querySelector("#confirm")
            .addEventListener("click", () => {
				const scelta = this.getCurrentSelection();
				this.emitChoice?.(scelta);
			});
		
		this.loadItemsIntoPanel();
    }

    getCurrentSelection() {
		const result = {};

		this.querySelectorAll(".scroll-area").forEach(select => {
			const key = select.dataset.key;   // "nome", "colore", "taglia"
			const value = select.value;       // valore scelto
			const index = select.selectedIndex; // es: 1

			result[key] = { value, index };

		});

		return result;
	}
	setCurrentSelection(data) {
		this.querySelectorAll(".scroll-area").forEach(select => {
			const key = select.dataset.key;
			const entry = data[key];

			if (!entry) return;

			select.value = entry;
		});
	}
}


customElements.define("radio-mic", RadioMic);

customElements.define("radio-info", RadioInfo);

customElements.define("radio-utentlist", RadioUtentList);

customElements.define("radio-choice", RadioChoice);

customElements.define("radio-panel", RadioPanel);

customElements.define("radio-board", RadioBoard);

customElements.define("radio-speaker", RadioSpeaker);

customElements.define("radio-antenna", RadioAntenna);

customElements.define("display-frequence", DisplayFrequence);