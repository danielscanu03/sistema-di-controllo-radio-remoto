


// Variabile globale leggibile da qualsiasi script
window.pageThrottled = false;

// Imposta l'intervallo desiderato
const INTERVAL = 200; // ms
let last = performance.now();

function driftCheck() {
    const now = performance.now();
    const delta = now - last;

    // Se il ritardo è il doppio dell'intervallo → throttling
    if (delta > INTERVAL * 2) {
        window.pageThrottled = true;
    } else {
        window.pageThrottled = false;
    }
    last = now;

    // Timer preciso (non usare setInterval)
    setTimeout(driftCheck, INTERVAL);
}

// Avvio
driftCheck();
export async function getPorts(newport) {
    const port = null;
	if(newport) try{port=await navigator.serial.requestPort();}catch (error) {}
	let coms = (await navigator.serial.getPorts()).filter(d => d.connected && d.getInfo()?.usbVendorId);
	if(coms.length==0)try{
		port=await navigator.serial.requestPort();
		coms = (await navigator.serial.getPorts()).filter(d => d.connected && d.getInfo()?.usbVendorId);
	}catch (error) {}

	const index = port?coms.indexOf(port):0;
	if(index==-1)alert("COM incopatible");
	else coms = [coms[index], ...coms.slice(0, index), ...coms.slice(index + 1)];
	const comsnam = coms.map(obj => {let inf=obj?.getInfo();return `${inf?.usbProductId}:${inf?.usbVendorId}`;});

	return {comsnam,coms};
}
export async function sendErrorToServer(err) {
    fetch("/log/error?login="+(await requestSigninCode()), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            error: String(err),
			stack: err.stack?err.stack:"null",
            time: Date.now()
        })
    }).catch(() => {});
}

let storage = {signin_code:null,signin_username:null,session_code:null};

