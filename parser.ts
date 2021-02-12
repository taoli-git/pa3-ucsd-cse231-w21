import {parser} from "lezer-python";
import {Tree, TreeCursor} from "lezer-tree";
import {Var_def, Func_def, Typed_var, Expr, Stmt, Type, Literal, Map_uni, Map_bin, Class_def} from "./ast";

export function parseProgram(source : string) : [Array<Var_def | Class_def>, Array<Stmt>] {
  const t = parser.parse(source).cursor();
  t.firstChild();
  
  var [defs, finish] = traverseDefs(source, t);
  var stmts = new Array<Stmt>();
  if (!finish) {
    stmts = traverseStmts(source, t);
  }
  return [defs, stmts];
}

export function traverseDefs(s : string, t : TreeCursor) : [Array<Var_def | Class_def>, boolean]{
  const defs = [];
  var finish = false;
  while(true) {
    console.log("<<<<<" + t.type.name);
    if (t.type.name == "ClassDefinition") {
      defs.push(traverseClassDefs(s,t));
    }
    else if (t.type.name == "AssignStatement") {
      var temp = t
      temp.firstChild();
      temp.nextSibling();
      // var_def
      var typename = temp.type.name;
      t.parent();
      if (typename == "TypeDef") {
        defs.push(traverseVarDef(s, t));
      }
      else {
        break;
      }
    } 
    else {
      break;
    }
    if (!t.nextSibling()){
      finish = true;
      break;
    }
  } 
  return [defs, finish];
}

export function traverseClassDefs(s : string, t : TreeCursor) : Class_def {
  const varDefs = [];
  const funcDefs = [];
  t.firstChild();
  t.nextSibling(); // Focus on class name
  const className = s.substring(t.from, t.to);
  t.nextSibling(); // Focus on body
  t.firstChild();  // Focus colon

  while(t.nextSibling()) {
    if (t.type.name == "FunctionDefinition") {
      funcDefs.push(traverseFuncDef(className, s, t));
    }
    else if (t.type.name == "AssignStatement") {
      var temp = t
      temp.firstChild();
      temp.nextSibling();
      // var_def
      var typename = temp.type.name;
      t.parent();
      if (typename == "TypeDef") {
        varDefs.push(traverseVarDef(s, t));
      }
      else {
        throw new Error("Undefined variable in this scope!");
      }
    } 
    else {
      throw new Error("Unsupported expression within ClassDefinition.");
    }
  } 
  t.parent();
  t.parent();
  return { tag: "class", name: className, fields: varDefs, methods: funcDefs };
}

export function traverseVarDef(s : string, t : TreeCursor) : Var_def {
  t.firstChild(); // Focus on name
  var name = s.substring(t.from, t.to);
  t.nextSibling(); // Focus on TypeDef
  var type = getType(s, t);

  t.nextSibling(); // Focus on =
  t.nextSibling(); // Focus on literal
  var literal = getLiteral(s, t);
  t.parent(); // Pop to Def
  return { tag: "var", typed_var : {name, type}, literal };
}

export function traverseFuncDef(className: string, s : string, t : TreeCursor) : Func_def {
  t.firstChild();  // Focus on def
  t.nextSibling(); // Focus on name of function
  var name = s.substring(t.from, t.to);
  t.nextSibling(); // Focus on ParamList
  var typed_vars = traverseParameters(s, t);
  t.nextSibling();
  // check if return type
  var type = null;
  var temp = t;
  if ( temp.type.name == "TypeDef" ) {
    type = getType(s, t);
  }
  t.nextSibling(); // Focus on Body
  if (t.type.name != "Body") {
    throw new Error("Parse error too many function return type");
  }
  t.firstChild();  // Focus on :
  t.nextSibling(); // Focus on statement
  
  var [var_defs, stmts] = traverseFuncbody(s, t);
  console.log("var_defs ", var_defs.length)
  console.log(stmts, stmts.length);

  if (stmts.length == 0) {
    throw new Error("Parse error no statement for function body");
  }
  t.parent();      // Pop to Body
  t.parent();      // Pop to FunctionDefinition

  return {
    tag: "func", name, class: className, typed_var: typed_vars, type, func_body: {var_def: var_defs, body: stmts} 
  }
} 

