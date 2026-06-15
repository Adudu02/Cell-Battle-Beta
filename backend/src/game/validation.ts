import { BOARD_COLS, BOARD_ROWS } from './constants.js';
import { isValidActionCode } from './actions.js';
import type {
  BinaryExpression,
  Expression,
  IfStatement,
  PlayerDefinition,
  PlayerSubmission,
  Statement,
  StrategyCellContext,
  StrategyExecutor,
  StrategyEnvironmentContext,
  StrategyProgram,
  ValidationResult,
} from './types.js';

interface PreparedLine {
  lineNumber: number;
  indent: number;
  text: string;
}

interface ParseBlockResult {
  statements: Statement[];
  nextIndex: number;
}

interface ParsedIfStatement {
  statement: IfStatement;
  nextIndex: number;
}

interface Token {
  type: 'identifier' | 'string' | 'number' | 'operator' | 'paren';
  value: string;
}

const FORBIDDEN_PATTERN = /\b(for|while|import|from|exec|eval|open|class|lambda|try|except|with|match|case)\b|__/;
const ALLOWED_CELL_KEYS = new Set(['health', 'age', 'row', 'col']);
const ALLOWED_ENVIRONMENT_KEYS = new Set([
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
  'team_health',
  'turn',
  'rows',
  'cols',
  'has_adjacent_ally',
  'has_adjacent_enemy',
  'enemy_count',
  'occupied_count',
  'empty_count',
  'first_enemy_direction',
  'north_occupied_count',
  'south_occupied_count',
  'east_occupied_count',
  'west_occupied_count',
]);

const SAMPLE_CELL: StrategyCellContext = {
  health: 100,
  age: 1,
  row: 10,
  col: 10,
};

const SAMPLE_ENVIRONMENT: StrategyEnvironmentContext = {
  n: 'empty',
  s: 'enemy',
  e: 'allied',
  w: 'outside',
  ne: 'empty',
  nw: 'outside',
  se: 'enemy',
  sw: 'allied',
  team_health: 100,
  turn: 1,
  rows: BOARD_ROWS,
  cols: BOARD_COLS,
  has_adjacent_ally: true,
  has_adjacent_enemy: true,
  enemy_count: 2,
  occupied_count: 4,
  empty_count: 4,
  first_enemy_direction: 's',
  north_occupied_count: 1,
  south_occupied_count: 2,
  east_occupied_count: 1,
  west_occupied_count: 0,
};

export function validateStrategy(code: string): ValidationResult {
  if (!code.trim()) {
    return { isValid: false, errors: ['Code editor is empty.'] };
  }

  const normalizedCode = code.replace(/\r\n/g, '\n').replace(/\t/g, '    ');

  try {
    const lines = prepareLines(normalizedCode);
    if (lines.length === 0) {
      return { isValid: false, errors: ['Code editor is empty.'] };
    }

    if (FORBIDDEN_PATTERN.test(normalizedCode)) {
      return {
        isValid: false,
        errors: ['Only the MVP subset is allowed. Loops, imports, and dangerous features are blocked.'],
      };
    }

    const header = lines[0].text;
    if (header !== 'def action(cell, environment):') {
      return {
        isValid: false,
        errors: ['The function must be exactly `def action(cell, environment):`.'],
      };
    }

    const { statements, nextIndex } = parseBlock(lines, 1, 4);
    if (nextIndex !== lines.length) {
      throw new Error(`Unexpected statement on line ${lines[nextIndex].lineNumber}.`);
    }

    if (statements.length === 0) {
      throw new Error('The function body must contain at least one return path.');
    }

    const program: StrategyProgram = { body: statements };
    program.executor = compileProgram(program);
    const startedAt = Date.now();
    const execution = executeStrategy(program, SAMPLE_CELL, SAMPLE_ENVIRONMENT);
    if (Date.now() - startedAt > 1000) {
      throw new Error('Validation timed out after 1 second.');
    }
    if (!execution.action || !isValidActionCode(execution.action)) {
      throw new Error('Validation test context did not return a valid action code.');
    }

    return {
      isValid: true,
      errors: [],
      normalizedCode,
      program,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Strategy validation failed.'],
    };
  }
}