export async function requestSigninCode() {
    // 1) Se esiste già in cache, lo ritorno subito
	const url = new URL(window.location);
	const existed = url.searchParams.has("resetusername");
	if(existed){
		url.searchParams.delete("resetusername");
		window.history.replaceState({}, "", url);
		storage.signin_username=null;
	}
	if(!storage.signin_username){
		let awaits = async () => {
			let local = localStorage.getItem("signin_username");
			if(local)return local;
			return prompt("username");
		}
		storage.signin_username=awaits();
		storage.signin_username.then((cacheduser) => localStorage.setItem("signin_username", cacheduser));
	}
    if (!storage.signin_code){
		let awaits = async () => {
			let local = localStorage.getItem("signin_code");
			if(local)return local;
			try {
				const res = await fetch("/signin?username="+(await storage.signin_username));
				if (!res.ok) throw new Error("Errore HTTP: " + res.status);
				const data = await res.json();
				// 3) Salvo in cache
				return data.code;
				
			} catch (err) {
				console.error("Errore durante la richiesta del codice cliente:", err);
				return null;
			}
		};
		storage.signin_code=awaits();
		storage.signin_code.then((cached)=>localStorage.setItem("signin_code", cached));
	}
	if (!storage.session_code){
		let awaits = async () => {
			try {
				const res = await fetch("/login?login="+(await storage.signin_code)+"&username="+(await storage.signin_username));
				if (!res.ok) throw new Error("Errore HTTP: " + res.status);
				const data = await res.json();
				// 3) Salvo in cache
				return data.session;
			} catch (err) {
				console.error("Errore durante la richiesta del codice sessione:", err);
				return null;
			}
		};
		storage.session_code=awaits();
	}
    return `${await storage.signin_code}-${await storage.session_code}`;
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


class messsageHandle{
	constructor(link) {
		this.incomingData = JSON.parse("{\"Nconn\":0}");
		this.completedKeys = [];
    }
	add(pack){
		const key = jsonfind(this.incomingData, pack.from);  // Use jsonfind to generate or locate the key
		if (!this.incomingData[key]) {
		  // Initialize the structure if this is the first packet from this source
		  this.incomingData[key] = { completed: false, paks: 0, from: pack.from };
		}
		if (pack.data === "end") {
		  this.incomingData[key].paks = pack.pack;

		  // Simplified check for all packets
		  const allPacketsReceived = Array.from({ length: this.incomingData[key].paks })
									  .every((_, i) => this.incomingData[key][`paket${i}`]);
		  if (allPacketsReceived) {
			this.incomingData[key].completed = true;
			this.completedKeys.push(key);
		  }
		} else {
		  this.incomingData[key][`paket${pack.pack}`] = pack.data;
		  if (this.incomingData[key].paks > 0) {
			const allPacketsReceived = Array.from({ length: this.incomingData[key].paks })
										.every((_, i) => this.incomingData[key][`paket${i}`]);
			if (allPacketsReceived) {
			  this.incomingData[key].completed = true;
			  this.completedKeys.push(key);
			}
		  }
		}
	}
	
	getCompleted(){
		if(this.completedKeys.length==0)return null;
		let compkey = this.completedKeys[0];
		this.completedKeys.pop(0);
		let ret = this.incomingData[compkey]
		delete this.incomingData[compkey];
		return ret;
	}
}

class MySocket extends WebSocket {
    constructor(url) {
        super(url);
    }

    waitConnected() {
        return new Promise((resolve, reject) => {

            // Se è già connesso, risolvi subito
            if (this.readyState === WebSocket.OPEN) {
                return resolve();
            }

            // Se è già fallito/chiuso, rifiuta subito
            if (this.readyState === WebSocket.CLOSED || this.readyState === WebSocket.CLOSING) {
                return reject(new Error("WebSocket already closed"));
            }

            // Eventi
            const onOpen = () => {
                cleanup();
                resolve();
            };

            const onError = (err) => {
                cleanup();
                reject(err);
            };

            const onClose = () => {
                cleanup();
                reject(new Error("WebSocket closed before connecting"));
            };

            const cleanup = () => {
                this.removeEventListener("open", onOpen);
                this.removeEventListener("error", onError);
                this.removeEventListener("close", onClose);
            };

            this.addEventListener("open", onOpen);
            this.addEventListener("error", onError);
            this.addEventListener("close", onClose);
        });
    }
}

class websoketR extends WebSocket{
	
	constructor(link) {
        super(link);

		
		this.msghandle= new messsageHandle();
		console.log('WebSocket to:',link);
		this.onopen = this.handleOpen.bind(this);
        this.onmessage = this.handleMessage.bind(this);
        this.onerror = this.handleError.bind(this);
        this.onclose = this.handleClose.bind(this);
    }
	
  handleOpen(){
    console.log('WebSocket connected');
  };

  handleMessage(event){
    const data = JSON.parse(event.data);            // Parse the incoming JSON
    this.msghandle.add(data);
	
	let completed = this.msghandle.getCompleted();
	if(!completed)return;
	try{
		const allPacketsData = Array.from({ length: completed.paks }).map((_, i) => completed[`paket${i}`]).filter(data => data).join("");
        //console.log("allincomingDatarow:",allPacketsData);
        const alldata = JSON.parse(allPacketsData);
		
		if(alldata.type === 'pong'){
			const elapsed = Date.now() - alldata.time;
			//console.log('Pong received from '+completed.from+', round-trip time: ' + elapsed + ' ms');
			this.onlinechek?.(completed.from,elapsed);
		} else if (alldata.type === 'ping') {
          // Respond with a pong message
		  //console.log(completed);
          const pongData = {
            type: 'pong',
            time: alldata.time,
            device: navigator.userAgent,
            payload: alldata.payload
          };
          this.send(JSON.stringify(pongData));
          this.onlinechek?.(completed.from,null);
        } else if (alldata.type === 'message') {
			this.msghandler?.(alldata);
		} else if (alldata.type === 'server') {
			this.serverhandler?.(alldata);
		} else if (alldata.type === 'command') {
			this.commandhandler?.(alldata);
		} else if (alldata.type === 'update') {
			this.updatehandler?.(alldata);
		} else if (alldata.type === 'setEvent') {
			this.seteventhandler?.(alldata);
		} else if (alldata.type === 'audio') {
			this.audiohandler?.(alldata);
		}
	} catch (e) {
        console.error("SMS err:", e);
        // Incomplete JSON, keep accumulating data
    }
  }
  waitConnected() {
	return new Promise((resolve, reject) => {

	  // Se è già connesso, risolvi subito
	  if (this.readyState === WebSocket.OPEN) {
		return resolve();
	  }

	  // Se è già fallito/chiuso, rifiuta subito
	  if (this.readyState === WebSocket.CLOSED || this.readyState === WebSocket.CLOSING) {
		return reject(new Error("WebSocket already closed"));
	  }

	  // Eventi
	  const onOpen = () => {
		cleanup();
		resolve();
	  };

	  const onError = (err) => {
		cleanup();
		reject(err);
	  };

	  const onClose = () => {
		cleanup();
		reject(new Error("WebSocket closed before connecting"));
	  };

	  const cleanup = () => {
		this.removeEventListener("open", onOpen);
		this.removeEventListener("error", onError);
		this.removeEventListener("close", onClose);
	  };

	  this.addEventListener("open", onOpen);
	  this.addEventListener("error", onError);
	  this.addEventListener("close", onClose);
    });
  }
  handleError(error){
	if(this.handlererror)this.handlererror?.(error);
    else console.error('WebSocket error:', error);
  }

  handleClose(event){
    if(this.handlerclose)this.handlerclose?.(event);
    else console.log('WebSocket closed:', event);
	clearInterval(this.ping);
  }
}



class websoketA extends websoketR {
    constructor(url) {
        super(url);
    }

    static async create() {
        const login = await requestSigninCode();
        const url = ((location.protocol === "https:") ? 'wss://' : 'ws://')
                  + window.location.host
                  + '/websocketA?login=' + login;

        return new websoketA(url);
    }
}

class websoketB extends websoketR{
	constructor(url) {
        super(url);
		this.ping = setInterval(() => {
			this.send(JSON.stringify({
				type: 'ping',
				time: Date.now(),
				device: navigator.userAgent,
				payload: "AAAAAAAAAAAAAAAAAAAAAAAAAA"
			}));
		}, 2000);
	}
	static async create() {
        const login = await requestSigninCode();
        const url = ((location.protocol === "https:") ? 'wss://' : 'ws://')
                  + window.location.host
                  + '/websocketB?login=' + login;

        return new websoketB(url);
    }
}


class Interpreter{
	constructor(Json,radio) {
		this.json=Json.radio[radio];
	}
	
	check(buffer,reset){
		const awaitStart = toIntArray(this.json["awaitstart"]);
		const awaitEnd   = toIntArray(this.json["awaitend"]);
		
		if (awaitStart) {
			if(awaitStart.length>buffer.length)return;
			if (!arrayStartsWith(buffer, awaitStart)) {reset();return;}
		}
		if (awaitEnd) {
			if(awaitEnd.length+(awaitStart?awaitStart.length:0)>buffer.length)return;
			if (!arrayEndsWith(buffer, awaitEnd)) {return;}
		}
		
		this.newqueue?.(this.traslate("answer",buffer));
		reset();
	}
	
	traslate(type,buffer){
		let catchstruct = this.json["struct"];
		let commands = this.json["commands"];
		let commandlist = this.json["commandlist"];
		let information = this.json["information"];
		let ret = null;
		if(Array.isArray(buffer)){
			let catchstructs = this.findStruct(buffer,commands,information).filter(c => c.type==type);
			if(catchstructs?.length==1){
				ret=catchstructs[0];
				ret["buff"]=buffer;
				ret["buffstr"]=buffer.map(car => String.fromCharCode(car)).join("");
			}
		}else if(buffer.command&&!buffer.data){
			let command = null;
			let formd = null;
			let data = null;
			if(Array.isArray(commandlist[buffer.command])){
				
			}else{
				command=commands[commandlist[buffer.command]];
			}
			
			let format = command[type=="set"?"setformat":type=="read"?"readformat":type=="answer"?"answerformat":"null"];
			
			//console.log(commands[]);
			
			[formd,data] = this.getFixed(format,command,information);
			
			let voids = formd.filter(f => data[f.param]).length;
			
			if(voids==0)ret=formd.map(f=>data[f]).flat();
			
		}else if(buffer.update){
			
			
			let utilityformat = this.findStruct(buffer.update,commands,information).filter(c => c.type==type);
			
			
			
			
			utilityformat=utilityformat.map(uty => {
				let fx = this.getFixed(uty.format,uty.command,information);
				let nnstatic = fx[0].filter(ff => fx[fx[0]]&&!buffer.update[ff]);
				let updated = {};
				fx[0].filter(ff => !fx[fx[0]]&&buffer.update[ff]).forEach(up => {
					updated[up]=toIntArray(this.conversionbyteformat(type,up,buffer.update[up],information[up],uty.format[fx[0].indexOf(up)].length));
				});
				return {fixed:fx[1],format:uty.format,reformat:fx[0],entries:uty.entries,nnstatic,updated};
			});
			
			if(utilityformat.length!=0&&utilityformat[0].nnstatic.length==0){
				
				let infos = {...utilityformat[0].fixed,...utilityformat[0].updated};
				let comm = utilityformat[0].reformat.map(re => infos[re]).flat();
				if(comm.indexOf(null)!=-1||comm.indexOf(undefined)!=-1)console.log(utilityformat);
				return comm;
				
				
			}
			
			//console.log(utilityformat);
			
		}
		
		return ret;
	}
	
	
	conversionbyteformat(type,key,value,information,lenght){
		
		if(information.type=="strint"){
			
			value = Math.min(Math.max(value, information.format[0]), information.format[1]);
			
			
			return value.toString().padStart(lenght, "0");
			
		}else if(information.decode&&information.format){
			
			return information.format[information.decode.indexOf(value)];
		}else if(information.decode&&information.setformat&&type=="set"){
			
			return information.setformat[information.decode.indexOf(value)];
		}else if(information.decode&&information.ansformat&&type=="answer"){
			
			return information.ansformat[information.decode.indexOf(value)];
		}else if(information.encodeType=="BCD5"){
			
			return encodeBCD5(value);
		}else if(information.preset){
			return information.preset;
		}
		
		console.log(key,value,information,lenght);
		
	}
	
	getFixed(format,command,information){
		let ret = {};
		let retF = [];
		let reformat = format.map(parm =>{return {code:parm.param,format:command[parm.param]?command[parm.param]:parm.param,reformat:command[parm.param]?information[command[parm.param]]:information[parm.param]}}).map(parm => {
			retF = [...retF,parm.format];
			let val = null;
			if(parm.reformat?.preset)val = toIntArray(parm.reformat.preset);
			if(parm.reformat?.format=="command")val = toIntArray(command["cmd"]);
			//return {...parm,val:val};
			if(val)return {[parm.format]:val};
		}).filter(parm => parm).forEach(parm => {ret={...ret,...parm};});
		
		//console.log(format,reformat);
		return [retF,ret];
	}
	findStruct(buffer,commandlist,information){
		let ret = [];
		Object.entries(commandlist).forEach(([key,cmd],index) => {
			if(Array.isArray(buffer)){
				
				let process = (type,format,loop) => {
					if(format.length!=0&&Array.isArray(format[0]))return format.forEach(fr => loop(type,fr,loop));
					let form = null;
					try{form=this.checkstruct(buffer,format);}catch(err){}
					if(form)form=validateformat(type,form,commandlist[key],information);
					if(form&&Object.entries(form).length!=0)ret.push({type,format:form});
				};
				
				process("set",cmd.setformat,process);
				process("read",cmd.readformat,process);
				process("answer",cmd.answerformat,process);
			}else{
				
				let process = (type,format,loop) => {
					if(format.length!=0&&Array.isArray(format[0]))return format.forEach(fr => loop(type,fr,loop));
					let form = null;
					let form2 = {};
					try{form=format.map(cc => cmd[cc.param]?cmd[cc.param]:cc.param)}catch(err){}
					try{format.forEach(cc => {form2[cmd[cc.param]?cmd[cc.param]:cc.param]=cc.length})}catch(err){}
					let updated = Object.entries(buffer).filter(([key,cmd],index) => form?.includes(key)).map(up => {
						//console.log(up,this.conversionbyteformat(type,up[0],up[1],information[up[0]],form2[up[0]]));
						let val = toIntArray(this.conversionbyteformat(type,up[0],up[1],information[up[0]],form2[up[0]]));
						if(!val)console.log(type,up[0],up[1],information[up[0]],form2[up[0]]);
						return {val,length:form2[up[0]]};
					});
					let err = updated.filter(up => !up||up.val.length!=up.length).length;
					//console.log(form,format,buffer,updated);
					let nset = updated.length;
					if(nset!=0&&err==0)ret.push({type,format,entries:nset,command:cmd});
				};
				
				process("set",cmd.setformat,process);
				process("read",cmd.readformat,process);
				process("answer",cmd.answerformat,process);
			}
		});
		return ret;
	}
	
	checkstruct(buffer,struct){
		let ret = {};
		let structlen = 0;
		let wild = false;
		struct.forEach(el => {
			if(el.length!="...")structlen+=el.length;else wild=true;
		});
		
		if(!wild&&structlen!=buffer.length||wild&&structlen>buffer.length)return null;
		let unkown = {start:0,end:buffer.length}
		let indexbuff=0;
		let index = 0;
		while(true){
			if(index>=struct.length||struct[index].length=="..."){unkown.start=indexbuff;break;}
			ret[struct[index].param]=buffer.slice(indexbuff,indexbuff+struct[index].length);
			
			indexbuff+=struct[index].length;
			index++;
		}
		index = struct.length-1;
		indexbuff=buffer.length-1;
		while(true){
			if(index<0||struct[index].length=="..."){unkown.end=indexbuff;break;}
			ret[struct[index].param]=buffer.slice(indexbuff-struct[index].length+1,indexbuff+1);
			
			indexbuff-=struct[index].length;
			index--;
		}
		
		let wildformat = struct.map((el,index) => {return {param:el.param,lenght:el.lenght,index}}).filter(el => el.param=="...");
		
		if(unkown.start<unkown.end)ret[wildformat.length==1?wildformat[0].param:"???"]=buffer.slice(unkown.start,unkown.end);
		
		return ret;
	}
	
}


function arraysEqual(a, b) {
    if (a === b) return true;                // stesso riferimento
    if (!a || !b) return false;              // uno dei due è null/undefined
    if (a.length !== b.length) return false; // lunghezza diversa

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;     // confronto elemento per elemento
    }
    return true;
}
function validateformat(type,formatted,commandlist,information){
	let ret = {}
	Object.entries(formatted).forEach(([key, list],index) => {
		let infkey = commandlist[key];
		if(!ret)return null;
		if(key === "undefined")return null;
		if(infkey&&information[infkey]){
			if(information[infkey].preset)if(!arraysEqual(list,toIntArray(information[infkey]?.preset)))ret = null;
			if(information[infkey]?.must==""){
			}else if(information[infkey]?.format=="command"){
				if(!arraysEqual(list,toIntArray(commandlist["cmd"])))ret = null;
			}else if(information[infkey]?.decode&&information[infkey]?.format){
				let forms = information[infkey].format.map((f,index) => {return{index:index,val:toIntArray(f)}}).filter(f => arraysEqual(f.val,list));
				if(forms.length!=0)ret[infkey?infkey:key]=information[infkey].decode[forms[0].index];else ret=null;
			}else if(information[infkey]?.setformat&&type=="set"){
				let forms = information[infkey].setformat.map((f,index) => {return{index:index,val:toIntArray(f)}}).filter(f => arraysEqual(f.val,list));
				if(forms.length!=0)ret[infkey?infkey:key]=(information[infkey].setdecode?information[infkey].setdecode:information[infkey].decode)[forms[0].index];else ret=null;
			}else if(information[infkey]?.ansformat&&type=="answer"){
				let forms = information[infkey].ansformat.map((f,index) => {return{index:index,val:toIntArray(f)}}).filter(f => arraysEqual(f.val,list));
				if(forms.length!=0)ret[infkey?infkey:key]=(information[infkey].ansdecode?information[infkey].ansdecode:information[infkey].decode)[forms[0].index];else ret=null;
			}else if(information[infkey]?.redformat&&type=="read"){
				let forms = information[infkey].redformat.map((f,index) => {return{index:index,val:toIntArray(f)}}).filter(f => arraysEqual(f.val,list));
				if(forms.length!=0)ret[infkey?infkey:key]=(information[infkey].reddecode?information[infkey].reddecode:information[infkey].decode)[forms[0].index];else ret=null;
			}else if(information[infkey]?.type=="strint"){
				let varb = list.map(car => String.fromCharCode(car)).join("");
				if (varb >= information[infkey].format[0] && varb <= information[infkey].format[1])ret[infkey?infkey:key]=Number(varb);else ret=null;
			}else if(information[infkey]?.decodeType=="BCD5"){
				let varb = decodeBCD5(list);
				if(information[infkey].format){if (varb >= information[infkey].format[0] && varb <= information[infkey].format[1])ret[infkey?infkey:key]=Number(varb);else ret=null;}
				else ret[infkey?infkey:key]=varb;
			}else ret[infkey?infkey:key]=list;
		}
	});
	return ret;
}
function decodeBCD5(bytes) {
    let result = "";
    for (const b of bytes) {
        const hi = (b >> 4) & 0x0F;
        const lo = b & 0x0F;
        result = hi.toString() + lo.toString() + result;
    }
    return parseInt(result);
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

    return bytes.reverse();
}