export function traverseParameters(s : string, t : TreeCursor) : Array<Typed_var> {
  const params = [];
  t.firstChild();  // Focuses on open paren
  var temp = 0;
  while (t.nextSibling()) {
    let name = s.substring(t.from, t.to);
    if (name == ")") {
      if (temp == 0) {
        break;
      }
      else {
        throw new Error("Parse Error function param lists");
      }
    }
    console.log("params:  " + name);
   
    t.nextSibling();
    if (t.type.name != "TypeDef") {
      throw new Error("Parse Error function param lists");
    }
  
    let type = getType(s, t);
    params.push({name, type})

    t.nextSibling(); // Focus on ,
    temp += 1;
  } ; // Focuses on a VariableName
  
  t.parent(); // Pop to ParamList
  return params;
}

export function traverseFuncbody(s : string, t : TreeCursor) : [Array<Var_def>, Array<Stmt>] {
  const defs = [];
  var finish = false;
  while(true) {
    if (t.type.name == "FunctionDefinition") {
      throw new Error("Parse Error nested functions");
    }    
    else if (t.type.name == "AssignStatement") {
      var temp = t
      temp.firstChild();
      temp.nextSibling();
      // var_def
      var typename = temp.type.name;
      t.parent();
      if (typename == "TypeDef") {
        defs.push(traverseVarDef(s, t));
      }
      else {
        break;
      }
    } 
    else {
      break;
    }
    if (!t.nextSibling()){
      finish = true;
      break;
    }
  }
  var stmts = new Array<Stmt>();
  if (!finish) {
    stmts = traverseStmts(s, t);
  }
  return [defs, stmts];
}

export function traverseStmts(s : string, t : TreeCursor) {
  // The top node in the program is a Script node with a list of children
  // that are various statements
  const stmts:Array<Stmt> = [];
  
  do {
    console.log(">>>>>" + t.type.name);
    var temp: Stmt = traverseStmt(s, t);
    if (temp != null){
      stmts.push(temp);
    }
  } while(t.nextSibling()); // t.nextSibling() returns false when it reaches
                            //  the end of the list of children
  return stmts;
}

export function traverseStmt(s : string, t : TreeCursor) : Stmt {
  switch(t.type.name) {
    case "AssignStatement":
      t.firstChild(); // focused on name (the first child)
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // focused on = sign. May need this for complex tasks, like +=!
      t.nextSibling(); // focused on the value expression

      var value = traverseExpr(s, t);
      t.parent();
      return { tag: "assign", name, value };
    
    case "IfStatement":
      t.firstChild(); // Focus on if
      t.nextSibling(); // Focus on expr
      var expr1 = traverseExpr(s, t);
      if (expr1 == null) {
        throw new Error("Parse error no expression for if statement");
      }
      t.nextSibling(); // Focus on Body
      t.firstChild(); // Focus on :
      t.nextSibling();
      var body1 = traverseStmts(s, t);
      if (body1.length == 0) {
        throw new Error("Parse error no statement for if statement");
      }
      t.parent(); // Pop to Body
      
      var expr2 = null;
      var body2:Array<Stmt> = null;
      var body3:Array<Stmt> = null;
      t.nextSibling(); // Focus on elif or else
      if (s.substring(t.from, t.to) == "elif") {
        t.nextSibling(); 
        expr2 = traverseExpr(s, t);
        if (expr2 == null) {
          throw new Error("Parse error no expression for if statement");
        }
        t.nextSibling(); // Focus on Body
        t.firstChild(); // Focus on :
        t.nextSibling(); 
        body2 = traverseStmts(s, t);
        if (body2.length == 0){
          throw new Error("Parse error no statement for if statement");
        }
        t.parent(); // Pop to Body
        t.nextSibling(); // Focus on else
      }
      if (s.substring(t.from, t.to) == "else") {
        t.nextSibling(); // Focus on Body
        t.firstChild(); // Focus on :
        t.nextSibling();
        body3 = traverseStmts(s, t);
        if (body3.length == 0) {
          throw new Error("Parse error no statement for if statement");
        }
        t.parent();
      }
      t.parent();
      return { tag: "logical", expr1: expr1, body1: body1, expr2: expr2, body2: body2, body3: body3 };

    case "WhileStatement":
      t.firstChild();
      t.nextSibling();
      var expr = traverseExpr(s, t);
      if (expr == null) {
        throw new Error("Parse error no expression for while statement");
      }
      t.nextSibling();
      t.firstChild();
      t.nextSibling();
      var body = traverseStmts(s, t);
      if (body.length == 0) {
        throw new Error("Parse error no statement for while statement");
      }
      t.parent();
      t.parent();
      return { tag: "while", expr: expr, body: body }

    case "PassStatement":
      return { tag: "pass"}

    case "ReturnStatement":
      t.firstChild();  // Focus return keyword
      t.nextSibling(); // Focus expression
      var value = traverseExpr(s, t);
      if (t.nextSibling()) {
        throw new Error("Parse Error too many return values");
      }
      t.parent();
      return { tag: "return", value };
    
    case "ExpressionStatement":
      t.firstChild(); // The child is some kind of expression, the
                      // ExpressionStatement is just a wrapper with no information
      var expr = traverseExpr(s, t);
      t.parent();
      return { tag: "expr", expr: expr };

  }
}


