class RadioChoiceGrid extends HTMLElement {
	
	constructor() {
        super();
		this._items = {};
        this.options = {};
    }
	set items(items) {
        this._items = items || {};
		this.closest("radio-choice").loadItemsIntoPanel();
    }
	get items() {

        return new Proxy(this._items, {

            get: (target, key) => {

                if (key === "entries")
                    return Object.entries(target);

                if (key === "keys")
                    return Object.keys(target);
				
                return target[key];
            },

            set: (target, key, value) => {

                target[key] = value;
				//console.log("load");
				this.closest("radio-choice").loadItemsIntoPanel();
                return true;
            }

        });

    }
	
}
class RadioChoice extends HTMLElement {

    constructor() {
        super();
    }
	
	get options(){
		const grid = this.querySelector("#grid");
		return grid.options;
	}
	set options(options){
		const grid = this.querySelector("#grid");
		grid.options = options;
	}
	
    set items(items) {
        //this._items = items || {};
		const grid = this.querySelector("#grid");
		grid.items = items;
    }

    get items() {
		const grid = this.querySelector("#grid");
		return grid.items;
    }
	
	folder(tree){
		
		let folder = this.querySelector("#grid");
		
		tree?.forEach(branch=>{
			folder=this.story(folder).items[branch].grid;
		});
		
		return folder;
	}
	
    story(container) {

        const result = {};

        Array.from(container.children).forEach(el => {

            if (el.key)
                result[el.key] = el;

        });

        return {
            items: result,
            keys: Object.keys(result)
        };
    }

    loadItemsIntoPanel(grid) {

        if(!grid)grid = this.querySelector("#grid");
        if(!grid)return;

        const currentSelection =
            this.getCurrentSelection();

        let currentKeys =
            this.story(grid).keys;

        const newKeys =
            grid.items.keys;
		
		//console.log("load",grid);
		
        currentKeys
            .filter(key => !newKeys.includes(key))
            .forEach(key => {

                const node =
                    this.story(grid).items[key];

                node?.remove();

            });

        currentKeys =
            this.story(grid).keys;
		//console.log(currentKeys,newKeys);
        newKeys
            .filter(key => !currentKeys.includes(key))
            .forEach(key => {
                const tagName =
                    typeof grid.options[key] == "string"?grid.options[key]:grid.options[key]?.element;
				//console.log(key,tagName,grid.options);

                if (!tagName)
                    return;

                const element =
                    document.createElement(tagName);
                element.key = key;
                element.dataset.key = key;
				//console.log("element append", key);
                grid.appendChild(element);
				

            });

        newKeys.forEach(key => {

            const element =
                this.story(grid).items[key];

            if (!element)
                return;

            if (typeof element.charge === "function") {
				//console.log(this._items,key);
                element.charge({
                    key,
                    items: grid._items[key],
                    options: grid.options[key]
                });

            }
			//console.log(grid.options[key]?.element);
			if(grid.options[key]?.element=="choice-folder")this.loadItemsIntoPanel(element.grid);

        });

        const rows = Math.max(newKeys.length, 1);

        //grid.style.gridAutoRows =
        //    `calc(100% / ${rows})`;

        this.setCurrentSelection(
            currentSelection
        );
    }

    connectedCallback() {

        this.innerHTML = `
			<style>
				radio-choice input, radio-choice select{
					padding: 8px;
				}
				radio-choice-grid{display:grid;grid-template-columns: minmax(0, 1fr)}
				radio-choice-grid[hide], div[hide]{display:none;}
				resize-input{display:block;position:relative;}
				resize-input[hide]{display:none;}
				div[hide]{display:none;}
				span[measure]{
					opacity: 0;
					white-space: pre;
				}
			</style>
            <radio-choice-grid id="grid" style="display:grid;height:100%;"></radio-choice-grid>
        `;
		
        const grid =
            this.querySelector("#grid");

        const cols = 1;

        grid.style.gridTemplateColumns =
            `repeat(${cols},1fr)`;

        grid.style.minHeight = "100%";
		grid.addEventListener("change", event => {
		 
			const component = event.target;
			
			const key = component._data?.key;
			if(!key)return; 
			this.changeEvent?.(
			key,
			event.detail.value,
			component._data.items,
			this.getCurrentSelection(),
			event.detail.oldvalue
			);
		 
		});
		grid.addEventListener("creation", event => {
		 
			const component = event.target;
			
			const key = component._data?.key;
			if(!key)return; 
			this.creationEvent?.(
			key,
			event.detail.value,
			component._data.items,
			this.getCurrentSelection(),
			event.detail.oldvalue
			);
		 
		});
        this.loadItemsIntoPanel();
    }