class COM{
	constructor(Port,Options) {
        this.port=Port;
		this.options = Options;
		this.optionsport = { baudRate: [Options.SerialSpeed] , stopBits: [Options.stopBits] , parity: [Options.parity] , dataBits: [Options.dataBits]};
		this.buff = [];
        this.queue = [];        // QUEUE DEI MESSAGGI
        this.isWriting = false; // FLAG
        this.interval = null;   // TIMER
        this.interval2 = null;   // TIMER2
		this.lock=true;
	}
	async open(){
		//console.log("open...",this.port,this.optionsport);
		if(!this.port)return;
		await this.port.open(this.optionsport);
		this._restartReader= () => {this.port.readable.pipeTo(new WritableStream({write: (bytes) => {
			const byte = getBytes(bytes);
			for (const biit of byte) {
				this.buff.push(biit);
			}
			this.interpreter?.(this.buff);
		}})).catch(err => {
			sendErrorToServer(err);
			this._restartReader();
		});};
		this._restartReader();
		// Write the message to the serial port
		//await writer.write(new TextEncoder().encode("IF;OI;FT;RM0;SC;"));
		this.interval = setInterval(() => this._processQueue(), this.options.awaitms);
		this.interval2 = setInterval(() => this._processR(), this.options.awaitms*20);
	}
	
