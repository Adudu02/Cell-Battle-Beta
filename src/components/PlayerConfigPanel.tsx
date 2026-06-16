import type { CSSProperties } from "react";
import { TEAM_COLORS } from "../game/constants";
import type { PlayerDraft, TeamId } from "../game/types";
import { CodeEditor } from "./CodeEditor";

interface PlayerConfigPanelProps {
  player: PlayerDraft;
  label: string;
  accentClassName: "cyan" | "coral";
  onUpdatePlayer: (teamId: TeamId, patch: Partial<Omit<PlayerDraft, "validation">>) => void;
  onValidatePlayer: (teamId: TeamId) => void;
}

export function PlayerConfigPanel({
  player,
  label,
  accentClassName,
  onUpdatePlayer,
  onValidatePlayer,
}: PlayerConfigPanelProps) {
  const isValid = player.validation.status === "valid";
  const isInvalid = player.validation.status === "invalid";
  const isValidating = player.validation.status === "validating";

  return (
    <section className={`panel player-panel player-panel--${accentClassName}`}>
      <header className="panel__header">
        <h2>{label}</h2>
      </header>
      <div className="player-panel__body">
        <label className="field">
          <span className="field__label">Team Name</span>
          <input
            type="text"
            maxLength={28}
            value={player.teamName}
            onChange={(event) =>
              onUpdatePlayer(player.id, { teamName: event.target.value })
            }
            className="text-input"
          />
        </label>

        <div className="field">
          <span className="field__label">Team Color</span>
          <div className="swatches" role="radiogroup" aria-label={`${label} color`}>
            {TEAM_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`swatch${player.teamColor === color ? " swatch--selected" : ""}`}
                style={{ "--swatch": color } as CSSProperties}
                onClick={() => onUpdatePlayer(player.id, { teamColor: color })}
                aria-pressed={player.teamColor === color}
                aria-label={`Use ${color}`}
              />
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Algorithm</span>
          <CodeEditor
            value={player.algorithmSource}
            onChange={(algorithmSource) =>
              onUpdatePlayer(player.id, { algorithmSource })
            }
          />
        </div>

        <button
          type="button"
          className="action-button action-button--secondary"
          onClick={() => onValidatePlayer(player.id)}
          disabled={isValidating}
        >
          {isValidating ? "Validating..." : "Validate Algorithm"}
        </button>

        <div
          className={[
            "feedback-box",
            isValid ? "feedback-box--valid" : "",
            isInvalid ? "feedback-box--invalid" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <strong>
            {isValid
              ? "Validation Passed"
              : isInvalid
                ? "Validation Error"
                : "Awaiting Validation"}
          </strong>
          <ul>
            {(player.validation.diagnostics.length > 0
              ? player.validation.diagnostics
              : ["Run validation before starting the match."]).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
