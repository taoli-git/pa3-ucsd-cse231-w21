import { stringInput } from "lezer-tree";
import { Func_def, Var_def, Stmt, Expr, Binop, Uniop, Type, Typed_var, Class_def } from "./ast";
import { parseProgram } from "./parser";
import { tcDef, tcExpr, tcStmt } from "./typecheck";

// https://learnxinyminutes.com/docs/wasm/

const bool_off = BigInt.asIntN(64, 1n << 40n);
const none_off = BigInt.asIntN(64, 1n << 41n);

// Numbers are offsets into global memory
export type GlobalEnv = {
  globals: Map<string, number>;
  classes: Map<string, Map<string, number>>;
  types: GlobalType
  offset: number;
}

export type GlobalType = {
  method_param: Map<string, Map<string, Array<Type>>>;
  method_ret: Map<string, Map<string, Type>>;
  fields: Map<string, Map<string, Type>>;
  vars: Map<string, Type>;
}

export const emptyEnv = { globals: new Map(), classes: new Map(), offset: 0 };

const globalType = { method_param: new Map(), method_ret: new Map(), vars: new Map()};
const Funccode : Map<string, string> = new Map();
// const Func_return : Map<string, Type> = new Map();
const Func_param : Map<string, Array<Type>> = new Map();

const Global_type: Map<string, Type> = new Map();


export function augmentEnv(env: GlobalEnv, defs: Array<Var_def | Class_def>) : GlobalEnv {
  const newEnv = new Map(env.globals);
  const newClasses = new Map(env.classes);
  var newOffset = env.offset;
  var newTypes:GlobalType = {
    method_param: new Map(env.types.method_param),
    method_ret: new Map(env.types.method_ret),
    fields: new Map(env.types.fields),
    vars: new Map(env.types.vars)
  }
  defs.forEach((s) => {
    var name:string;
    switch(s.tag) {
      case "var":
        name = s.typed_var.name;
        if (newEnv.has(name)) {
          throw new Error("Duplicate declaration of identifier in same scope: "+ name);
        }

        newEnv.set(name, newOffset);
        newTypes.vars.set(name, s.typed_var.type);
        newOffset += 1;
        break;
      case "class":
          name = s.name;
          if (newEnv.has(name)) {
            throw new Error("Duplicate declaration of identifier in same scope: "+ name);
          }

          const classDict = new Map();
          newTypes.fields.set(name, new Map());
          newTypes.method_param.set(name, new Map());
          for (let index = 0; index < s.fields.length; index++) {
            var vi = s.fields[index].typed_var;
            classDict.set(vi.name, index);
            newTypes.fields.get(name).set(vi.name, vi.type);
          }
          newClasses.set(name, classDict);
          
          s.methods.forEach(m => {
            newTypes.method_param.get(name).set(m.name, []);
            newTypes.method_ret.get(name).set(m.name, m.type);
            m.typed_var.forEach(p => {
              newTypes.method_param.get(name).get(m.name).push(p.type);
            });
          });
    }
  })
  
  return {
    globals: newEnv,
    classes: newClasses,
    types: newTypes,
    offset: newOffset
  }  
}

type CompileResult = {
  funcs: string,
  wasmSource: string,
  newEnv: GlobalEnv
};



export function compile(source: string, env: GlobalEnv) : CompileResult {
  const [ast_defs, ast_stmts] = parseProgram(source);
  console.log(ast_defs);
  console.log(ast_stmts);
  const withDefines = augmentEnv(env, ast_defs);

  const localDefines = [`(local $$None i64) (i64.const ` + none_off + ") (local.set $$None)"];
  // func and var defines
  const defGroups: Array<Array<string>> = [];
  
  for (var def of ast_defs) {
    //tcDef(def, globalType, new Map());
    if (def.tag == "var"){
      defGroups.push(codeGenDef(def, withDefines, new Set()));
    }
    else if (def.tag == "class"){
      def.methods.forEach(m => {
        codeGenDef(m, withDefines, new Set());
      });
    }
  }
  
  const funcs: Array<string> = [];
  for (var [key, value] of Funccode){
    funcs.push([value].join("\n"));
  }
  const allFuncs = funcs.join("\n\n");

  // all statements
  //ast_stmts.map(s => tcStmt(s, globalType, new Map(), null));
  const commandGroups = ast_stmts.map((stmt) => codeGenStmt(stmt, withDefines, new Set()));
  
  var commands = [].concat.apply([], localDefines);

  commands = [].concat.apply(commands, defGroups);

  commands = [].concat.apply(commands, commandGroups);

  return {
    funcs: allFuncs,
    wasmSource: commands.join("\n"),
    newEnv: withDefines
  };
}

function envLookup(env : GlobalEnv, name : string) : number {
  if(env == null || !env.globals.has(name) || env.types.method_param.has(name)) 
  { console.log("Could not find " + name + " in ", env); 
    throw new Error("Not a variable: " + name);
  }
  return (env.globals.get(name) * 8); // 8-byte values
}

