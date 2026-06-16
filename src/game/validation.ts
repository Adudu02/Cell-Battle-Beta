import ts from "typescript";
import { ACTION_CODES } from "./constants";
import type {
  ActionCode,
  AlgorithmRunner,
  CellContext,
  ValidationResult,
} from "./types";

const workerUrl = new URL("./algorithmWorker.ts", import.meta.url);

const ACTION_SET = new Set<ActionCode>(ACTION_CODES);

const SAMPLE_CONTEXT: CellContext = {
  health: 60,
  position: { row: 50, col: 50 },
  teamTotalHealth: 120,
  currentTurn: 1,
  boardSize: { rows: 100, cols: 200 },
  neighbors: {
    north: "empty",
    south: "allied",
    east: "enemy",
    west: "empty",
    northeast: "outside",
    northwest: "empty",
    southeast: "enemy",
    southwest: "allied",
  },
  nearbyAllies: ["south", "southwest"],
  nearbyEnemies: ["east", "southeast"],
  hasNearbyAllies: true,
  hasNearbyEnemies: true,
};

const FORBIDDEN_NODE_MESSAGES = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.ForStatement, "Loops are not allowed in the MVP."],
  [ts.SyntaxKind.ForOfStatement, "Loops are not allowed in the MVP."],
  [ts.SyntaxKind.ForInStatement, "Loops are not allowed in the MVP."],
  [ts.SyntaxKind.WhileStatement, "Loops are not allowed in the MVP."],
  [ts.SyntaxKind.DoStatement, "Loops are not allowed in the MVP."],
  [ts.SyntaxKind.ImportDeclaration, "Imports are not allowed."],
  [ts.SyntaxKind.ImportEqualsDeclaration, "Imports are not allowed."],
  [ts.SyntaxKind.ExportAssignment, "Only function decide(context) is allowed."],
  [ts.SyntaxKind.ClassDeclaration, "Classes are not allowed."],
  [ts.SyntaxKind.FunctionExpression, "Nested functions are not allowed."],
  [ts.SyntaxKind.ArrowFunction, "Nested functions are not allowed."],
  [ts.SyntaxKind.CallExpression, "Function calls are not allowed in MVP algorithms."],
  [ts.SyntaxKind.NewExpression, "Constructors are not allowed in MVP algorithms."],
  [ts.SyntaxKind.AwaitExpression, "Async execution is not allowed."],
  [ts.SyntaxKind.TryStatement, "try/catch is not allowed in MVP algorithms."],
  [ts.SyntaxKind.SwitchStatement, "Use if/else instead of switch."],
]);

const ALLOWED_BINARY_OPERATORS = new Set<number>([
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
]);

const ALLOWED_PREFIX_OPERATORS = new Set<number>([
  ts.SyntaxKind.ExclamationToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.PlusToken,
]);

function normalizeAlgorithmSource(source: string): string {
  return source
    .replace(/^\uFEFF/, "")
    .replace(/export\s+default\s+function\s+decide/g, "function decide")
    .replace(/export\s+function\s+decide/g, "function decide")
    .trim();
}

function formatDiagnostic(diagnostic: ts.DiagnosticWithLocation): string {
  const position = diagnostic.file.getLineAndCharacterOfPosition(
    diagnostic.start ?? 0,
  );
  const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
  return `Line ${position.line + 1}, Col ${position.character + 1}: ${message}`;
}

function isDeclarationIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;

  return (
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isParameter(parent) && parent.name === node) ||
    (ts.isVariableDeclaration(parent) && parent.name === node)
  );
}

function isPropertyNameIdentifier(node: ts.Identifier): boolean {
  const parent = node.parent;

  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isShorthandPropertyAssignment(parent) && parent.name === node)
  );
}

