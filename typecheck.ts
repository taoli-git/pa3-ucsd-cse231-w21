import { stringInput } from "lezer-tree";
import { EnvironmentPlugin } from "webpack";
import { Func_def, Var_def, Stmt, Expr, Binop, Uniop, Type, Map_bin, Map_type} from "./ast";
import { GlobalType } from "./compiler";
import { parseProgram } from "./parser";

export function tcDef(def: Var_def | Func_def, global: GlobalType, local: Map<string, Type>) : Type {
  switch (def.tag) {
    case "var":
      var literal_type = tcExpr({tag:"literal", value: def.literal}, global, local);
      var var_type = def.typed_var.type;

      if (var_type == literal_type) {
        return null;
      }
      else {
        throw new Error("Expected type `" + Map_type.get(var_type) 
        + "`; got type `" + Map_type.get(literal_type) + "`");
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
      var match = true;
      var hasret : boolean = null;
      var sig : boolean = false;
      body.map(s => {var k = tcStmt(s, global, local, rettype);
                     if (k != null) { sig = true; match = match && k};
                     if (s.tag == "return") { sig = true; hasret = true}; }); 
      if (hasret != null) { match = hasret || match; }
      if (rettype != null) {
        if (!sig || !match){
          throw new Error(`All paths in this function/method must have a return statement: ${fname}`);
        }
      }        
                    
      // if (rettype != type) {
      //   throw new Error("Expected type `" + Map_type.get(rettype) 
      //   + "`; got type `" + Map_type.get(type) + "`");
      // }
      return null;
  }

}

// export function tcStmt(stmt: Stmt, global: GlobalType, local: Map<string, Type>, rettype: Type) : boolean {
//   if (stmt == null) {
//     return null;
//   }
//   switch(stmt.tag) {
//     case "define": 
//       var righttype = tcExpr(stmt.value, global, local);
//       var vartype;
//       if (local.has(stmt.name)) {
//         vartype = local.get(stmt.name);
//       } else if (global.vars.has(stmt.name)) {
//         vartype = global.vars.get(stmt.name);
//       }
//       if (vartype == righttype) {
//         return null;
//       } else {
//         throw new Error("Expected type `" + Map_type.get(vartype) 
//                         + "`; got type `" + Map_type.get(righttype) + "`");
//       }
//     case "logical":      
//       var expr1_type = tcExpr(stmt.expr1, global, local);
//       if (expr1_type != Type.bool) {
//         throw new Error("Condition expression cannot be of type `" + Map_type.get(expr1_type) + "`");
//       }
      
//       var bodytype = stmt.body1.map(s => tcStmt(s, global, local, rettype));

//       if (stmt.expr2 != null) {
//         var expr2_type = tcExpr(stmt.expr2, global, local);
//         if (expr2_type != Type.bool) {
//           throw new Error("Condition expression cannot be of type `" + Map_type.get(expr2_type) + "`");
//         }
//       }

//       if (stmt.body2 != null) {
//         stmt.body2.map(s => tcStmt(s, global, local, rettype));
//       } 
//       if (stmt.body3 != null) {
//         stmt.body3.map(s => tcStmt(s, global, local, rettype));
//       }

//       return null;
//     case "while":
//       var type = tcExpr(stmt.expr, global, local);
//       if (type != Type.bool) {
//         throw new Error("Condition expression cannot be of type `" + Map_type.get(type) + "`");
//       }
//       var all = stmt.body.map(s => tcStmt(s, global, local, rettype));
//       return all[all.length - 1];
//     case "pass":
//       return null;
//     case "return":
//       var type = tcExpr(stmt.value, global, local);
//       console.log("11111 "+ type);
//       if (rettype != type) {
//         throw new Error("Expected type `" + Map_type.get(rettype) 
//         + "`; got type `" + Map_type.get(type) + "`");
//       }
//       return null;
//     case "expr":
//       tcExpr(stmt.expr, global, local);
//       return null;
//   }
// }

export function tcStmt(stmt: Stmt, global: GlobalType, local: Map<string, Type>, rettype: Type) : boolean {
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
      if (vartype == righttype) {
        return null;
      } else {
        throw new Error("Expected type `" + Map_type.get(vartype) 
                        + "`; got type `" + Map_type.get(righttype) + "`");
      }
    case "logical":      
      var expr1_type = tcExpr(stmt.expr1, global, local);
      if (expr1_type.tag != "bool") {
        throw new Error("Condition expression cannot be of type `" + Map_type.get(expr1_type) + "`");
      }
      
      var ret : boolean = null;
      var hasret1 : boolean = null;
      var retbody1 : boolean = true;
      var hasret2 : boolean = null;
      var retbody2 : boolean = true;
      var hasret3 : boolean = null; 
      var retbody3 : boolean = true; 
      for (var s of stmt.body1) {
        var t = tcStmt(s, global, local, rettype);
        if (t != null){
          if (hasret1 == null) {
            hasret1 = false;
          }
          if (s.tag == "return") {
            hasret1 = true;
          }
          retbody1 = retbody1 && t; 
        }
      }
      if (hasret1 != null) {
        hasret1 = hasret1 || retbody1;
      }
 
      if (stmt.expr2 != null) {
        var expr2_type = tcExpr(stmt.expr2, global, local);
        if (expr2_type.tag != "bool") {
          throw new Error("Condition expression cannot be of type `" + Map_type.get(expr2_type) + "`");
        }
      }
      
      console.log(stmt.body2)
      console.log(stmt.body3)
      if (stmt.body2 != null) {
        for (var s of stmt.body2) {
          var t = tcStmt(s, global, local, rettype);
          if (t != null){
            if (hasret2 == null) {
              hasret2 = false;
            }
            if (s.tag == "return") {
              hasret2 = true;
            }
            retbody2 = retbody2 && t; 
          }
        }
        if (hasret2 != null) {
          hasret2 = hasret2 || retbody2;
        }
      } else {
        hasret2 = hasret1;
      }

      if (stmt.body3 != null) {
        for (var s of stmt.body3) {
          var t = tcStmt(s, global, local, rettype);
          if (t != null){
            if (hasret3 == null) {
              hasret3 = false;
            }
            if (s.tag == "return") {
              hasret3 = true;
            }
            retbody3 = retbody3 && t; 
          }
        }
        if (hasret3 != null) {
          hasret3 = hasret3 || retbody3;
        } 
      } 
      
      console.log(`1  ${hasret1} , 2   ${hasret2}    ,3   ${hasret3} `)
      
      if (hasret1 == hasret2 && hasret2 == hasret3) {
        if (hasret1 == null) {
          return null;
        }
        return hasret1;
      }
      return false;

    case "while":
      var type = tcExpr(stmt.expr, global, local);
      if (type.tag != "bool") {
        throw new Error("Condition expression cannot be of type `" + Map_type.get(type) + "`");
      }
      var hasret:boolean = null;
      stmt.body.map(s => {var t = tcStmt(s, global, local, rettype);
                          if (t != null) {hasret = true}});
      // return all[all.length - 1];
      if (hasret == null) {
        return null;
      }
      return false;
    case "pass":
      return null;
    case "return":
      var type = tcExpr(stmt.value, global, local);
      console.log("11111 "+ type.tag);
      if (rettype != type) {
        throw new Error("Expected type `" + rettype.tag 
        + "`; got type `" + type.tag + "`");
      }
      return true;
    case "expr":
      tcExpr(stmt.expr, global, local);
      return null;
  }
}