export function executeStrategy(
  program: StrategyProgram,
  cell: StrategyCellContext,
  environment: StrategyEnvironmentContext,
): { action: string | null; error: string | null } {
  try {
    if (program.executor) {
      return {
        action: program.executor(cell, environment),
        error: null,
      };
    }

    for (const statement of program.body) {
      const result = executeStatement(statement, cell, environment);
      if (result) {
        return { action: result, error: null };
      }
    }
    return { action: null, error: 'Function finished without returning an action.' };
  } catch (error) {
    return {
      action: null,
      error: error instanceof Error ? error.message : 'Strategy execution failed.',
    };
  }
}

export function getValidatedProgram(player: PlayerDefinition): StrategyProgram | null {
  return player.validation.isValid ? player.validation.program ?? null : null;
}

export function validateMatchSetup(players: [PlayerSubmission, PlayerSubmission]): string[] {
  const issues: string[] = [];
  const [playerOne, playerTwo] = players;

  if (!playerOne.name.trim()) {
    issues.push('Player 1 needs a team name.');
  }

  if (!playerTwo.name.trim()) {
    issues.push('Player 2 needs a team name.');
  }

  if (
    playerOne.name.trim() &&
    playerTwo.name.trim() &&
    playerOne.name.trim().toLowerCase() === playerTwo.name.trim().toLowerCase()
  ) {
    issues.push('Team names must be different.');
  }

  const validationOne = validateStrategy(playerOne.code);
  if (!validationOne.isValid) {
    issues.push('Player 1 strategy is invalid.');
  }

  const validationTwo = validateStrategy(playerTwo.code);
  if (!validationTwo.isValid) {
    issues.push('Player 2 strategy is invalid.');
  }

  return issues;
}

function prepareLines(code: string): PreparedLine[] {
  return code
    .split('\n')
    .map((rawLine, index) => ({
      rawLine,
      lineNumber: index + 1,
    }))
    .map(({ rawLine, lineNumber }) => {
      const withoutComment = stripComment(rawLine);
      const trimmed = withoutComment.trimEnd();
      const indent = trimmed.trim() ? trimmed.search(/\S/) : 0;

      return {
        lineNumber,
        indent: indent < 0 ? 0 : indent,
        text: trimmed.trim(),
      };
    })
    .filter((line) => line.text.length > 0);
}

function stripComment(line: string): string {
  let inString = false;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (inString) {
      if (char === quote) {
        inString = false;
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === '#') {
      return line.slice(0, index);
    }
  }

  return line;
}

function parseBlock(lines: PreparedLine[], startIndex: number, expectedIndent: number): ParseBlockResult {
  const statements: Statement[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index];

    if (line.indent < expectedIndent) {
      break;
    }

    if (line.indent !== expectedIndent) {
      throw new Error(`Unexpected indentation on line ${line.lineNumber}.`);
    }

    if (line.text.startsWith('if ')) {
      const parsedIf = parseIfStatement(lines, index, expectedIndent);
      statements.push(parsedIf.statement);
      index = parsedIf.nextIndex;
      continue;
    }

    if (line.text === 'else:') {
      break;
    }

    if (line.text.startsWith('return ')) {
      statements.push(parseReturnStatement(line.text, line.lineNumber));
      index += 1;
      continue;
    }

    throw new Error(`Unsupported statement on line ${line.lineNumber}. Only if/else and return are allowed.`);
  }

  return { statements, nextIndex: index };
}

function parseIfStatement(lines: PreparedLine[], startIndex: number, expectedIndent: number): ParsedIfStatement {
  const line = lines[startIndex];
  if (!line.text.endsWith(':')) {
    throw new Error(`If statement on line ${line.lineNumber} must end with a colon.`);
  }

  const conditionText = line.text.slice(3, -1).trim();
  const condition = parseExpression(conditionText, line.lineNumber);
  const consequent = parseBlock(lines, startIndex + 1, expectedIndent + 4);
  if (consequent.statements.length === 0) {
    throw new Error(`If block on line ${line.lineNumber} must contain a return path.`);
  }

  const nextLine = lines[consequent.nextIndex];
  if (nextLine && nextLine.indent === expectedIndent && nextLine.text === 'else:') {
    const alternate = parseBlock(lines, consequent.nextIndex + 1, expectedIndent + 4);
    if (alternate.statements.length === 0) {
      throw new Error(`Else block on line ${nextLine.lineNumber} must contain a return path.`);
    }

    return {
      statement: {
        type: 'if',
        condition,
        consequent: consequent.statements,
        alternate: alternate.statements,
      },
      nextIndex: alternate.nextIndex,
    };
  }

  return {
    statement: {
      type: 'if',
      condition,
      consequent: consequent.statements,
    },
    nextIndex: consequent.nextIndex,
  };
}