function buildRunnerFromSource(normalizedSource: string): AlgorithmRunner {
  const transpiled = ts.transpileModule(normalizedSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
    },
  }).outputText;

  const factory = new Function(`
"use strict";
const window = undefined;
const document = undefined;
const globalThis = undefined;
const self = undefined;
const fetch = undefined;
const XMLHttpRequest = undefined;
const WebSocket = undefined;
const EventSource = undefined;
const Worker = undefined;
const SharedWorker = undefined;
const localStorage = undefined;
const sessionStorage = undefined;
const indexedDB = undefined;
const navigator = undefined;
const location = undefined;
const postMessage = undefined;
const importScripts = undefined;
const Function = undefined;
const setTimeout = undefined;
const setInterval = undefined;
${transpiled}
if (typeof decide !== "function") {
  throw new Error("Algorithm must declare function decide(context).");
}
return decide;
`);

  const decide = factory() as (context: CellContext) => unknown;

  return (context: CellContext) => {
    const action = decide(deepFreeze(cloneContext(context)));
    if (typeof action !== "string" || !ACTION_SET.has(action as ActionCode)) {
      throw new Error("Algorithm returned an invalid action code.");
    }
    return action as ActionCode;
  };
}

function cloneContext(context: CellContext): CellContext {
  return {
    ...context,
    position: { ...context.position },
    boardSize: { ...context.boardSize },
    neighbors: { ...context.neighbors },
    nearbyAllies: [...context.nearbyAllies],
    nearbyEnemies: [...context.nearbyEnemies],
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }

  return value;
}

