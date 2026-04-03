const windowparams = new URLSearchParams(window.location.search);

function deepMerge(target, source) {
    for (const key in source) {
        const srcVal = source[key];
        const tgtVal = target[key];

        // Se entrambi sono array → concatena
        if (Array.isArray(srcVal) && Array.isArray(tgtVal)) {
            target[key] = [...tgtVal, ...srcVal];
        }

        // Se entrambi sono oggetti → merge ricorsivo
        else if (
            srcVal &&
            typeof srcVal === "object" &&
            !Array.isArray(srcVal) &&
			!(srcVal instanceof HTMLElement)
        ) {
            if (!tgtVal || typeof tgtVal !== "object") {
                target[key] = {};
            }
            deepMerge(target[key], srcVal);
        }

        // Altrimenti → sovrascrivi
        else {
            target[key] = srcVal;
        }
    }
    return target;
}

let back = document.getElementById("back");
let log = document.getElementById("log");
back.innerHTML = `<span class="type">Back</span>`;
back.onclick= (e) => {
	//console.log("onclick");
	log.back();
};

class logger extends HTMLElement {
	constructor() {
		super();
		this.addEventListener("click", (event) => {
			if(event.target.nodeName=="BUTTON"){
				this.treepos.push(event.target.closest("li-log").data.detail);
				this.timeline();
				
				return;
				
			}
			this.treepos.push(event.target.closest("li-log").data.detail);
			this.charge();
		});
		this.tree = {};
		this.treepos = [];
	}
    connectedCallback() {
		this.ws = new WebSocket(((location.protocol === "https:")?'wss://':'ws://') + window.location.host + '/monitor/events?login='+windowparams.get("login"));
		this.ws.onmessage = this.update.bind(this);
		
	}
	disconnectedCallback() {
		this.ws.close(1000, "Normal closure");
		this.ws=null;
	}
	back(){
		//console.log("back");
		this.treepos.pop(this.treepos.length-1)
		this.charge();
	}
	timeline(){
		let branch = this.tree;
		//console.log(this.tree);
		this.treepos.forEach((br,i) => {branch = branch[br]});
		//console.log(this.treepos,branch);
		if(!branch){this.back();return;}
		this.replaceChildren();
		
		//window.scrollTo(0, document.body.scrollHeight);
	}
	charge(){
		
		let branch = this.tree;
		//console.log(this.tree);
		this.treepos.forEach((br,i) => {branch = branch[br]});
		//console.log(this.treepos,branch);
		if(!branch){this.back();return;}
		
		let newchilds = [];
		
		Object.entries(branch).forEach(([key,el],i) => {
			//console.log(this,key,el,i);
			if(key!="element"&&key!="elements"&&el.element)newchilds.push(el.element);
			if(key=="elements")el.forEach(els => newchilds.push(els));
			
		});
		
		[...this.children].forEach(child => {if(!newchilds.includes(child))this.removeChild(child)});
		
		let adds = newchilds.filter(child => !this.contains(child));
		
		adds.forEach(aa => this.appendChild(aa));
		console.log(adds.length);
		//window.scrollTo(0, document.body.scrollHeight);
		this.search();
	}
	resolve(json,brnch,path){
		
		if(!("data" in json))Object.entries(json).forEach(([key,el]) => {//.filter([key,i] => key!=""
			if(!brnch[key])brnch[key]={elements:[],element:null};
			brnch[key]=this.resolve(el,brnch[key],key);
			
			const li = document.createElement("li-log");
			li.charge({type:path?path:"general",detail:key});
			
			if(!brnch[key]?.element)brnch[key].element=li;
			
			if("data" in el){
				//console.log(el);
				const li2 = document.createElement("li-log");
				li2.charge({type:key,data:el.data});
				
				brnch[key].elements.push(li2);
			}
		});
		return brnch;
	}
	search(branch,loop){
		if(!branch&&!loop){this.search(this.tree,this.search);return;}
		let updates = 0;
		Object.entries(branch).forEach(([key, br]) => {if(br){
			let alup = 0;
			if(!("data" in br)){
				let up = loop(br, loop);
				alup+=up;
					
					
			}
			br.element?.update("elementslen",br.elements.length+Object.entries(br).length-2);
				
			br.elements?.forEach(el => {if(el.isnew())alup+=1;});
			br.element?.update("numupdate",alup);
			updates+=alup;
			if(br.element?.isnew())updates+=1;
		
		}});
		return updates;
	}
	update(e){
		const msg = JSON.parse(e.data);
		if(msg.type=="update")this.tree= this.resolve(msg.data,this.tree);
		
		this.search();
		
		console.log(this.tree);
		this.charge();
	}
}
class lilogger extends HTMLElement {
    constructor() {
        super();
        this.data = {
            type: null,
            detail: null,
            times: []
        };
    }
	
	update(varN,newvar){
		if(varN=="elementslen" && this.querySelector("#elementslen")){
			this.querySelector("#elementslen").innerHTML=newvar;
		}else if(varN=="numupdate"&&this.querySelector("#numupdate")){
			this.querySelector("#numupdate").innerHTML=newvar;
			this.querySelector("#numupdate").toggleAttribute("invisible",newvar==0);
		}
	}
	
	
    connectedCallback() {
        this.className = "event";
		//this.connected
    }
	disconnectedCallback(){
		this.querySelector("#newelm")?.parentElement.removeChild(this.querySelector("#newelm"));
	}
	isnew(){
		if(this.querySelector("#newelm"))return true;
		return false;
	}
    charge(event) {
        if (event) {
            if (!this.data.type) this.data.type = event.type;
            if (!this.data.detail) this.data.detail = event.detail || event.data.msg;

            this.data.times.push(this.data.time);
        }

        this.render();
    }
	
    render() {
        const timeline = this.data.times
            .map(t => `<span class="dot" title="${new Date(t).toLocaleTimeString()}"></span>`)
            .join("");

        this.innerHTML = `<div style="display:block;">
            <span class="type">${this.data.type}</span>→ ${this.data.detail} <span id="newelm">new</span> <span invisible id="numupdate"></span> <span id="elementslen"></span>
			<button class="view" style="position:relative;top:50%;right:-1%;background: #333;">👁</button>
            <div class="timeline">${timeline}</div>
			</div>
        `;
    }
}

customElements.define("ul-log", logger);
customElements.define("li-log", lilogger);
