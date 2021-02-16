import {run} from "./runner";
import { parseProgram } from "./parser";
import {emptyEnv, GlobalEnv, GlobalType} from "./compiler";
import { Value, Type } from "./ast";
import { NONE } from "./utils";

interface REPL {
  run(source : string) : Promise<Value>;
  tc(source : string) : Promise<Type>;
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
      default: new Map(),
      methods: new Map(),
      tableIndex: new Map(),
      table: [],
      types: {
        method_param: new Map(),
        method_ret: new Map(),
        fields: new Map(),
        vars: new Map()
      },
      offset: 1 // 0 is heap offset
    };
  }
  async run(source : string) : Promise<Value> {
    const [result, newEnv] = await run(source, {importObject: this.importObject, env: this.currentEnv});
    this.currentEnv = newEnv;
    return result;
  }
  async tc(source : string) : Promise<Type> { 
    const ast = parseProgram(source);
    return NONE;
  } 
}