export type program =  
  { def: Array<Var_def | Class_def>, body: Array<Stmt> }

export type Class_def = 
  { tag: "class", name: string, fields: Array<Var_def>, methods: Array<Func_def> }

export type Var_def = 
  { tag: "var", typed_var: Typed_var,  literal: Literal}

export type Typed_var = 
  { name: string, type: Type}

export type Func_def = 
  { tag: "func",  name: string, class: string, typed_var: Array<Typed_var>, type: Type, func_body: Func_body }

export type Func_body = 
  { var_def: Array<Var_def>, body: Array<Stmt> }

export type Stmt = 
    { tag: "assign", name: string, value: Expr }
  | { tag: "logical", expr1: Expr, body1: Array<Stmt>, expr2: Expr, body2: Array<Stmt>, body3: Array<Stmt> }
  | { tag: "while", expr: Expr, body: Array<Stmt> }
  | { tag: "pass" }
  | { tag: "return", value: Expr }
  | { tag: "expr", expr: Expr }

export type Expr = 
    { tag: "literal", value: Literal }
  | { tag: "id", name: string }
  | { tag: "uniop", op: Uniop, right: Expr }
  | { tag: "binop", op: Binop, left: Expr, right: Expr }
  | { tag: "paren", middle: Expr }
  | { tag: "call", class: string, name: string, arguments: Array<Expr> } // since there are only methods calls
  | { tag: "construct", name: string }
  | { tag: "lookup", obj: Expr, name: string }

export enum Binop { Plus, Minus, Multiply, Divide, Mod, Equal, Unequal, LE, GE, LT, GT, Is} ;

export enum Uniop { Not, Negate };

export type Literal = 
    { tag: "None", value: null}
  | { tag: "Bool", value: boolean }
  | { tag: "number", value: number }

export type Type =
  | { tag: "int" }
  | { tag: "bool" }
  | { tag: "none" }
  | { tag: "class", name: string }

export let Map_uni = new Map([
  ["not", Uniop.Not],
  ["-", Uniop.Negate]
]); 

export let Map_bin = new Map([
  ["+", Binop.Plus],
  ["-", Binop.Minus],
  ["*", Binop.Multiply ],
  ["//", Binop.Divide],
  ["%", Binop.Mod],
  ["==", Binop.Equal],
  ["!=", Binop.Unequal],
  ["<=", Binop.LE],
  [">=", Binop.GE],
  ["<", Binop.LT],
  [">", Binop.GT],
  ["is", Binop.Is]
]);