function parseReturnStatement(text: string, lineNumber: number): Statement {
  const literalText = text.slice('return '.length).trim();
  const value = parseStringLiteral(literalText, lineNumber);

  if (!isValidActionCode(value)) {
    throw new Error(`Return value on line ${lineNumber} must be a valid action code literal.`);
  }

  return {
    type: 'return',
    value,
  };
}

function parseStringLiteral(value: string, lineNumber: number): string {
  if (value.length < 2) {
    throw new Error(`Return value on line ${lineNumber} must be a string literal.`);
  }

  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value[value.length - 1] !== quote) {
    throw new Error(`Line ${lineNumber} must use a quoted string literal.`);
  }

  const body = value.slice(1, -1);
  return body.replace(/\\(["'])/g, '$1').replace(/\\\\/g, '\\');
}

function parseExpression(source: string, lineNumber: number): Expression {
  const tokens = tokenize(source, lineNumber);
  let index = 0;

  function peek(): Token | undefined {
    return tokens[index];
  }

  function consume(expectedValue?: string): Token {
    const token = tokens[index];
    if (!token) {
      throw new Error(`Unexpected end of expression on line ${lineNumber}.`);
    }
    if (expectedValue && token.value !== expectedValue) {
      throw new Error(`Expected \`${expectedValue}\` on line ${lineNumber}.`);
    }
    index += 1;
    return token;
  }

  function parseOr(): Expression {
    let expression = parseAnd();
    while (peek()?.value === 'or') {
      consume('or');
      expression = {
        type: 'binary',
        operator: 'or',
        left: expression,
        right: parseAnd(),
      };
    }
    return expression;
  }

  function parseAnd(): Expression {
    let expression = parseNot();
    while (peek()?.value === 'and') {
      consume('and');
      expression = {
        type: 'binary',
        operator: 'and',
        left: expression,
        right: parseNot(),
      };
    }
    return expression;
  }

  function parseNot(): Expression {
    if (peek()?.value === 'not') {
      consume('not');
      return {
        type: 'unary',
        operator: 'not',
        expression: parseNot(),
      };
    }

    return parseComparison();
  }

  function parseComparison(): Expression {
    const left = parsePrimary();
    const operator = peek()?.value;

    if (operator && ['==', '!=', '<', '<=', '>', '>='].includes(operator)) {
      consume(operator);
      return {
        type: 'binary',
        operator: operator as BinaryExpression['operator'],
        left,
        right: parsePrimary(),
      };
    }

    return left;
  }

  function parsePrimary(): Expression {
    const token = peek();
    if (!token) {
      throw new Error(`Unexpected end of expression on line ${lineNumber}.`);
    }

    if (token.type === 'paren' && token.value === '(') {
      consume('(');
      const expression = parseOr();
      consume(')');
      return expression;
    }

    if (token.type === 'number') {
      consume();
      return { type: 'literal', value: Number(token.value) };
    }

    if (token.type === 'string') {
      consume();
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'identifier') {
      if (token.value === 'True' || token.value === 'False') {
        consume();
        return { type: 'literal', value: token.value === 'True' };
      }

      if (token.value !== 'cell' && token.value !== 'environment') {
        throw new Error(`Only \`cell["..."]\` and \`environment["..."]\` lookups are allowed on line ${lineNumber}.`);
      }

      const sourceName = consume().value as 'cell' | 'environment';
      consume('[');
      const keyToken = consume();
      if (keyToken.type !== 'string') {
        throw new Error(`Lookup keys must be string literals on line ${lineNumber}.`);
      }
      consume(']');

      const isAllowedKey =
        sourceName === 'cell' ? ALLOWED_CELL_KEYS.has(keyToken.value) : ALLOWED_ENVIRONMENT_KEYS.has(keyToken.value);
      if (!isAllowedKey) {
        throw new Error(`Lookup key "${keyToken.value}" is not allowed on line ${lineNumber}.`);
      }

      return {
        type: 'lookup',
        source: sourceName,
        key: keyToken.value,
      };
    }

    throw new Error(`Unsupported expression on line ${lineNumber}.`);
  }

  const expression = parseOr();
  if (index !== tokens.length) {
    throw new Error(`Unsupported expression tail on line ${lineNumber}.`);
  }

  return expression;
}

function tokenize(source: string, lineNumber: number): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const twoCharacterOperator = source.slice(index, index + 2);
    if (['==', '!=', '<=', '>='].includes(twoCharacterOperator)) {
      tokens.push({ type: 'operator', value: twoCharacterOperator });
      index += 2;
      continue;
    }

    if (['<', '>', '[', ']', '(', ')'].includes(char)) {
      tokens.push({
        type: char === '(' || char === ')' ? 'paren' : 'operator',
        value: char,
      });
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const end = findStringEnd(source, index, char);
      if (end === -1) {
        throw new Error(`Unterminated string literal on line ${lineNumber}.`);
      }
      tokens.push({
        type: 'string',
        value: parseStringLiteral(source.slice(index, end + 1), lineNumber),
      });
      index = end + 1;
      continue;
    }

    if (/\d/.test(char)) {
      let end = index + 1;
      while (end < source.length && /\d/.test(source[end])) {
        end += 1;
      }
      tokens.push({ type: 'number', value: source.slice(index, end) });
      index = end;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) {
        end += 1;
      }
      tokens.push({ type: 'identifier', value: source.slice(index, end) });
      index = end;
      continue;
    }

    throw new Error(`Unexpected token \`${char}\` on line ${lineNumber}.`);
  }

  return tokens;
}

