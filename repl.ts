import {run} from "./runner";
import {emptyEnv, GlobalEnv, GlobalType} from "./compiler";

interface REPL {
  run(source : string) : Promise<any>;
  // tc(source : string) : Promise<Type>;
}

export class BasicREPL {
  currentEnv: GlobalEnv
  importObject: any
  memory: any
  constructor(importObject : any) {
    this.importObject = importObject;
    if(!importObject.js) {
      const memory = new WebAssembly.Memory({initial:10, maximum:20});
      this.importObject.js = { memory: memory };
    }
    this.currentEnv = {
      globals: new Map(),
      classes: new Map(),
      types: {
        method_param: new Map(),
        method_ret: new Map(),
        fields: new Map(),
        vars: new Map()
      },
      offset: 0
    };
  }
  async run(source : string) : Promise<any> {
    this.importObject.updateNameMap(this.currentEnv); // is this the right place for updating the object's env?
    const [result, newEnv] = await run(source, {importObject: this.importObject, env: this.currentEnv});
    this.currentEnv = newEnv;
    return result;
  }
  // async tc(source : string) : Promise<Type> { 

  // } 
}