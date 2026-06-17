import type { PlayerDraft, TeamId } from "../game/types";
import { PlayerConfigPanel } from "./PlayerConfigPanel";

interface ConfigurationScreenProps {
  players: Record<TeamId, PlayerDraft>;
  issues: string[];
  canStartMatch: boolean;
  onUpdatePlayer: (teamId: TeamId, patch: Partial<Omit<PlayerDraft, "validation">>) => void;
  onValidatePlayer: (teamId: TeamId) => void;
  onStartMatch: () => void;
}

export function ConfigurationScreen({
  players,
  issues,
  canStartMatch,
  onUpdatePlayer,
  onValidatePlayer,
  onStartMatch,
}: ConfigurationScreenProps) {
  return (
    <main className="screen screen--configuration">
      <header className="hero-header">
        <h1>Battle of Cells</h1>
        <p className="hero-header__summary">
          Configure two teams, validate both TypeScript-style strategies, then launch the
          fully local simulation.
        </p>
      </header>

      <section className="configuration-grid">
        <PlayerConfigPanel
          player={players.p1}
          label="Player 1"
          accentClassName="cyan"
          onUpdatePlayer={onUpdatePlayer}
          onValidatePlayer={onValidatePlayer}
        />

        <aside className="panel rules-panel">
          <header className="panel__header">
            <h2>Rules</h2>
          </header>
          <div className="rules-panel__body">
            <dl className="rules-list">
              <div>
                <dt>Board</dt>
                <dd>100 x 200 fixed grid rendered in full with randomized starting spawns.</dd>
              </div>
              <div>
                <dt>Actions</dt>
                <dd>Move, attack, or reproduce once per turn. Every attack is an instant elimination.</dd>
              </div>
              <div>
                <dt>Turn Limit</dt>
                <dd>5000 turns, resolved after the full last turn executes.</dd>
              </div>
              <div>
                <dt>Turn Order</dt>
                <dd>Newer cells act first. Ties are decided by lower internal id.</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>No loops, no imports, no dangerous APIs, literal action returns only.</dd>
              </div>
            </dl>

            <div className="play-panel">
              <button
                type="button"
                className="action-button action-button--primary action-button--large"
                onClick={onStartMatch}
                disabled={!canStartMatch}
              >
                Play Match
              </button>
              <ul className="issue-list">
                {(issues.length > 0
                  ? issues
                  : ["Both teams are ready. Press Play Match to lock the setup."]).map(
                  (issue) => (
                    <li key={issue}>{issue}</li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </aside>

        <PlayerConfigPanel
          player={players.p2}
          label="Player 2"
          accentClassName="coral"
          onUpdatePlayer={onUpdatePlayer}
          onValidatePlayer={onValidatePlayer}
        />
      </section>
    </main>
  );
}