	send(pack){
		if(pack.type=="direct"){
			this.write(toIntArray(pack.command));
		}else if(pack.type=="pack"){
			this.write(this.traslate?.(pack));
		}
	}
	
	drain(bytes){
		this.buff=this.buff.slice(bytes.length);
	}
	write(data) {
        if (!data||Array.isArray(data)&&data.length==0) return;
		if(Array.isArray(data)&&Array.isArray(data[0])) data.forEach(dataio => this.queue.push(dataio));
        else this.queue.push(data);
    }
	async _processR() {
		if(!this.options.loopreq)return;
		this.write(toIntArray(this.options.loopreq));
	}
	async _processQueue() {
        if (this.isWriting) return;      // già in scrittura
        if (this.queue.length === 0){
			if (!this.lock) {
				await this.writer.releaseLock();
				this.lock=true;
			}
			return; // niente da inviare
		}else if(this.lock){
			this.writer = this.port.writable.getWriter();
			this.lock=false;
		}
        this.isWriting = true;
        const msg = this.queue.shift();  // prendi il primo messaggio
        try {
            await this.writer.write(new Uint8Array(msg));
        } catch (e) {
            console.error("Errore scrittura seriale:", e);
        }
        this.isWriting = false;
    }
	async close() {
        clearInterval(this.interval);
        this.interval = null;
		clearInterval(this.interval2);
        this.interval2 = null;

        if (this.writer) {
            await this.writer.close();
            this.writer = null;
        }

        if (this.port) {
            await this.port.close();
        }
    }

}