function findStringEnd(source: string, startIndex: number, quote: string): number {
  let escaped = false;

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === quote) {
      return index;
    }
  }

  return -1;
}

function executeStatement(
  statement: Statement,
  cell: StrategyCellContext,
  environment: StrategyEnvironmentContext,
): string | null {
  if (statement.type === 'return') {
    return statement.value;
  }

  if (toBoolean(evaluateExpression(statement.condition, cell, environment))) {
    for (const nested of statement.consequent) {
      const result = executeStatement(nested, cell, environment);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (statement.alternate) {
    for (const nested of statement.alternate) {
      const result = executeStatement(nested, cell, environment);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

function evaluateExpression(
  expression: Expression,
  cell: StrategyCellContext,
  environment: StrategyEnvironmentContext,
): string | number | boolean {
  switch (expression.type) {
    case 'literal':
      return expression.value;
    case 'lookup':
      return getLookupValue(expression.source, expression.key, cell, environment);
    case 'unary':
      return !toBoolean(evaluateExpression(expression.expression, cell, environment));
    case 'binary':
      return evaluateBinary(expression, cell, environment);
  }
}

function evaluateBinary(
  expression: BinaryExpression,
  cell: StrategyCellContext,
  environment: StrategyEnvironmentContext,
): boolean {
  const left = evaluateExpression(expression.left, cell, environment);
  const right = evaluateExpression(expression.right, cell, environment);

  switch (expression.operator) {
    case 'and':
      return toBoolean(left) && toBoolean(right);
    case 'or':
      return toBoolean(left) || toBoolean(right);
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    case '<':
      return Number(left) < Number(right);
    case '<=':
      return Number(left) <= Number(right);
    case '>':
      return Number(left) > Number(right);
    case '>=':
      return Number(left) >= Number(right);
  }
}

function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

function getLookupValue(
  source: 'cell' | 'environment',
  key: string,
  cell: StrategyCellContext,
  environment: StrategyEnvironmentContext,
): string | number | boolean {
  if (source === 'cell') {
    switch (key) {
      case 'health':
        return cell.health;
      case 'age':
        return cell.age;
      case 'row':
        return cell.row;
      case 'col':
        return cell.col;
      default:
        throw new Error(`Cell key "${key}" is not allowed.`);
    }
  }

  switch (key) {
    case 'n':
      return environment.n;
    case 's':
      return environment.s;
    case 'e':
      return environment.e;
    case 'w':
      return environment.w;
    case 'ne':
      return environment.ne;
    case 'nw':
      return environment.nw;
    case 'se':
      return environment.se;
    case 'sw':
      return environment.sw;
    case 'team_health':
      return environment.team_health;
    case 'turn':
      return environment.turn;
    case 'rows':
      return environment.rows;
    case 'cols':
      return environment.cols;
    case 'has_adjacent_ally':
      return environment.has_adjacent_ally;
    case 'has_adjacent_enemy':
      return environment.has_adjacent_enemy;
    case 'enemy_count':
      return environment.enemy_count;
    case 'occupied_count':
      return environment.occupied_count;
    case 'empty_count':
      return environment.empty_count;
    case 'first_enemy_direction':
      return environment.first_enemy_direction;
    case 'north_occupied_count':
      return environment.north_occupied_count;
    case 'south_occupied_count':
      return environment.south_occupied_count;
    case 'east_occupied_count':
      return environment.east_occupied_count;
    case 'west_occupied_count':
      return environment.west_occupied_count;
    default:
      throw new Error(`Environment key "${key}" is not allowed.`);
  }
}

function compileProgram(program: StrategyProgram): StrategyExecutor {
  const executor = compileStatements(program.body);

  return (cell, environment) => executor(cell, environment);
}

function compileStatements(statements: Statement[]): StrategyExecutor {
  const compiledStatements = statements.map((statement) => compileStatement(statement));

  return (cell, environment) => {
    for (const compiledStatement of compiledStatements) {
      const result = compiledStatement(cell, environment);
      if (result !== null) {
        return result;
      }
    }

    return null;
  };
}

function compileStatement(statement: Statement): StrategyExecutor {
  if (statement.type === 'return') {
    const value = statement.value;
    return () => value;
  }

  const compiledCondition = compileExpression(statement.condition);
  const compiledConsequent = compileStatements(statement.consequent);
  const compiledAlternate = statement.alternate ? compileStatements(statement.alternate) : null;

  return (cell, environment) => {
    if (toBoolean(compiledCondition(cell, environment))) {
      return compiledConsequent(cell, environment);
    }

    return compiledAlternate ? compiledAlternate(cell, environment) : null;
  };
}

function compileExpression(
  expression: Expression,
): (cell: StrategyCellContext, environment: StrategyEnvironmentContext) => string | number | boolean {
  switch (expression.type) {
    case 'literal': {
      const value = expression.value;
      return () => value;
    }
    case 'lookup': {
      const source = expression.source;
      const key = expression.key;
      return (cell, environment) => getLookupValue(source, key, cell, environment);
    }
    case 'unary': {
      const compiledExpression = compileExpression(expression.expression);
      return (cell, environment) => !toBoolean(compiledExpression(cell, environment));
    }
    case 'binary': {
      const compiledLeft = compileExpression(expression.left);
      const compiledRight = compileExpression(expression.right);
      switch (expression.operator) {
        case 'and':
          return (cell, environment) =>
            toBoolean(compiledLeft(cell, environment)) && toBoolean(compiledRight(cell, environment));
        case 'or':
          return (cell, environment) =>
            toBoolean(compiledLeft(cell, environment)) || toBoolean(compiledRight(cell, environment));
        case '==':
          return (cell, environment) => compiledLeft(cell, environment) === compiledRight(cell, environment);
        case '!=':
          return (cell, environment) => compiledLeft(cell, environment) !== compiledRight(cell, environment);
        case '<':
          return (cell, environment) => Number(compiledLeft(cell, environment)) < Number(compiledRight(cell, environment));
        case '<=':
          return (cell, environment) => Number(compiledLeft(cell, environment)) <= Number(compiledRight(cell, environment));
        case '>':
          return (cell, environment) => Number(compiledLeft(cell, environment)) > Number(compiledRight(cell, environment));
        case '>=':
          return (cell, environment) => Number(compiledLeft(cell, environment)) >= Number(compiledRight(cell, environment));
      }
    }
  }
}