function codeGenDef(def: Var_def | Func_def, env: GlobalEnv, local: Set<string> ): Array<string> {
  // tcDef(def, globalType, new Map());
  switch(def.tag) {
    case "var":
      var name = def.typed_var.name;
      var valStmts = codeGenExpr({tag: "literal", value: def.literal}, env, local);
      console.log("!!!!!!!!!" + valStmts);
      if (local.has(name)) {
        return [`(local.set $${name} ${valStmts} )`];
      } 
      else {
        globalType.vars.set(name, def.typed_var.type);
        const locationToStore = [`(i32.const ${envLookup(env, name)}) ;; ${name}`];
        return locationToStore.concat(valStmts).concat([`(i64.store)`]);
      }
    case "func":     
      const localEnv:Set<string> = new Set();
      var paramlist = def.typed_var;
      // var param_type : Array<Type> = [];
      // traverse params
      for (var param of paramlist) {
        if (localEnv.has(param.name)) {
          throw new Error("Duplicate declaration of identifier in same scope: "+ param.name);
        }
        localEnv.add(param.name);
        // param_type.push(param.type);
      }
      // globalType.func_param.set(def.name, param_type);
      // globalType.func_ret.set(def.name, def.type);


      var var_defs =  def.func_body.var_def;
      
       // local vars
      var localdefs : Array<string> = []; 
      localdefs.push(`(local $$None i64)`);

      for (var temp of var_defs){
        if (localEnv.has(temp.typed_var.name)) {
          throw new Error("Duplicate declaration of identifier in same scope: "+ param.name);
        }
        localEnv.add(temp.typed_var.name);
        localdefs.push(`(local $${temp.typed_var.name} i64)`);
      }
      console.log(localEnv);

      var params = def.typed_var.map(p => `(param $${p.name} i64)`).join(" ");
      var localDefines = localdefs.join("\n");
      var localAssigns = var_defs.map(s=>codeGenDef(s, env, localEnv)).flat().join("\n");
      
      var body = def.func_body.body;
      var stmts : Array<Array<string>> = [[]];
      for (var s of body){
        stmts.push(codeGenStmt(s, env, localEnv));
      }
      stmts.push([`(unreachable)`]);

      var stmtsBody = stmts.flat().join("\n");
      var rettype = "";
      if (def.type != null) {
        rettype = `(result i64)`;
      }

      const funcName = def.class + "::" + def.name;
      var result = `(func $${funcName} ${params} ${rettype} 
         \n${localDefines} 
         \n(local.set $$None (i64.const ${none_off}))\n ${localAssigns}
         ${stmtsBody})`;
      Funccode.set(def.name, result);
      return [result];
  }
}


function codeGenStmt(stmt: Stmt, env: GlobalEnv, local: Set<string>) : Array<string> {
  console.log("stmt" + local);
  switch(stmt.tag) {
    case "assign":
      if (local.has(stmt.name)) {
        var valStmts = codeGenExpr(stmt.value, env, local);
        return valStmts.concat([`(local.set $${stmt.name})`]);
      } 
      else {
        const locationToStore = [`(i32.const ${envLookup(env, stmt.name)}) ;; ${stmt.name}`];
        var valStmts = codeGenExpr(stmt.value, env, local);
        return locationToStore.concat(valStmts).concat([`(i64.store)`]);
      }
    case "logical":
      var expr1 = codeGenExpr(stmt.expr1, env, local);
      var result = [`(if (i32.wrap_i64 `].concat(expr1, [`)`]);
      var body1 = [``];
      for (var body of stmt.body1) {
        body1 = body1.concat(codeGenStmt(body, env, local));
      }
      result = result.concat([`(then `], body1, [`)`]);
      var expr2;
      var body2 = [``];
      var sup = [``];
      if (stmt.expr2 != null) {
        expr2 = codeGenExpr(stmt.expr2, env, local);
        result = result.concat([`(else (if (i32.wrap_i64 `], expr2, [`)`]);
        if (stmt.body2 != null) {
          for (var body of stmt.body2) {
            body2 = body2.concat(codeGenStmt(body, env, local));
          }
        }
        result = result.concat([`(then `], body2, [` )`]);
        sup = [ `) )`];
      }
      var body3 = [``];
      if (stmt.body3 != null) {
        for (var body of stmt.body3) {
          body3 = body3.concat(codeGenStmt(body, env, local));
        }
      }
      result = result.concat([`(else `], body3, sup, [`))`]);
      console.log(result);
      return result;
    case "while":
      var expr = codeGenExpr({ tag:"uniop", op: Uniop.Not, right: stmt.expr}, env, local);
      var bodys = [``];
      for (var body of stmt.body) {
        bodys = bodys.concat(codeGenStmt(body, env, local));
      }
      return [`(block (loop`].concat([`(br_if 1 (i32.wrap_i64`], expr, [`))`], bodys, [`(br 0) ) )`]);
    case "pass":
      return [`nop`];
    case "return":
      var valStmts = codeGenExpr(stmt.value, env, local);
      valStmts.push("return");
      return valStmts;    
    case "expr":
      var result = codeGenExpr(stmt.expr, env, local);
      if (stmt.expr.tag == "call"){
        var name = stmt.expr.name; 
        if (env.types.method_ret.get(name) == null){
          return result;
        }
      }
      result.push("(local.set $$None)");
      return result;
    // case "print":
    //   var valStmts = codeGenExpr(stmt.value, env);
    //   return valStmts.concat([
    //     "(call $print)"
    //   ]);  
  }
}

