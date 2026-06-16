// A minimal, restricted interpreter for user "decide" functions.
//
// This module implements a small interpreted subset of TypeScript/JavaScript
// rather than using eval() or the Function constructor. Only the following
// constructs are supported:
//   - A single top-level function declaration: function decide(context) { ... }
//   - Variable declarations with const/let (no reassignment required for MVP,
//     but assignment is allowed for simple local variables)
//   - if / else if / else statements
//   - return statements with literal string returns OR identifiers/member
//     expressions resolving to context data (used only in conditions, not
//     as action codes — action codes must be literal strings per spec)
//   - Boolean expressions: &&, ||, !
//   - Comparison expressions: ===, !==, ==, !=, <, <=, >, >=
//   - Arithmetic on numeric context values: +, -, *, /, % (for simple
//     comparisons against numbers)
//   - Member access on the provided context object (e.g. context.neighbors.east)
//   - Parenthesized expressions
//   - String, number, boolean, and null/undefined literals
//
// Explicitly DISALLOWED (rejected at parse time):
//   - for, while, do-while loops
//   - import / require
//   - eval, Function, new Function
//   - any call expressions except none (no function calls are allowed at all
//     in the MVP subset — this removes entire classes of dangerous APIs)
//   - assignment to context or its properties
//   - arrow functions, classes, generators, async/await
//   - try/catch/throw
//   - the "this" keyword

export type ASTNode =
  | { type: "Program"; body: FunctionDecl }
  | FunctionDecl
  | Statement
  | Expression;

export interface FunctionDecl {
  type: "FunctionDecl";
  name: string;
  param: string;
  body: Statement[];
}

export type Statement =
  | { type: "VarDecl"; kind: "const" | "let"; name: string; init: Expression }
  | { type: "Return"; value: Expression | null }
  | { type: "If"; test: Expression; consequent: Statement[]; alternate: Statement[] | null };

export type Expression =
  | { type: "Literal"; value: string | number | boolean | null }
  | { type: "Identifier"; name: string }
  | { type: "Member"; object: Expression; property: string }
  | { type: "Binary"; operator: string; left: Expression; right: Expression }
  | { type: "Logical"; operator: "&&" | "||"; left: Expression; right: Expression }
  | { type: "Unary"; operator: "!" | "-"; argument: Expression };

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType =
  | "keyword"
  | "identifier"
  | "number"
  | "string"
  | "punct"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const KEYWORDS = new Set([
  "function", "return", "if", "else", "const", "let", "var",
  "true", "false", "null", "undefined",
  // Disallowed but recognized so we can produce clear errors:
  "for", "while", "do", "import", "require", "eval", "new", "class",
  "try", "catch", "finally", "throw", "async", "await", "yield", "this",
  "switch", "case", "break", "continue", "delete", "in", "of", "instanceof",
  "typeof", "void", "with", "static", "extends", "super",
]);

const DISALLOWED_KEYWORDS = new Set([
  "for", "while", "do", "import", "require", "eval", "new", "class",
  "try", "catch", "finally", "throw", "async", "await", "yield", "this",
  "switch", "with", "extends", "super",
]);

