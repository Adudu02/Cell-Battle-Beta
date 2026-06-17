# Process Difference Diagram

This document compares the runtime process used by the `second` branch and the `code-fixed` branch.

## High-Level Comparison

```mermaid
flowchart LR
    A[Player writes decide(context)] --> B{Branch}

    B --> S1[second]
    B --> C1[code-fixed]

    S1 --> S2[TypeScript AST validation]
    S2 --> S3[Transpile with TypeScript]
    S3 --> S4[Run probe in worker]
    S4 --> S5[new Function sandbox attempt]
    S5 --> S6[Create algorithm runner]
    S6 --> S7[Engine executes turns]
    S7 --> S8[React updates snapshot UI]

    C1 --> C2[Custom tokenizer and parser]
    C2 --> C3[Restricted interpreter validation]
    C3 --> C4[Run sample contexts]
    C4 --> C5[Parse once at match start]
    C5 --> C6[Interpreter executes per cell]
    C6 --> C7[Engine executes turns]
    C7 --> C8[React updates game state UI]
```

## Branch `second`

```mermaid
flowchart TD
    A1[User edits team name color and code] --> A2[Click Validate Algorithm]
    A2 --> A3[Normalize source]
    A3 --> A4[TypeScript syntax and rule checks]
    A4 -->|pass| A5[Spawn algorithm worker]
    A4 -->|fail| A11[Show validation diagnostics]
    A5 --> A6[Transpile source with TypeScript]
    A6 --> A7[Execute transpiled code via new Function]
    A7 --> A8[Freeze cloned context]
    A8 --> A9[Return action code probe]
    A9 -->|valid| A10[Mark player valid]
    A9 -->|invalid or error| A11
    A10 --> A12[Both players valid]
    A12 --> A13[Create engine with algorithm runners]
    A13 --> A14[Auto play or step turn]
    A14 --> A15[Engine sorts living cells and resolves actions]
    A15 --> A16[Snapshot pushed to React UI]
    A16 --> A17[Final screen on victory or turn limit]
```

## Branch `code-fixed`

```mermaid
flowchart TD
    B1[User edits team name color and code] --> B2[Click Validate]
    B2 --> B3[Custom tokenize and parse]
    B3 -->|fail| B11[Show validation errors]
    B3 -->|pass| B4[Check all paths return]
    B4 --> B5[Collect literal return codes]
    B5 --> B6[Run representative test contexts]
    B6 -->|valid| B7[Mark player valid]
    B6 -->|runtime error or invalid return| B11
    B7 --> B8[Press Play]
    B8 --> B9[Parse both algorithms once]
    B9 --> B10[Create initial game state]
    B10 --> B12[Play loop or step turn]
    B12 --> B13[Interpreter runs per cell action]
    B13 --> B14[Engine updates occupancy and cells]
    B14 --> B15[Evaluate end conditions]
    B15 --> B16[React updates final game state]
```

## Process Differences

```mermaid
flowchart TD
    D1[Validation technology] --> D2[second: TypeScript compiler + worker + new Function]
    D1 --> D3[code-fixed: custom parser + interpreter]

    D4[Execution model] --> D5[second: transpile once then execute generated JS]
    D4 --> D6[code-fixed: interpret restricted AST directly]

    D7[Security boundary] --> D8[second: sandbox by hiding globals]
    D7 --> D9[code-fixed: no eval or Function constructor]

    D10[Testing support] --> D11[second: test script exists but no test files]
    D10 --> D12[code-fixed: engine and stress scripts included]

    D13[Bundle impact] --> D14[second: large client bundle from TypeScript-based validation]
    D13 --> D15[code-fixed: smaller client bundle with custom interpreter]

    D16[UX flow] --> D17[second: persistence and speed controls]
    D16 --> D18[code-fixed: simpler UI flow]
```

## Summary

- `second` uses the TypeScript compiler and a worker-based probe before creating runtime algorithm runners.
- `code-fixed` uses a custom restricted-language interpreter from validation through simulation.
- `second` has the stronger UI flow.
- `code-fixed` has the stronger execution model, smaller bundle, and better verification support.