    getCurrentSelection(data,grid) {
        const result = data ?? {};
		
        (grid??this.querySelector("#grid")).querySelectorAll(":scope > *")
            .forEach(element => {

                const key =
                    element.dataset.key;
				
                if (!key)
                    return;

                if (
                    typeof element.getData === "function"
                ) {

                    if(result[key])result[key] = element.getData();
                    else result[key] = element.getData();
					
                }
				if(element.nodeName == "CHOICE-FOLDER"){
					if(!result[key])result[key]={};
					result[key]["folder"]=this.getCurrentSelection(data?data[key].folder:{},element.grid);
					
				}
				//console.log(key,element.nodeName,grid?.nodeName,result[key]);
            });

        return result;

    }

    setCurrentSelection(data,folder) {
		const grid = this.folder(folder);
		data = {...data};
        grid.querySelectorAll(":scope > *")
            .forEach(element => {
				//console.log(element);
                const key =
                    element.dataset.key;

                if (!key)
                    return;

                if (
                    typeof element.setValue === "function" && data[key]
                ) {
					//if(typeof data[key].value!="string")console.log("set",key,"to",data[key].value);
					element.setValue(
                        data[key].value//typeof data[key].value=="string"?data[key].value:"nostring"
                    );

                }
				if(element.nodeName == "CHOICE-FOLDER"){
					//console.log(data,key);
					this.setCurrentSelection(data?data[key]?.folder:{},folder?[...folder,key]:[key]);
				}
				delete data[key];

            });
		Object.keys(data).forEach((key)=>{
			if(data[key].options&&data[key].items){
				grid.options[key]=data[key].options;
				if(data[key].items)grid.items[key]=data[key].items;
			}else delete data[key];
		});
		if(Object.keys(data).length)this.setCurrentSelection(data,folder)
    }

}

class ChoiceSelect extends HTMLElement {

    constructor() {
        super();
    }

    connectedCallback() {

        this.innerHTML = `
            <div style="display:flex;height:100%;align-items:center;">
                <label style="width:25%;" id="label"></label>
                <select style="flex:1;" id="select"></select>
            </div>
        `;
		this.oldvalue=this.getData().value;
		this.querySelector("#select")
		.addEventListener("change", () => {
		 
			this.dispatchEvent(
			new CustomEvent("change", {
			detail: {value:this.getData().value,oldvalue:this.oldvalue},
			bubbles: true
			})
			);
			this.oldvalue=this.getData().value;
			 
		});
    }

    charge(data) {

        this._data = data;

        this.querySelector("#label").textContent =
            data.options?.label ?? data.key;

        const select =
            this.querySelector("#select");

        select.innerHTML = "";
        (data.items ?? []).forEach(item => {

            const option =
                document.createElement("option");

            option.value = item;
            option.textContent = item;

            select.appendChild(option);

        });

    }

    getData() {
		
        return {value:this.querySelector("#select").value,index:this.querySelector("#select").selectedIndex};
		
    }

    setValue(value) {

        this.querySelector("#select").value =
            value ?? "";

    }

}

class ChoiceInputSelect extends HTMLElement {

    constructor() {
        super();
    }