const PUNCTUATORS = [
  "===", "!==", "=>", "&&", "||", "==", "!=", "<=", ">=",
  "{", "}", "(", ")", ";", ",", ".", "+", "-", "*", "/", "%",
  "<", ">", "=", "!", ":",
];

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;

  while (i < n) {
    const ch = source[i];

    // Whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Comments
    if (ch === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let value = "";
      while (j < n && source[j] !== quote) {
        if (source[j] === "\\" && j + 1 < n) {
          value += source[j + 1];
          j += 2;
        } else {
          value += source[j];
          j++;
        }
      }
      if (j >= n) {
        throw new ValidationError("Unterminated string literal");
      }
      tokens.push({ type: "string", value, pos: i });
      i = j + 1;
      continue;
    }

    // Template literals are not part of the allowed subset
    if (ch === "`") {
      throw new ValidationError("Template literals are not allowed in the algorithm subset");
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < n && /[0-9.]/.test(source[j])) j++;
      tokens.push({ type: "number", value: source.slice(i, j), pos: i });
      i = j;
      continue;
    }

    // Identifiers / keywords
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(source[j])) j++;
      const word = source.slice(i, j);
      tokens.push({ type: KEYWORDS.has(word) ? "keyword" : "identifier", value: word, pos: i });
      i = j;
      continue;
    }

    // Punctuators (longest match first)
    let matched = false;
    for (const p of PUNCTUATORS) {
      if (source.startsWith(p, i)) {
        tokens.push({ type: "punct", value: p, pos: i });
        i += p.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new ValidationError(`Unexpected character '${ch}' at position ${i}`);
    }
  }

  tokens.push({ type: "eof", value: "", pos: n });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return tok;
  }

  private expectPunct(value: string): Token {
    const tok = this.peek();
    if (tok.type !== "punct" || tok.value !== value) {
      throw new ValidationError(`Expected '${value}' but found '${tok.value || "EOF"}' at position ${tok.pos}`);
    }
    return this.advance();
  }

  private expectKeyword(value: string): Token {
    const tok = this.peek();
    if (tok.type !== "keyword" || tok.value !== value) {
      throw new ValidationError(`Expected keyword '${value}' but found '${tok.value || "EOF"}' at position ${tok.pos}`);
    }
    return this.advance();
  }

  private checkDisallowed(tok: Token) {
    if (tok.type === "keyword" && DISALLOWED_KEYWORDS.has(tok.value)) {
      throw new ValidationError(`Use of '${tok.value}' is not allowed in the algorithm subset`);
    }
  }

  parseProgram(): FunctionDecl {
    const tok = this.peek();
    this.checkDisallowed(tok);
    if (!(tok.type === "keyword" && tok.value === "function")) {
      throw new ValidationError("The algorithm must be a single function declaration, e.g. 'function decide(context) { ... }'");
    }
    const fn = this.parseFunctionDecl();
    if (this.peek().type !== "eof") {
      throw new ValidationError("Unexpected content after the function declaration");
    }
    return fn;
  }

  private parseFunctionDecl(): FunctionDecl {
    this.expectKeyword("function");
    const nameTok = this.peek();
    if (nameTok.type !== "identifier") {
      throw new ValidationError("Expected a function name");
    }
    const name = this.advance().value;

    this.expectPunct("(");
    let param = "context";
    if (this.peek().type === "identifier") {
      param = this.advance().value;
    }
    this.expectPunct(")");

    this.expectPunct("{");
    const body = this.parseStatementList();
    this.expectPunct("}");

    return { type: "FunctionDecl", name, param, body };
  }

  private parseStatementList(): Statement[] {
    const statements: Statement[] = [];
    while (!(this.peek().type === "punct" && this.peek().value === "}") && this.peek().type !== "eof") {
      statements.push(this.parseStatement());
    }
    return statements;
  }

  private parseStatement(): Statement {
    const tok = this.peek();
    this.checkDisallowed(tok);

    if (tok.type === "keyword" && (tok.value === "const" || tok.value === "let" || tok.value === "var")) {
      return this.parseVarDecl();
    }
    if (tok.type === "keyword" && tok.value === "return") {
      return this.parseReturn();
    }
    if (tok.type === "keyword" && tok.value === "if") {
      return this.parseIf();
    }
    if (tok.type === "keyword" && tok.value === "function") {
      throw new ValidationError("Nested function declarations are not allowed");
    }

    throw new ValidationError(`Unexpected statement starting with '${tok.value || "EOF"}' at position ${tok.pos}`);
  }

  private parseVarDecl(): Statement {
    const kindTok = this.advance(); // const / let / var
    const kind = kindTok.value === "var" ? "let" : (kindTok.value as "const" | "let");

    const nameTok = this.peek();
    if (nameTok.type !== "identifier") {
      throw new ValidationError("Expected a variable name after declaration keyword");
    }
    const name = this.advance().value;

    this.expectPunct("=");
    const init = this.parseExpression();
    this.expectPunct(";");

    return { type: "VarDecl", kind, name, init };
  }

  private parseReturn(): Statement {
    this.expectKeyword("return");
    if (this.peek().type === "punct" && this.peek().value === ";") {
      this.advance();
      return { type: "Return", value: null };
    }
    const value = this.parseExpression();
    this.expectPunct(";");
    return { type: "Return", value };
  }

  private parseIf(): Statement {
    this.expectKeyword("if");
    this.expectPunct("(");
    const test = this.parseExpression();
    this.expectPunct(")");
    const consequent = this.parseBlockOrSingleStatement();

    let alternate: Statement[] | null = null;
    if (this.peek().type === "keyword" && this.peek().value === "else") {
      this.advance();
      if (this.peek().type === "keyword" && this.peek().value === "if") {
        alternate = [this.parseIf()];
      } else {
        alternate = this.parseBlockOrSingleStatement();
      }
    }

    return { type: "If", test, consequent, alternate };
  }

  // Accepts either a `{ ... }` block or a single statement without braces
  // (e.g. `if (x) return "d";`).
  private parseBlockOrSingleStatement(): Statement[] {
    if (this.peek().type === "punct" && this.peek().value === "{") {
      this.advance();
      const body = this.parseStatementList();
      this.expectPunct("}");
      return body;
    }
    return [this.parseStatement()];
  }

  // Expression parsing (precedence climbing)

  private parseExpression(): Expression {
    return this.parseLogicalOr();
  }

  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd();
    while (this.peek().type === "punct" && this.peek().value === "||") {
      this.advance();
      const right = this.parseLogicalAnd();
      left = { type: "Logical", operator: "||", left, right };
    }
    return left;
  }

  private parseLogicalAnd(): Expression {
    let left = this.parseEquality();
    while (this.peek().type === "punct" && this.peek().value === "&&") {
      this.advance();
      const right = this.parseEquality();
      left = { type: "Logical", operator: "&&", left, right };
    }
    return left;
  }

  private parseEquality(): Expression {
    let left = this.parseRelational();
    while (
      this.peek().type === "punct" &&
      ["===", "!==", "==", "!="].includes(this.peek().value)
    ) {
      const operator = this.advance().value;
      const right = this.parseRelational();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  private parseRelational(): Expression {
    let left = this.parseAdditive();
    while (
      this.peek().type === "punct" &&
      ["<", ">", "<=", ">="].includes(this.peek().value)
    ) {
      const operator = this.advance().value;
      const right = this.parseAdditive();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative();
    while (this.peek().type === "punct" && ["+", "-"].includes(this.peek().value)) {
      const operator = this.advance().value;
      const right = this.parseMultiplicative();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary();
    while (this.peek().type === "punct" && ["*", "/", "%"].includes(this.peek().value)) {
      const operator = this.advance().value;
      const right = this.parseUnary();
      left = { type: "Binary", operator, left, right };
    }
    return left;
  }

  private parseUnary(): Expression {
    if (this.peek().type === "punct" && (this.peek().value === "!" || this.peek().value === "-")) {
      const operator = this.advance().value as "!" | "-";
      const argument = this.parseUnary();
      return { type: "Unary", operator, argument };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expression {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.peek().type === "punct" && this.peek().value === ".") {
        this.advance();
        const propTok = this.peek();
        if (propTok.type !== "identifier" && propTok.type !== "keyword") {
          throw new ValidationError("Expected a property name after '.'");
        }
        this.advance();
        expr = { type: "Member", object: expr, property: propTok.value };
      } else if (this.peek().type === "punct" && this.peek().value === "(") {
        throw new ValidationError("Function calls are not allowed in the algorithm subset");
      } else {
        break;
      }
    }
    return expr;
  }

  private parsePrimary(): Expression {
    const tok = this.peek();
    this.checkDisallowed(tok);

    if (tok.type === "number") {
      this.advance();
      return { type: "Literal", value: parseFloat(tok.value) };
    }
    if (tok.type === "string") {
      this.advance();
      return { type: "Literal", value: tok.value };
    }
    if (tok.type === "keyword" && tok.value === "true") {
      this.advance();
      return { type: "Literal", value: true };
    }
    if (tok.type === "keyword" && tok.value === "false") {
      this.advance();
      return { type: "Literal", value: false };
    }
    if (tok.type === "keyword" && (tok.value === "null" || tok.value === "undefined")) {
      this.advance();
      return { type: "Literal", value: null };
    }
    if (tok.type === "identifier") {
      this.advance();
      return { type: "Identifier", name: tok.value };
    }
    if (tok.type === "punct" && tok.value === "(") {
      this.advance();
      const expr = this.parseExpression();
      this.expectPunct(")");
      return expr;
    }

    throw new ValidationError(`Unexpected token '${tok.value || "EOF"}' at position ${tok.pos}`);
  }
}

export function parseAlgorithm(source: string): FunctionDecl {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

type Scope = Record<string, unknown>;

export class RuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeError";
  }
}

function evaluateExpression(expr: Expression, paramName: string, contextValue: unknown, scope: Scope): unknown {
  switch (expr.type) {
    case "Literal":
      return expr.value;

    case "Identifier": {
      if (expr.name === paramName) return contextValue;
      if (Object.prototype.hasOwnProperty.call(scope, expr.name)) {
        return scope[expr.name];
      }
      throw new RuntimeError(`Unknown identifier '${expr.name}'`);
    }

    case "Member": {
      const obj = evaluateExpression(expr.object, paramName, contextValue, scope);
      if (obj === null || obj === undefined) {
        return undefined;
      }
      if (typeof obj !== "object") {
        throw new RuntimeError(`Cannot access property '${expr.property}' of non-object value`);
      }
      return (obj as Record<string, unknown>)[expr.property];
    }

    case "Unary": {
      const val = evaluateExpression(expr.argument, paramName, contextValue, scope);
      if (expr.operator === "!") return !val;
      if (expr.operator === "-") return -(val as number);
      throw new RuntimeError(`Unsupported unary operator '${expr.operator}'`);
    }

    case "Binary": {
      const left = evaluateExpression(expr.left, paramName, contextValue, scope);
      const right = evaluateExpression(expr.right, paramName, contextValue, scope);
      switch (expr.operator) {
        case "===":
          return left === right;
        case "!==":
          return left !== right;
        case "==":
          return left === right; // strict equality used intentionally for determinism
        case "!=":
          return left !== right;
        case "<":
          return (left as number) < (right as number);
        case "<=":
          return (left as number) <= (right as number);
        case ">":
          return (left as number) > (right as number);
        case ">=":
          return (left as number) >= (right as number);
        case "+":
          return (left as number) + (right as number);
        case "-":
          return (left as number) - (right as number);
        case "*":
          return (left as number) * (right as number);
        case "/":
          return (left as number) / (right as number);
        case "%":
          return (left as number) % (right as number);
        default:
          throw new RuntimeError(`Unsupported binary operator '${expr.operator}'`);
      }
    }

    case "Logical": {
      const left = evaluateExpression(expr.left, paramName, contextValue, scope);
      if (expr.operator === "&&") {
        return left ? evaluateExpression(expr.right, paramName, contextValue, scope) : left;
      }
      return left ? left : evaluateExpression(expr.right, paramName, contextValue, scope);
    }

    default:
      throw new RuntimeError("Unsupported expression type");
  }
}

// Executes the parsed function body against a given context value.
// Returns the value of the first `return` statement encountered, or
// `undefined` if no return statement is reached.
export function runAlgorithm(fn: FunctionDecl, contextValue: unknown): unknown {
  const scope: Scope = {};

  function execBlock(statements: Statement[]): { returned: boolean; value: unknown } {
    for (const stmt of statements) {
      switch (stmt.type) {
        case "VarDecl": {
          scope[stmt.name] = evaluateExpression(stmt.init, fn.param, contextValue, scope);
          break;
        }
        case "Return": {
          const value = stmt.value ? evaluateExpression(stmt.value, fn.param, contextValue, scope) : undefined;
          return { returned: true, value };
        }
        case "If": {
          const test = evaluateExpression(stmt.test, fn.param, contextValue, scope);
          if (test) {
            const result = execBlock(stmt.consequent);
            if (result.returned) return result;
          } else if (stmt.alternate) {
            const result = execBlock(stmt.alternate);
            if (result.returned) return result;
          }
          break;
        }
      }
    }
    return { returned: false, value: undefined };
  }

  const result = execBlock(fn.body);
  return result.returned ? result.value : undefined;
}

// Collects all string literals that appear in `return` statements, used for
// validating that every possible returned action is a valid literal action code.
export function collectReturnedStringLiterals(fn: FunctionDecl): { literals: string[]; hasNonLiteralReturn: boolean } {
  const literals: string[] = [];
  let hasNonLiteralReturn = false;

  function walkExpr(expr: Expression): boolean {
    // Returns true if this expression, in all branches, resolves to a literal string
    if (expr.type === "Literal") {
      if (typeof expr.value === "string") {
        literals.push(expr.value);
        return true;
      }
      return false;
    }
    if (expr.type === "Logical") {
      // For a && b or a || b used as a return value, both sides could surface
      const leftOk = walkExpr(expr.left);
      const rightOk = walkExpr(expr.right);
      return leftOk && rightOk;
    }
    return false;
  }

  function walkStatements(statements: Statement[]) {
    for (const stmt of statements) {
      if (stmt.type === "Return") {
        if (stmt.value === null) {
          hasNonLiteralReturn = true;
          continue;
        }
        const ok = walkExpr(stmt.value);
        if (!ok) hasNonLiteralReturn = true;
      } else if (stmt.type === "If") {
        walkStatements(stmt.consequent);
        if (stmt.alternate) walkStatements(stmt.alternate);
      }
    }
  }

  walkStatements(fn.body);
  return { literals, hasNonLiteralReturn };
}

// Checks whether the function body guarantees a return on every code path
// (every if has an else, and both branches return, OR a final return exists).
export function allPathsReturn(statements: Statement[]): boolean {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.type === "Return") return true;
    if (stmt.type === "If" && stmt.alternate) {
      if (allPathsReturn(stmt.consequent) && allPathsReturn(stmt.alternate)) {
        return true;
      }
    }
  }
  return false;
}