export function traverseExpr(s : string, t : TreeCursor) : Expr {
  switch(t.type.name) {
    case "Number":
    case "Boolean":
    case "None":
      return { tag: "literal", value: getLiteral(s, t)};
    case "VariableName":
      return { tag: "id", name: s.substring(t.from, t.to) };
    case "MemberExpression":
      t.firstChild();
      let obj = traverseExpr(s, t);
      t.nextSibling(); // Focuses .
      t.nextSibling(); // Focuses field name
      const fieldName = s.substring(t.from, t.to);
      t.parent();
      return {
        tag: "lookup",
        obj,
        name: fieldName
      };
    case "UnaryExpression":
      t.firstChild(); // Focus on uniop
      var opname = s.substring(t.from, t.to);
      var uniop;
      if (Map_uni.has(opname)) {
        uniop = Map_uni.get(opname);
      }
      else {
        throw new Error("Parse Error no uniop " + opname);
      }
      t.nextSibling(); // Focus on Expr
      var expr = traverseExpr(s, t);
      t.parent();
      if (expr == null) {
        throw new Error("Parse Error no expression for unary expression");
      }
      return { tag: "uniop", op: uniop, right: expr };
    case "BinaryExpression":
      t.firstChild(); // Focus on Expr
      var left = traverseExpr(s, t);
      t.nextSibling(); // Focus on binop
      var opname = s.substring(t.from, t.to);
      var binop;
      if (Map_bin.has(opname)) {
        binop = Map_bin.get(opname);
      }
      else {
        throw new Error("Parse Error no binop " + opname);
      }
      t.nextSibling(); // Focus on Expr
      var right = traverseExpr(s, t);
      t.parent();
      if (left == null || right == null) {
        throw new Error("Parse Error no expression for binary expression");
      }
      return { tag: "binop", op: binop, left: left, right: right};
    case "ParenthesizedExpression":
      t.firstChild(); // Focus on (
      t.nextSibling();
      var middle = traverseExpr(s, t);
      t.parent();
      return { tag: "paren", middle}
    case "CallExpression":
      t.firstChild(); // Focus name
      var name = s.substring(t.from, t.to);
      t.nextSibling(); // Focus ArgList
      t.firstChild(); // Focus open paren
      var value = [];
      while (true) {
        t.nextSibling();
        var temp = s.substring(t.from, t.to);
        if (temp == ")"){
          break;
        }
        if (temp != ",") {
          value.push(traverseExpr(s, t));
        }
      }
      var result : Expr = { tag: "call", name, arguments: value};
      t.parent();
      t.parent();
      return result;
  }
}


export function getLiteral(s : string, t : TreeCursor) : Literal {

  switch (t.type.name) {
    case "None":
      return {tag: "None", value: null};
    case "Boolean":
      var boolname = s.substring(t.from, t.to);
      if (boolname == "True") {
        return {tag: "Bool", value: true};
      } else {
        return {tag: "Bool", value: false};
      }
    case "Number":
      return {tag: "number", value: Number(s.substring(t.from, t.to)) }
    default: 
      throw new Error("Could not parse expr at " + t.from + " " + t.to + ": " + s.substring(t.from, t.to));
  }
}


export function getType(s : string, t : TreeCursor) : Type {
  if (t.type.name != "TypeDef") {
    throw new Error("Could not parse expr at " + t.from + " " + t.to + ": " + s.substring(t.from, t.to));
  }
  t.firstChild(); // Focus on : or ->
  t.nextSibling(); // Focus on type
  var typename = s.substring(t.from, t.to);
  t.parent(); // Pop to TypeDef
  switch (typename) {
    case "int":
      return { tag: "int" };
    case "bool":
      return { tag: "bool" };
    case "None":
      throw new Error("Parse error near token NONE: None");
    default:
      throw new Error("Invalid type annotation; there is no class named: " + typename);
  }
}