function runStructuralValidation(normalizedSource: string): string[] {
  const sourceFile = ts.createSourceFile(
    "algorithm.ts",
    normalizedSource,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS,
  );

  const diagnostics: string[] = (
    sourceFile as ts.SourceFile & { parseDiagnostics?: ts.DiagnosticWithLocation[] }
  ).parseDiagnostics?.map((diagnostic: ts.DiagnosticWithLocation) =>
    formatDiagnostic(diagnostic),
  ) ?? [];

  const functions = sourceFile.statements.filter(ts.isFunctionDeclaration);

  if (functions.length !== 1 || functions[0]?.name?.text !== "decide") {
    diagnostics.push("Declare exactly one function named decide(context).");
  }

  for (const statement of sourceFile.statements) {
    if (
      !ts.isFunctionDeclaration(statement) &&
      !ts.isInterfaceDeclaration(statement) &&
      !ts.isTypeAliasDeclaration(statement) &&
      !ts.isEmptyStatement(statement)
    ) {
      diagnostics.push(
        "Only type declarations and a single function decide(context) are allowed.",
      );
    }
  }

  const decideFunction = functions[0];

  if (!decideFunction?.body) {
    diagnostics.push("Function decide(context) must have a body.");
    return diagnostics;
  }

  if (decideFunction.parameters.length !== 1) {
    diagnostics.push("Function decide must receive exactly one parameter.");
  }

  const allowedVariables = new Set<string>();
  const contextName = decideFunction.parameters[0]?.name;

  if (!contextName || !ts.isIdentifier(contextName)) {
    diagnostics.push("The decide parameter must be a simple identifier.");
  } else {
    allowedVariables.add(contextName.text);
  }

  const visit = (node: ts.Node): void => {
    const customMessage = FORBIDDEN_NODE_MESSAGES.get(node.kind);
    if (customMessage) {
      diagnostics.push(customMessage);
      return;
    }

    if (
      node.kind >= ts.SyntaxKind.FirstToken &&
      node.kind <= ts.SyntaxKind.LastToken &&
      !ts.isIdentifier(node) &&
      !ts.isStringLiteralLike(node) &&
      !ts.isNumericLiteral(node)
    ) {
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      if (!ts.isIdentifier(node.name)) {
        diagnostics.push("Destructuring is not allowed in MVP algorithms.");
        return;
      }

      allowedVariables.add(node.name.text);
    }

    if (
      ts.isVariableDeclarationList(node) &&
      (node.flags & ts.NodeFlags.Let) === 0 &&
      (node.flags & ts.NodeFlags.Const) === 0
    ) {
      diagnostics.push("Use const or let instead of var.");
    }

    if (ts.isReturnStatement(node)) {
      if (!node.expression || !ts.isStringLiteralLike(node.expression)) {
        diagnostics.push("Return statements must return a valid action string literal.");
      } else if (!ACTION_SET.has(node.expression.text as ActionCode)) {
        diagnostics.push(
          `Invalid action "${node.expression.text}". Use one of the allowed action codes.`,
        );
      }
    }

    if (ts.isBinaryExpression(node)) {
      if (!ALLOWED_BINARY_OPERATORS.has(node.operatorToken.kind)) {
        diagnostics.push("Only comparisons, logic, and simple arithmetic are allowed.");
      }
    }

    if (ts.isPrefixUnaryExpression(node)) {
      if (!ALLOWED_PREFIX_OPERATORS.has(node.operator)) {
        diagnostics.push("Only !, +, and - unary operators are allowed.");
      }
    }

    if (ts.isPostfixUnaryExpression(node)) {
      diagnostics.push("Increment and decrement operators are not allowed.");
    }

    if (ts.isIdentifier(node)) {
      if (isDeclarationIdentifier(node) || isPropertyNameIdentifier(node)) {
        return;
      }

      if (!allowedVariables.has(node.text)) {
        diagnostics.push(`Identifier "${node.text}" is not allowed in MVP algorithms.`);
      }
    }

    if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      return;
    }

    if (
      ts.isConditionalExpression(node) ||
      ts.isIfStatement(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isPropertyAccessExpression(node) ||
      ts.isStringLiteralLike(node) ||
      ts.isNumericLiteral(node) ||
      node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.NullKeyword ||
      ts.isBlock(node) ||
      ts.isExpressionStatement(node) ||
      ts.isVariableStatement(node) ||
      ts.isReturnStatement(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isSourceFile(node) ||
      ts.isParameter(node) ||
      ts.isBinaryExpression(node) ||
      ts.isPrefixUnaryExpression(node) ||
      ts.isVariableDeclaration(node) ||
      ts.isVariableDeclarationList(node)
    ) {
      ts.forEachChild(node, visit);
      return;
    }

    if (
      !ts.isBinaryExpression(node) &&
      !ts.isPrefixUnaryExpression(node) &&
      !ts.isIdentifier(node) &&
      !ts.isVariableDeclaration(node) &&
      !ts.isVariableDeclarationList(node)
    ) {
      const kindName = ts.SyntaxKind[node.kind];
      diagnostics.push(`Syntax kind "${kindName}" is not supported in MVP algorithms.`);
    }
  };

  visit(decideFunction);
  return [...new Set(diagnostics)];
}

function probeAlgorithmExecution(normalizedSource: string): void {
  const runner = buildRunnerFromSource(normalizedSource);
  const action = runner(SAMPLE_CONTEXT);
  if (!ACTION_SET.has(action)) {
    throw new Error("Algorithm returned an invalid action code.");
  }
}

async function probeWithWorker(normalizedSource: string): Promise<void> {
  if (
    typeof Worker === "undefined" ||
    (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent))
  ) {
    probeAlgorithmExecution(normalizedSource);
    return;
  }

  const worker = new Worker(workerUrl, { type: "module" });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        worker.terminate();
        reject(new Error("Algorithm execution exceeded the 1 second timeout."));
      }, 1000);

      worker.onmessage = (event: MessageEvent<{ ok: boolean; error?: string }>) => {
        window.clearTimeout(timeout);
        worker.terminate();

        if (event.data.ok) {
          resolve();
        } else {
          reject(new Error(event.data.error ?? "Algorithm probe failed."));
        }
      };

      worker.onerror = () => {
        window.clearTimeout(timeout);
        worker.terminate();
        reject(new Error("Algorithm worker crashed during validation."));
      };

      worker.postMessage({
        source: normalizedSource,
        context: SAMPLE_CONTEXT,
      });
    });
  } finally {
    worker.terminate();
  }
}

export async function validateAlgorithm(source: string): Promise<ValidationResult> {
  const normalizedSource = normalizeAlgorithmSource(source);
  const diagnostics = runStructuralValidation(normalizedSource);

  if (diagnostics.length > 0) {
    return { isValid: false, normalizedSource, diagnostics };
  }

  try {
    await probeWithWorker(normalizedSource);
    return { isValid: true, normalizedSource, diagnostics: ["Validation passed."] };
  } catch (error) {
    return {
      isValid: false,
      normalizedSource,
      diagnostics: [error instanceof Error ? error.message : "Validation failed."],
    };
  }
}

export function createAlgorithmRunner(source: string): AlgorithmRunner {
  const normalizedSource = normalizeAlgorithmSource(source);
  const diagnostics = runStructuralValidation(normalizedSource);
  if (diagnostics.length > 0) {
    throw new Error(diagnostics[0]);
  }

  return buildRunnerFromSource(normalizedSource);
}
