import {run} from "./runner";
import { parseProgram } from "./parser";
import { augmentEnv, GlobalEnv } from "./compiler";
import { Value, Type } from "./ast";
import { NONE, PyValue } from "./utils";
import { tcStmts } from "./typecheck";

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
    var tp = await this.tc(source);
    console.log(result);
    return PyValue(tp, result);
  }
  async tc(source : string) : Promise<Type> { 
    const [ast_defs, ast_stmts] = parseProgram(source);
    if (ast_stmts.length == 0) return NONE;

    var newEnv:GlobalEnv = {
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

    var env = augmentEnv(newEnv, ast_defs);
    var typedAst = tcStmts(ast_stmts, env.types);
    return typedAst[typedAst.length-1].a;
  } 
}