    connectedCallback() {

        this.innerHTML = `
            <div style="display:flex;height:100%;align-items:center;">
                <label style="width:25%;" id="label"></label>
                <input
					type="text"
                    style="flex:1;"
                    list=""
                    id="input"
                >
                <datalist id="list"></datalist>
            </div>
        `;
		this.oldvalue=this.getValue();
        this.querySelector("#input")
            .setAttribute(
                "list",
                this.querySelector("#list").id
            );
		this.querySelector("#input")
		.addEventListener("change", () => {
			
			const value = this.querySelector("#input").value;
 
			const exists = [...this.querySelector("#list").options]
			.some(option => option.value === value);
			
			
			this.dispatchEvent(
			new CustomEvent(exists ? "change" : "creation", {
			detail: {value:this.getValue(),oldvalue:this.oldvalue},
			bubbles: true
			})
			);
			this.oldvalue=this.getValue();
		});
    }
    charge(data) {

        this._data = data;

        this.querySelector("#label").textContent =
            data.options?.label ?? data.key;

        const list =
            this.querySelector("#list");

        list.innerHTML = "";
		//console.log(data);
        (data.items ?? []).forEach(item => {

            const option =
                document.createElement("option");

            option.value = item;

            list.appendChild(option);

        });

    }

    getData() {

        return {value:this.querySelector("#input").value};

    }

    setValue(value) {

        this.querySelector("#input").value =
            value ?? "";

    }

}

class ChoiceDisplay extends HTMLElement {

    constructor() {
        super();
    }

    connectedCallback() {

        this.innerHTML = `
            <div style="display:flex;height:100%;align-items:center;">
                <label style="width:25%;" id="label"></label>
                <span style="flex:1;" id="value"></span>
            </div>
        `;

    }

    charge(data) {

        this._data = data;

        this.querySelector("#label").textContent =
            data.options?.label ?? data.key;

        this.setValue(
            Array.isArray(data.items)
                ? (data.items[0] ?? "")
                : data.items
        );

    }

    getData() {

        return {value:this.querySelector("#value").textContent};

    }

    setValue(value) {

        this.querySelector("#value").textContent =
            value ?? "";

    }

}

class ChoiceFolder extends HTMLElement {

    constructor() {
        super();
    }

    connectedCallback() {

        this.innerHTML = `
            <div id="button0">
                <label style="width:25%;" id="label"></label>
            </div>
			<radio-choice-grid id="content">
                
            </radio-choice-grid>
			<div id="button1" style=>
                <label style="width:25%;" id="labelf"></label>
            </div>
        `;
		this.querySelectorAll("#button0, #button1").forEach(el=>{el.onclick=() => {
			
			this.querySelectorAll("#content, #button1").forEach(el2=>el2.toggleAttribute("hide"));
			
/* 			this.dispatchEvent(
			new CustomEvent("buttonclick", {
			detail: {value:this._data.options?.label ?? this._data.key},
			bubbles: true
			})
			); */
		}});
    }
	get grid(){
		return this.querySelector("#content");
	}
    charge(data) {
		//console.log(data);
        this._data = data;

        this.querySelector("#label").textContent =
            data.options?.label ?? data.key;
		this.querySelector("#labelf").textContent =
            data.options?.label ?? data.key;

/*         this.setValue(
            Array.isArray(data.items)
                ? (data.items[0] ?? "")
                : data.items
        ); */
    }

}

class ResizeInput extends HTMLElement {
	constructor() {
        super();
    }
	
	connectedCallback() {

        const input = document.createElement("input");
		input.setAttribute("type","text");
        const span = document.createElement("span");
		
		input.style.width = "100%";
		input.style.boxSizing = "border-box";
		span.style.position="absolute";
		input.style.position="absolute";
		input.id="input";
		
		span.toggleAttribute("measure");
		span.textContent = "eeeeeeeee";
		span.style.height = "35px";
		span.style.width = "max-content";
		this.append(span);
		this.append(input);
		const style = getComputedStyle(input);
		let render = ()=>{
			span.textContent = input.value || " ";
			span.style.font = style.font;
			const width =
			span.offsetWidth +
			parseFloat(style.paddingLeft) +
			parseFloat(style.paddingRight) +
			parseFloat(style.borderLeftWidth) +
			parseFloat(style.borderRightWidth);
			
			this.style.width=width + "px";
			this.style.height=span.offsetHeight + "px";
		};
		input.addEventListener("input", render);
		input.value=this._value||"";
		render();
	}
	set value(val){
		this._value = val;
		let inp = this.querySelector("#input");
		if(inp)inp.value=val;
	}
}


