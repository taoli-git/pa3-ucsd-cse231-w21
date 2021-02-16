import { stringInput } from "lezer-tree";
import { EnvironmentPlugin } from "webpack";
import { Func_def, Var_def, Stmt, Expr, Binop, Uniop, Type, Map_bin} from "./ast";
import { GlobalType } from "./compiler";
import { parseProgram } from "./parser";
import { BOOL, NONE, NUM } from "./utils";

export function tcDef(def: Var_def | Func_def, global: GlobalType, local: Map<string, Type>) : Type {
  switch (def.tag) {
    case "var":
      var literal_type = tcExpr({tag:"literal", value: def.literal}, global, local);
      var var_type = def.typed_var.type;

      if (var_type.tag == "class" && literal_type.a == NONE) {
        return var_type;
      }
      else if (var_type == literal_type.a) {
        return var_type;
      }
      else {
        throw new Error("Expected type `" + var_type.tag
        + "`; got type `" + literal_type.a.tag + "`");
      }

    case "func":
      var fname = def.name;
      var rettype = def.type;
      var param_type = def.typed_var;
      for (var p of param_type){
        local.set(p.name, p.type);
      }

      var var_def = def.func_body.var_def; 
      var body = def.func_body.body; 
      
      // type check local variables
      for (var s of var_def){
        local.set(s.typed_var.name, s.typed_var.type);
        tcDef(s, global, local);
      }
      
      // type check all statements
      var hasret : boolean = false;
      body.map(s => {
        var k = tcStmt(s, global, local);
        if (k.a != NONE) { 
          hasret = true; 
          if (k.a != rettype) {
            throw new Error(`All paths in this function/method must have the return type: ${rettype.tag}`)
          }
        };
        if (s.tag == "return") 
        { 
          hasret = true;
          if (k.a != rettype) {
            throw new Error(`All paths in this function/method must have the return type: ${rettype.tag}`)
          }
        }; 
      }); 
      if (rettype != NONE && !hasret) {
        throw new Error(`All paths in this function/method must have a return statement: ${fname}`);
      }
      return rettype;
  }

}

export function tcStmt(stmt: Stmt<any>, global: GlobalType, local: Map<string, Type>) : Stmt<Type> {
  if (stmt == null) {
    return null;
  }
  switch(stmt.tag) {
    case "assign": 
      var righttype = tcExpr(stmt.value, global, local);
      var vartype;
      if (local.has(stmt.name)) {
        vartype = local.get(stmt.name);
      } else if (global.vars.has(stmt.name)) {
        vartype = global.vars.get(stmt.name);
      }
      if (vartype == righttype.a) {
        return { a: NONE, tag:"assign", name:stmt.name, value: righttype };
      } else {
        throw new Error("Expected type `" + vartype.tag
                        + "`; got type `" + righttype.tag + "`");
      }
    case "if":      
      var condType = tcExpr(stmt.cond, global, local);
      if (condType.a.tag != "bool") {
        throw new Error("Condition expression cannot be of type `" + condType.a.tag + "`");
      }

      var rt1:Type = null;
      var typedbody1:Array<Stmt<Type>> = [];
      // handle if statement
      stmt.thn.forEach(element => {
        var tp = tcStmt(element, global, local);
        typedbody1.push(tp);
        if (rt1!=null && tp.a!=rt1) throw new Error("Cannot return different types within on If Block")
        if (rt1 == null) rt1 = tp.a;
      });

      var rt2:Type = null;
      var typedbody2:Array<Stmt<Type>> = [];
      stmt.els.forEach(element => {
        var tp = tcStmt(element, global, local);
        typedbody2.push(tp);
        if (rt2!=null && tp.a!=rt2) throw new Error("Cannot return different types within on If Block")
        if (rt2 == null) rt2 = tp.a;
      });

      if (rt1 == null) rt1 = NONE;
      if (rt2 == null) rt2 = NONE;
      if (rt1 != rt2) {
        throw new Error("Cannot return different types within on If Block");
      }
      return { a: rt1, tag: "if", cond: condType, thn: typedbody1, els: typedbody2 };
    case "while":
      // There is no while loop in this pa
      var type = tcExpr(stmt.expr, global, local);
      if (type.a.tag != "bool") {
        throw new Error("Condition expression cannot be of type `" + type.tag + "`");
      }
      var ret:Type = NONE;
      var typedBody:Array<Stmt<Type>> = [];
      stmt.body.map(s => {var t = tcStmt(s, global, local);
                          typedBody.push(t);
                          if (s.tag == "return") {ret = t.a}});
      return { a:ret, tag: "while", expr: type, body: typedBody };
    case "pass":
      return { a:NONE, tag:"pass" };
    case "return":
      var type = tcExpr(stmt.value, global, local);
      return { a: type.a, tag:"return", value: type };
    case "expr":
      var tE = tcExpr(stmt.expr, global, local);
      return { a: NONE, tag: "expr", expr: tE };
  }
}