export function tcExpr(expr: Expr , global: GlobalType , local: Map<string, Type>) : Type {
  console.log( local);

  if (expr == null) {
    return null;
  }
  switch(expr.tag) {
    case "literal":
      var literal = expr.value;
      switch(literal.tag){
        case "None":
          return { tag: "none" }
        case "Bool":
          return { tag: "bool" }
        case "number":
          return { tag: "int" }
      }
    case "id":
      var type : Type = null;
      if (local.has(expr.name)){
        type = local.get(expr.name);
      } else if (global.vars.has(expr.name)){
        type = global.vars.get(expr.name);
      }
      return type;
    case "uniop":
      var type : Type = tcExpr(expr.right, global, local);
      switch (expr.op){
        case Uniop.Not:
          if (type.tag != "bool") {
            throw new Error("Cannot apply operator `not` on type `" + type.tag + "`");
          }
          break;
        case Uniop.Negate:
          if (type.tag != "int") {
            throw new Error("Cannot apply operator `-` on type `" + type.tag + "`");
          }
          break;
      }
      return type;
    case "binop":
      var lefttype = tcExpr(expr.left, global, local);
      var righttype = tcExpr(expr.right, global, local);
      return checkOp(expr.op, lefttype, righttype);
    case "paren":
      return tcExpr(expr.middle, global, local);
    case "call":
      return checkArgs(expr, global, local);
  }
}

function checkArgs(expr: Expr, global: GlobalType, local: Map<string, Type>) : Type{
  if (expr.tag == "call"){
    var fname = expr.name;
    if (fname == "print") {
      tcExpr(expr.arguments[0], global, local)
      return null;
    }
    if (!global.method_param.has(fname)) {
      throw new Error(`Not a function or class: ${fname}`);
    }
    var args = expr.arguments;
    var arg_types = args.map( s => tcExpr(s, global, local));
    var params = global.method_param.get(fname);
    if (params.length != args.length) {
      throw new Error(`Expected ${params.length} arguments; got ${args.length}`);
    }
    else {
      var len = args.length;
      for (var i = 0; i < len; i++) {
        if (arg_types[i] != params[i]){
          throw new Error("Expected type `" + Map_type.get(params[i]) + "`; got type `"
                         + Map_type.get(arg_types[i]) + "` in parameter " + i);
        }
      }
    }
    return global.func_ret.get(fname);
  }
}

function checkOp(op: Binop, left: Type, right: Type, global: GlobalType) : Type {
  var op_str = getKey(Map_bin, op);
  switch(op){
    case Binop.Plus:
    case Binop.Minus:
    case Binop.Multiply:
    case Binop.Divide:
    case Binop.Mod:
      if (left == right && left.tag == "int"){
        return { tag: "int" };
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
      if (left == right && left.tag == "int") {
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
      if (left == right && (left.tag == "int" || left.tag == "bool")) {
        return { tag: "bool" };
      }
      else {
        throw new Error("Cannot apply operator `"
        + op_str + "` on types `"
        + left.tag + "` and `" 
        + right.tag + "`");
      }
    case Binop.Is:
      if (left.tag == "class" && right.tag == "class")
      {
        
      }
      else if (left.tag != "int" && left.tag != "bool" 
        && right.tag != "int" && right.tag != "bool" ){
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