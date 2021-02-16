export type program =  
  { def: Array<Var_def | Class_def>, body: Array<Stmt<any>> }

export type Class_def = 
  { tag: "class", name: string, fields: Array<Var_def>, methods: Array<Func_def> }

export type Var_def = 
  { tag: "var", typed_var: Typed_var,  literal: Literal}

export type Typed_var = 
  { name: string, type: Type}

export type Func_def = 
  { tag: "func",  name: string, class: string, typed_var: Array<Typed_var>, type: Type, func_body: Func_body }

export type Func_body = 
  { var_def: Array<Var_def>, body: Array<Stmt<any>> }

export type Stmt<A> = 
    { a?: A, tag: "assign", name: string, value: Expr<A> }
  | { a?: A, tag: "if", cond: Expr<A>, thn: Array<Stmt<A>>, els: Array<Stmt<A>> }
  | { a?: A, tag: "while", expr: Expr<A>, body: Array<Stmt<A>> }
  | { a?: A, tag: "pass" }
  | { a?: A, tag: "return", value: Expr<A> }
  | { a?: A, tag: "expr", expr: Expr<A> }

export type Expr<A> = 
    { a?: A, tag: "literal", value: Literal }
  | { a?: A, tag: "id", name: string }
  | { a?: A, tag: "uniop", op: Uniop, right: Expr<A> }
  | { a?: A, tag: "binop", op: Binop, left: Expr<A>, right: Expr<A> }
  | { a?: A, tag: "paren", middle: Expr<A> }
  | { a?: A, tag: "methodcall", obj: Expr<A>, name: string, args: Array<Expr<A>> }
  | { a?: A, tag: "call", name: string, arguments: Array<Expr<A>> } // since there are only methods calls
  | { a?: A, tag: "construct", name: string }
  | { a?: A, tag: "lookup", obj: Expr<A>, name: string }

export enum Binop { Plus, Minus, Multiply, Divide, Mod, Equal, Unequal, LE, GE, LT, GT, Is} ;

export enum Uniop { Not, Negate };

export type Literal = 
    { tag: "None", value: null}
  | { tag: "Bool", value: boolean }
  | { tag: "number", value: number }

export type Value =
  | { tag: "none" }
  | { tag: "bool"; value: boolean }
  | { tag: "num"; value: number }
  | { tag: "object"; name: string; address: number };

export type Type =
  | { tag: "number" }
  | { tag: "bool" }
  | { tag: "none" }
  | { tag: "class"; name: string };

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


