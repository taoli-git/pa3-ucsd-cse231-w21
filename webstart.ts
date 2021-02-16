import {BasicREPL} from './repl';
import {emptyEnv, GlobalEnv} from './compiler';
import {convert} from './runner';
import { output } from './webpack.config';
import { BOOL, NONE, NUM } from './utils';
import { Type } from './ast';


function webStart() {
  document.addEventListener("DOMContentLoaded", function() {
    function stringify(typ: Type, arg: any): string {
      switch (typ.tag) {
        case "number":
          return (arg as number).toString();
        case "bool":
          return (arg as boolean) ? "True" : "False";
        case "none":
          return "None";
        case "class":
          return typ.name;
      }
    }
    function print(typ: Type, arg: any): any {
      console.log("Logging from WASM: ", arg);
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      arg = convert(arg);
      if (arg == null){
        throw new Error("Invalid argument\nExited with error code 1");
      }
      elt.innerText = toString(arg);
      
      //elt.innerText = stringify(typ, arg);
      return arg;
    }

    var importObject = {
      imports: {
        print: (arg: any) => print(NUM, arg),
        print_num: (arg: number) => print(NUM, arg),
        print_bool: (arg: number) => print(BOOL, arg),
        print_none: (arg: number) => print(NONE, arg),
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        pow: Math.pow,
      },
    };
    const env = emptyEnv;
    var repl = new BasicREPL(importObject);

    function renderResult(result : any) : void {
      if(result === undefined) { console.log("skip"); return; }
      const elt = document.createElement("pre");
      result = toString(result);
      // result = convert(result);
      if (result == null){
        return;
      }
      // else if (result === true) {
      //   result = "True"
      // }
      // else if (result === false) {
      //   result = "False"
      // }
      // else {
      //   result = String(result);
      // }
      document.getElementById("output").appendChild(elt);
      elt.innerText = result;
    }

    function renderError(result : any) : void {
      const elt = document.createElement("pre");
      document.getElementById("output").appendChild(elt);
      elt.setAttribute("style", "color: red");
      elt.innerText = String(result);
    }

    const replCodeElement = document.getElementById("next-code") as HTMLInputElement;

    function setupRepl() {
      document.getElementById("output").innerHTML = "";
      replCodeElement.addEventListener("keypress", callback);
    }

    function callback (e: any) {      
      if(e.key === "Enter" && !(e.shiftKey)) {
        const output = document.createElement("div");
        const prompt = document.createElement("span");
        prompt.innerText = "»";
        output.appendChild(prompt);
        const elt = document.createElement("textarea");
        // elt.type = "text";
        elt.disabled = true;
        elt.className = "repl-code";
        output.appendChild(elt);
        document.getElementById("output").appendChild(output);
        const source = replCodeElement.value;
        elt.value = source;
        replCodeElement.value = "";
        console.log(source)
        repl.run(source).then((r) => { renderResult(r); console.log ("run finished") })
            .catch((e) => { renderError(e); console.log("run failed", e) });;
      }
    };
    document.getElementById("run").addEventListener("click", function (e) {
      repl = new BasicREPL(importObject);
      const source = document.getElementById("user-code") as HTMLTextAreaElement;
      // document.getElementById("next-code").removeEventListener("keypress", callback);
      setupRepl();
      console.log(source.value);
      repl.run(source.value).then((r) => { renderResult(r); console.log ("run finished") })
          .catch((e) => { renderError(e); console.log("run failed", e) });;
    });
  });
}

webStart();

// function convert(arg: any){
//   var temp = BigInt.asIntN(64, arg);
//   var high = Number(BigInt.asIntN(32, temp / BigInt(1n << 40n)));
//   console.log("high: ",high);
//   var low = Number(BigInt.asIntN(32, temp & ((1n << 40n) - 1n)));
//   console.log("low: ",low)
//   if (high > 1) {
//     arg = null;
//   }
//   else if (high == 1) {
//     if (low){
//       arg = "True";
//     } else {
//       arg = "False";
//     }   
//   } 
//   else {
//     arg = String(Number(BigInt.asIntN(32, arg)));
//   }
//   return arg;
// }

function toString (result: any){
  if (result == null){
    return null;
  }
  else if (result === true) {
    result = "True"
  }
  else if (result === false) {
    result = "False"
  }
  else {
    result = String(result);
  }
  return result;
}