// This is a mashup of tutorials from:
//
// - https://github.com/AssemblyScript/wabt.js/
// - https://developer.mozilla.org/en-US/docs/WebAssembly/Using_the_JavaScript_API

import wabt from 'wabt';
import { Value } from './ast';
import * as compiler from './compiler';
import {parseProgram} from './parser';
import { NUM, PyValue } from './utils';

// NOTE(joe): This is a hack to get the CLI Repl to run. WABT registers a global
// uncaught exn handler, and this is not allowed when running the REPL
// (https://nodejs.org/api/repl.html#repl_global_uncaught_exceptions). No reason
// is given for this in the docs page, and I haven't spent time on the domain
// module to figure out what's going on here. It doesn't seem critical for WABT
// to have this support, so we patch it away.
if(typeof process !== "undefined") {
  const oldProcessOn = process.on;
  process.on = (...args : any) : any => {
    if(args[0] === "uncaughtException") { return; }
    else { return oldProcessOn.apply(process, args); }
  };
}

export async function run(source : string, config: any) : Promise<[Value, compiler.GlobalEnv]> {
  const wabtInterface = await wabt();
  const [parsed_defs, parsed_stmts] = parseProgram(source);
  var returnType = "";
  var returnVal = "";
  console.log("source: " + source);
  console.log("len "+parsed_defs.length);
  console.log("len "+parsed_stmts.length);
  if (parsed_stmts.length > 0 ){
    var laststmt = parsed_stmts[parsed_stmts.length - 1];
    if( laststmt.tag == "expr" || laststmt.tag == "if" || laststmt.tag == "while") {
      returnType = "(result i32)";
      returnVal = "(local.get $$None)"
    }
  }
  const compiled = compiler.compile(source, config.env);
  const importObject = config.importObject;
  if(!importObject.js) {
    const memory = new WebAssembly.Memory({initial:10, maximum:100});
    importObject.js = { memory: memory };
  }
  var funcTable = `(table ${compiled.newEnv.table.length} funcref)`;
  var elem =  `(elem (i32.const 0)`
  for (let index = 0; index < compiled.newEnv.table.length; index++) {
    elem += ` $${compiled.newEnv.table[index]}`
  }
  elem += `)`;
  const wasmSource = `(module
    (func $print (import "imports" "print") (param i32))
    (func $print_bool (import "imports" "print_bool") (param i32))
    (func $print_none (import "imports" "print_none") (param i32))
    (import "js" "memory" (memory 1))
    (type $return_i32 (func (result i32)))
    ${funcTable}
    ${compiled.funcs}
    ${elem}
    (func (export "exported_func") ${returnType}
      ${compiled.wasmSource} 
      ${returnVal}
    )
  )`;
  console.log(wasmSource);
  const myModule = wabtInterface.parseWat("test.wat", wasmSource);
  var asBinary = myModule.toBinary({});
  var wasmModule = await WebAssembly.instantiate(asBinary.buffer, importObject);
  const result = (wasmModule.instance.exports.exported_func as any)();
  return [PyValue(NUM, result), compiled.newEnv];
}