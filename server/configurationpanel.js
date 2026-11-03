
import { getConfig,COM,Interpreter,requestSigninCode,sendErrorToServer,getPorts,SpectrumExtractor,storage,coordsToAddress } from '/tools.js';

import { RadioChoice } from '/startTools.js';


class ConfigurationPanel extends HTMLElement {
    constructor() {
		super();
		//this.confs = getConfig();
	}
	async connectedCallback() {
		console.log("connecting...");
		try{
		
		const code = await requestSigninCode();
		console.log("Codice:", code);

		
		
		this.parent=this.parentElement;
		//console.log(this.jsonConfig);
		
		//this.setup();
		
    } catch (error) {sendErrorToServer(error);}}
	disconnectedCallback() {
		this.parent.style.backgroundColor = "";
		this.parent.appendChild(document.createElement("configuration-panel"));
	}
	
	get settings(){
		
		console.log(this.confs["customConfigraw"]);
		let result = Object.fromEntries(Object.entries(this.confs["customConfigraw"]["sets"]).map(([key, {value}]) => [key, value]));
		console.log(result);
		return result;
	}
	async nativeConfig(){
		this.confs = await getConfig();
	}
	setup(){
		console.log("??");
		this.replaceChildren();
		let packages = document.createElement("radio-choice");
		this.sets = document.createElement("radio-choice");
		let hr = document.createElement("hr");
		hr.style.border= 0;
		hr.style.borderTop="1px solid #aaa";
		
		this.appendChild(packages);
		this.appendChild(hr);
		this.appendChild(this.sets);
		
		packages.noconferm=true;
		this.sets.noconferm=true;
		packages.options={packages:{element: "choice-select"},radioconfig:{element: "choice-input-select"}};
		this.sets.options={dataBits:{folder:"com"},parity:{folder:"com"}};
		//this.sets.sections(this.confs.configsections);
		packages.items={packages:this.confs["radiopackagelist"],radioconfig:[]};
		this.sets.items={};
		packages.changeEvent= async (key,value,list,alls,oldvalue) => {
			console.log(key,value);
			this.confs["customConfigraw"]["packages"]=alls;
			if(key=="packages"){
				//console.log("change",key,value,this.confs["packages"]);
				let funK=(await (this.confs["packages"][value]).keys);
				packages.items["radioconfig"]=funK() ?? [];
				let change = await this.confs["packages"][value][packages.items["radioconfig"][0]]
				if(!change){
					let funK=(await (this.confs["packages"][oldvalue]).keys);
					packages.items["radioconfig"]=funK() ?? [];
					packages.setCurrentSelection({packages:oldvalue});
					return;
				}
				await this.setoptions(change);
				this.confs["customConfigraw"]["packages"]={packages:{value},radioconfig:{value:packages.items["radioconfig"][0]}};
				packages.setCurrentSelection(this.confs["customConfigraw"]["packages"]);
				//this.querySelector("#package").items["radioconfig"]=this.confs["radiopackagelist"][value];
				//console.log(this.querySelector("#package")._items);
				//console.log(value,this.confs["packages"][value].entries)
			}
			if(key=="radioconfig"){
				//console.log(alls["packages"],this.confs);
				let pack = await this.confs["packages"][alls["packages"].value];
				if(((await pack.keys)()).some(V=>{console.log(V);return V===value;}))await this.setoptions(await pack[value]);
			}
		}
		packages.creationEvent= async (key,value,list,alls,oldvalue) => {
			//console.log(key,value,".....",list,",",alls,oldvalue);
			//console.log(this.confs);
			if(key=="radioconfig"){
				if(!this.confs["packages"]["own"].includes(value)&&oldvalue!=''){
					//console.log("creation",key,value,list);
					//this.querySelector("#package").items["radioconfig"]=this.confs["radiopackagelist"][value];
						
					this.confs["packages"]["own"][value]=JSON.parse(JSON.stringify(await this.confs["packages"][alls["packages"].value][oldvalue]));
					//console.log(await this.confs["packages"][alls["packages"].value][oldvalue],JSON.parse(JSON.stringify(this.confs["packages"][alls["packages"].value][oldvalue])),JSON.stringify(this.confs["packages"][alls["packages"].value][oldvalue]));
					await this.setoptions(await this.confs["packages"]["own"][value]);
					
					//console.log(JSON.stringify(new Proxy({ciaoo:"oooo"},{get:(i,o)=>{console.log(i,o);}})));
					
					
				}else return false;
				packages.items["radioconfig"]=(await this.confs["packages"]["own"].keys)();
				packages.setCurrentSelection({packages:{value:"own"},radioconfig:{value}});
				return true;
			}else return false;
		}
		
		if(!this.confs["customConfigraw"]){
			this.confs["customConfigraw"]={};
			packages.changeEvent("packages",this.confs["radiopackagelist"][0]);
		}else{
			packages.setCurrentSelection(this.confs["customConfigraw"]["packages"]);
			if(this.confs["customConfigraw"]["sets"])this.sets.setCurrentSelection(this.confs["customConfigraw"]["sets"]);
			else new Promise(async (resolve, reject) => {
				let change = await this.confs["packages"][this.confs["customConfigraw"]["packages"]["packages"].value][this.confs["customConfigraw"]["packages"]["radioconfig"].value];
				if(change){await this.setoptions(change);resolve()}else reject();
			});
		}
		console.log("old:",this.confs["customConfigraw"]["packages"]);
		console.log("old:",this.confs["customConfigraw"]["sets"]);
		
		
	}
	translator(data,result,folder,options){
		//console.log(data);
		if(!folder)folder=[];
		if(!result)result=[];
		if(!options)options=this.confs.configoptions;
		
		//console.log(options,typeof options);
		
		if(data)try{
		Object.entries(data).forEach(([name,list])=>{
			//console.log(name,list);
			if(options[name]){
				//console.log(options[name].element.type);
				if(options[name].element.element)result.push([name,folder,list,options[name]]);
				if(options[name].element.type==="folder"){
					this.translator(list,result,[...folder,name],options[name].content);
					
				}
			}else if(typeof options == "string")result.push([name,folder,list,options]);
		});
		}catch(e) {console.log(e)}
		return result;
	}
	async setoptions(json){
		console.log(json);
		console.log(json.keys());
		this.confs["customConfigraw"]["sets"] = {};
		console.log(this.confs.configoptions);
		
		let items = this.translator(Object.fromEntries(json.entries.filter(([name,list])=>!json.isProtocol(name))));
		//console.log(items);
		this.sets.items={}
		this.sets.options={}
		items.forEach(([name,folder,value,options])=>{
			//console.log(name,folder,value,options);
			
			let setsoption = folder.length==0?this.sets.options:this.sets.folder(folder).options;
			let setitems = folder.length==0?this.sets.items:this.sets.folder(folder).items;
			
			if(setsoption)setsoption[name]=options.element??options;
			if(setitems)setitems[name]=options.sets??[];
			//console.log(name,value);
			this.sets.setCurrentSelection({[name]:{value}},folder);
			try{this.confs["customConfigraw"]["sets"][name]={value,options:setsoption[name],items:setitems[name]};}catch(e){}
		});
		this.sets.changeEvent=async (key,value,list,alls,oldvalue) => {
			this.confs["customConfigraw"]["sets"][key].value=value;
		};
		
		this.confs["customConfigraw"]["sets"]=this.sets.getCurrentSelection(this.confs["customConfigraw"]["sets"]);
		
		console.log(items);
	}
	
}
customElements.define("configuration-panel", ConfigurationPanel);
if (!customElements.get("radio-choice")) {
  customElements.define("radio-choice", RadioChoice);
}