function codeGenExpr(expr : Expr, env: GlobalEnv, local: Set<string>) : Array<string> {
  if (expr == null) { return [""];}
  // var type = tcExpr(expr, globalType, new Map());
  switch(expr.tag) {
    case "literal":
      var new_expr = expr.value;
      switch(new_expr.tag) {
        case "None":
          return ["(i64.const " + none_off + ")"];
        case "Bool":
          if (new_expr.value) {
            return ["(i64.const " + (bool_off+1n) + ")"];
          }
          else {
            return ["(i64.const " + bool_off + ")"];
          }
        case "number":
          return ["(i64.const " + new_expr.value + ")"];
      }
    case "id":
      if (local.has(expr.name)){
        return [`(local.get $${expr.name})`];
      }
      else{
        return [`(i32.const ${envLookup(env, expr.name)})`, `(i64.load )`];
      }
    case "uniop":
      return codeGenUniOp(expr.op, expr.right, env, local);
    case "binop":
      return codeGenBinOp(expr.op, expr.left, expr.right, env, local);
    case "paren":
      return codeGenExpr(expr.middle, env, local);
    case "call":
      var argStmts =  [``];
      for (var arg of expr.arguments) {
        argStmts = argStmts.concat(codeGenExpr(arg, env, local));
      }
      return argStmts.concat([`(call $${expr.name})`]);
  }
}


function codeGenUniOp(op: Uniop, right: Expr, env: GlobalEnv, local: Set<string>): Array<string> {
  var rightStmts = codeGenExpr(right, env, local);
  var left;
  switch (op) {
    case Uniop.Not:
      left = ["(i64.const 1)"]; // -1 xor 
      return left.concat(rightStmts.concat([`(i64.xor )`]));
    case Uniop.Negate:
      left = ["(i64.const 0)"]; 
      return left.concat(rightStmts.concat([`(i64.sub )`]));
  }
}

function codeGenBinOp(op: Binop, left: Expr, right: Expr, env: GlobalEnv, local: Set<string> ): Array<string> {
  var leftStmts = codeGenExpr(left, env, local);
  var rightStmts = codeGenExpr(right, env, local);
  switch (op) {
    case Binop.Plus:
      return leftStmts.concat(rightStmts.concat([`(i64.add )`]));
    case Binop.Minus:
      return leftStmts.concat(rightStmts.concat([`(i64.sub )`]));
    case Binop.Multiply:
      return leftStmts.concat(rightStmts.concat([`(i64.mul )`]));
    case Binop.Divide:
      var result:Array<string> = [];
      result = result.concat(leftStmts);
      result.push(`(f64.convert_i64_s )`);
      result = result.concat(rightStmts);
      result.push(`(f64.convert_i64_s )`);
      result.push(`(f64.div )`);
      result.push(`(f64.floor )`);
      result.push(`(i64.trunc_f64_s )`);
      return result;
      // return leftStmts.concat(rightStmts.concat([`(i64.div_s )`]));
    case Binop.Mod:
      var expr:Expr = {tag: "binop", op: Binop.Minus, left: left, right: 
                      {tag: "binop", op: Binop.Multiply, left: right, right:
                      {tag: "binop", op: Binop.Divide, left: left, right: right}}};
      var result = codeGenExpr(expr, env, local);
      return result;
      // return leftStmts.concat(rightStmts.concat([`(i64.rem_s )`]));
    case Binop.Equal:
      return leftStmts.concat(rightStmts.concat([`(i64.eq )`])).concat(intToBool());
    case Binop.Unequal:
      return leftStmts.concat(rightStmts.concat([`(i64.ne )`])).concat(intToBool());
    case Binop.LE:
      return leftStmts.concat(rightStmts.concat([`(i64.le_s )`])).concat(intToBool());
    case Binop.GE:
      return leftStmts.concat(rightStmts.concat([`(i64.ge_s )`])).concat(intToBool());
    case Binop.LT:
      return leftStmts.concat(rightStmts.concat([`(i64.lt_s )`])).concat(intToBool());
    case Binop.GT:
      return leftStmts.concat(rightStmts.concat([`(i64.gt_s )`])).concat(intToBool());
    case Binop.Is:
      var result:Array<string> = [];
      // None
      if (tcExpr(left, env.types, new Map()) == null || tcExpr(right, env.types, new Map()) == null){
        result.push(`(i32.const 1)`);
      } 
      else {
        result = leftStmts.concat(rightStmts.concat([`(i64.eq )`]));
      }
      return result.concat(intToBool());
  }
}

function intToBool() : Array<string> {
  var result = [];
  result.push(`(i64.extend_i32_s )`);
  result.push(`(i64.const `+bool_off + `)`);
  result.push(`(i64.add )`);
  return result;
}