class ChoiceInformationEditor extends HTMLElement {
	constructor() {
        super();
    }
	charge(data){
		this.subdata=data;
	}
    setValue(value){
        this._data = value;
        this.render();
    }
	getValue(){return this._data;}
    render() {

        const d = this._data;

        this.innerHTML = `<label id="label">${this.subdata.key}<label><br>`;

        if (d.setformat && d.ansformat && d.decode) {
            this.append(this.renderSetAnsDecode(d));
        }
        else if (d.format && d.decode) {
            this.append(this.renderSetAnsDecode(d));
        }

        if (d.type) {
            this.append(this.renderType(d));
        }

        if (d.preset !== undefined || d.must !== undefined) {
            this.append(this.renderPresetMust(d));
        }
    }


    renderSetAnsDecode(data) {
        const overflower = document.createElement("div");
		overflower.style.width="100%";
        const wrapper = document.createElement("div");
		overflower.append(wrapper);
		let fordec = ["format","setformat","ansformat","setdecode","ansdecode","decode"];
		wrapper.style.display="inline-grid";
		overflower.style.overflowY = "hidden";
		let rows = 0;
		fordec.forEach(typefd => {rows = Math.max(rows,data[typefd]?.length ?? 0);});
		
		for(let i = 0;i<rows;i++){
			const row = document.createElement("div");
			row.style.display="grid";
			row.style.gridColumn =i+1;
			row.style.justifyItems= "center";
			wrapper.append(row);
			fordec.forEach((typefd,index) => {
				const fordecin = document.createElement("resize-input");
				fordecin.setAttribute("data-index",i);
				fordecin.setAttribute("datafd-key",typefd);
				fordecin.style.gridRow =index+1;
				row.append(fordecin);
				if(!data[typefd])fordecin.toggleAttribute("hide");
				else{ 
					fordecin.value=data[typefd][i];
				}
			});
		}
		
		
        return overflower;
    }

    renderType(data) {

        const wrapper = document.createElement("div");

        wrapper.innerHTML = `
            <label>
                Type
                <input type="text" value="${data.type}">
            </label>
        `;

        return wrapper;
    }

    renderPresetMust(data) {

        const wrapper = document.createElement("div");

        wrapper.innerHTML = `
            <label>
                Preset
                <input type="text" value="${data.preset ?? ""}">
            </label>

            <label>
                Must
                <input type="text" value="${data.must ?? ""}">
            </label>
        `;

        return wrapper;
    }
	
}
class ChoiceButton extends HTMLElement {

    constructor() {
        super();
    }

    connectedCallback() {

        this.innerHTML = `
            <div style="display:flex;height:100%;margin:1px;">
                <button id="button" style="position: relative;left:25%;width:50%;"></button>
            </div>
        `;
		this.querySelector("#button").onclick=() => {
			this.dispatchEvent(
			new CustomEvent("buttonclick", {
			detail: {value:this._data.options?.label ?? this._data.key},
			bubbles: true
			})
			);
		};
    }
    charge(data) {

        this._data = data;

        this.querySelector("#button").innerHTML =
            data.options?.label ?? data.key;
		
    }
}


customElements.define("choice-folder", ChoiceFolder);
customElements.define("choice-information-editor", ChoiceInformationEditor);
customElements.define("radio-choice", RadioChoice);
customElements.define("radio-choice-grid", RadioChoiceGrid);
customElements.define("resize-input", ResizeInput);

customElements.define(
    "choice-input-select",
    ChoiceInputSelect
);
customElements.define(
    "choice-select",
    ChoiceSelect
);
customElements.define(
    "choice-display",
    ChoiceDisplay
);
customElements.define(
    "choice-button",
    ChoiceButton
);

export { RadioChoice };