function arrayStartsWith(buf, seq) {
    if (seq.length > buf.length) return false;
    for (let i = 0; i < seq.length; i++) {
        if (buf[i] !== seq[i]) return false;
    }
    return true;
}

function arrayEndsWith(buf, seq) {
    if (seq.length > buf.length) return false;
    const offset = buf.length - seq.length;
    for (let i = 0; i < seq.length; i++) {
        if (buf[offset + i] !== seq[i]) return false;
    }
    return true;
}

function toIntArray(x) {
    if (Array.isArray(x)) return x.map(n => {
		if(Array.isArray(n))return toIntArray(n);
		return Number(n);
	});
    if (typeof x === "string") return [...x].map(ch => ch.charCodeAt(0));
    return null;
}

export function toBytes(commL) {
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
class SpectrumExtractor {
  constructor(audioContext, source, bands = 32, minFreq = 0, maxFreq = 6400) {
    this.ctx = audioContext;
    this.source = source;
    this.bands = bands;
    this.minFreq = minFreq;
    this.maxFreq = maxFreq;

    // FFT
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.0;

    // collegamento
    this.source.connect(this.analyser);

    // buffer FFT
    this.fftBins = new Uint8Array(this.analyser.frequencyBinCount);

    // pre-calcolo frequenze per ogni bin
    this.binFreq = [];
    const sampleRate = this.ctx.sampleRate;
    const binCount = this.analyser.frequencyBinCount;

    for (let i = 0; i < binCount; i++) {
      this.binFreq[i] = (i * sampleRate) / (this.analyser.fftSize);
    }
  }

  getSpectrum() {
    // prendi FFT
    this.analyser.getByteFrequencyData(this.fftBins);

    // filtra solo la banda desiderata
    const filtered = [];
    for (let i = 0; i < this.fftBins.length; i++) {
      const f = this.binFreq[i];
      if (f >= this.minFreq && f <= this.maxFreq) {
        filtered.push({ freq: f, value: this.fftBins[i] / 255 });
      }
    }

    if (filtered.length === 0) return new Array(this.bands).fill(0);

    // raggruppa in N bande
    const bandSize = Math.floor(filtered.length / this.bands);
    const result = [];

    for (let b = 0; b < this.bands; b++) {
      let sum = 0;
      let count = 0;

      for (let i = b * bandSize; i < (b + 1) * bandSize && i < filtered.length; i++) {
        sum += filtered[i].value;
        count++;
      }

      result[b] = count ? sum / count : 0;
    }

    return result;
  }
}


export { websoketA,websoketB,COM,Interpreter,SpectrumExtractor };