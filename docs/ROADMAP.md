# Battle of Cells Roadmap

## Phase 0: Context Recovery

* inspect the surviving frontend,
* identify missing docs and scaffolding,
* confirm obsolete gameplay is removed from the plan.

## Phase 1: Documentation Repair

* rewrite the specification,
* align architecture and API docs,
* document all removed rules,
* establish the docs as the source of truth.

## Phase 2: Tests First

* create backend unit tests for rules,
* create backend API tests,
* create frontend workflow tests,
* let tests define the implementation target.

## Phase 3: Engine Rebuild

* implement board, ordering, actions, scoring, and turn flow from scratch,
* remove age-damage and old-age death,
* keep rules independent from React.

## Phase 4: Safe Strategy Validation

* implement the restricted Python-like parser and interpreter,
* reject unsafe syntax and invalid action returns,
* support runtime error logging without aborting the match.

## Phase 5: Backend Integration

* expose validation and match-control routes,
* keep one active match in memory,
* return serializable state to the frontend.

## Phase 6: Frontend Alignment

* preserve the existing UI components where possible,
* replace local-engine coupling with backend API calls,
* keep configuration, simulation, and final-result flow intact.

## Phase 7: End-to-End Verification

* run automated tests,
* verify the app locally,
* document exact commands,
* leave the repository in a reproducible state.