export function tcExpr(expr: Expr<any> , global: GlobalType , local: Map<string, Type>) : Expr<Type> {
  console.log( local);

  if (expr == null) {
    return null;
  }
  switch(expr.tag) {
    case "literal":
      var literal = expr.value;
      switch(literal.tag){
        case "None":
          return { a:NONE, tag: "literal", value:literal };
        case "Bool":
          return { a:BOOL, tag: "literal", value:literal };
        case "number":
          return { a:NUM, tag: "literal", value:literal };
      }
    case "id":
      var type : Type = NONE;
      if (local.has(expr.name)){
        type = local.get(expr.name);
      } else if (global.vars.has(expr.name)){
        type = global.vars.get(expr.name);
      }
      return { a:type, tag:"id", name:expr.name };
    case "uniop":
      var type : Type = tcExpr(expr.right, global, local).a;
      switch (expr.op){
        case Uniop.Not:
          if (type.tag != "bool") {
            throw new Error("Cannot apply operator `not` on type `" + type.tag + "`");
          }
          break;
        case Uniop.Negate:
          if (type.tag != "number") {
            throw new Error("Cannot apply operator `-` on type `" + type.tag + "`");
          }
          break;
      }
      return { a:type, tag:"uniop", op:expr.op, right:expr.right };
    case "binop":
      var lefttype = tcExpr(expr.left, global, local).a;
      var righttype = tcExpr(expr.right, global, local).a;
      var type = checkOp(expr.op, lefttype, righttype);
      return { a:type, tag:"binop", op:expr.op, left:expr.left, right:expr.right }
    case "paren":
      var tE = tcExpr(expr.middle, global, local);
      return { a:tE.a, tag:"paren", middle: tE }
    case "construct":
      return { a: { tag:"class", name:expr.name}, tag:"construct", name:expr.name }
    case "lookup":
      var objstmts = tcExpr(expr.obj, global, local);
      var objtype = objstmts.a;
      if(objtype.tag !== "class") { // I don't think this error can happen
        throw new Error("Report this as a bug to the compiler developer, this shouldn't happen " + objtype.tag);
      }
      var className = objtype.name;
      return { a: global.fields.get(className).get(expr.name), tag:"lookup", obj:objstmts, name:expr.name }
    case "methodcall":
      var objstmts = tcExpr(expr.obj, global, local);
      var objtype = objstmts.a;
      if(objtype.tag !== "class") { // I don't think this error can happen
        throw new Error("Report this as a bug to the compiler developer, this shouldn't happen " + objtype.tag);
      }

      var className = objtype.name;
      if (!global.method_param.has(className) || !global.method_param.get(className).has(expr.name)) {
        throw new Error("Undefined method call!")
      }

      var defTypes = global.method_param.get(className).get(expr.name);
      if (expr.args.length != defTypes.length-1) {
        throw new Error("Method call has different arguments number than defined.")
      }

      var typedArgs:Array<Expr<Type>> = []
      for (let index = 0; index < expr.args.length; index++) {
        var tE = tcExpr(expr.args[index], global, local);
        if (tE.a != defTypes[index+1]) {
          throw new Error("Method call has different arguments types than defined.")
        }
        typedArgs.push(tE);
      }
      return { a:global.method_ret.get(className).get(expr.name), tag:"methodcall", obj:objstmts, name:expr.name, args:typedArgs};
    case "call":
      // There is no call in this pa.
      return { a:NONE, tag:"call", name:expr.name, arguments:expr.arguments };
  }
}

function checkOp(op: Binop, left: Type, right: Type) : Type {
  var op_str = getKey(Map_bin, op);
  switch(op){
    case Binop.Plus:
    case Binop.Minus:
    case Binop.Multiply:
    case Binop.Divide:
    case Binop.Mod:
      if (left == right && left.tag == "number"){
        return { tag: "number" };
      }
      else {
        throw new Error("Cannot apply operator `"
        + op_str + "` on types `"
        + left.tag + "` and `" 
        + right.tag + "`");
      }
    case Binop.LE:
    case Binop.GE:
    case Binop.LT:
    case Binop.GT:
      if (left == right && left.tag == "number") {
        return { tag: "bool" };
      }
      else {
        throw new Error("Cannot apply operator `"
        + op_str + "` on types `"
        + left.tag + "` and `" 
        + right.tag + "`");
      }
    case Binop.Equal:
    case Binop.Unequal:
      if (left == right && (left.tag == "number" || left.tag == "bool")) {
        return { tag: "bool" };
      }
      else {
        throw new Error("Cannot apply operator `"
        + op_str + "` on types `"
        + left.tag + "` and `" 
        + right.tag + "`");
      }
    case Binop.Is:
      // if (left.tag == "class" && right.tag == "class")
      // {
        
      // }
      // else 
      if (left.tag != "number" && left.tag != "bool" 
        && right.tag != "number" && right.tag != "bool" ){
          return { tag: "bool" };
      }
      else {
        throw new Error("Cannot apply operator `"
        + op_str + "` on types `"
        + left.tag + "` and `" 
        + left.tag + "`");
      }
  }
}


function getKey(map:Map<string, Binop>, value:Binop) {
  return [...map].find(([key, val]) => val == value)[0]
}