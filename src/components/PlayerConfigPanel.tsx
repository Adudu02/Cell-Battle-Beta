import CodeEditor from "./CodeEditor";
import { TEAM_COLOR_SCHEME } from "../game/constants";
import { validateAlgorithm, type ValidationResult } from "../game/validation";

interface PlayerConfigPanelProps {
  playerLabel: string;
  name: string;
  color: string;
  code: string;
  validated: boolean;
  validationResult: ValidationResult | null;
  duplicateNameError: boolean;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onCodeChange: (code: string) => void;
  onValidate: (result: ValidationResult) => void;
}

export default function PlayerConfigPanel({
  playerLabel,
  name,
  color,
  code,
  validated,
  validationResult,
  duplicateNameError,
  onNameChange,
  onColorChange,
  onCodeChange,
  onValidate,
}: PlayerConfigPanelProps) {
  const handleValidate = () => {
    const result = validateAlgorithm(code);
    onValidate(result);
  };

  return (
    <div className="panel">
      <h2>
        <span className="swatch" style={{ background: color }} />
        {playerLabel}
      </h2>

      <div className="field-row">
        <label htmlFor={`${playerLabel}-name`}>Team name</label>
        <input
          id={`${playerLabel}-name`}
          type="text"
          value={name}
          placeholder="e.g. Crimson Swarm"
          onChange={(e) => onNameChange(e.target.value)}
          maxLength={24}
        />
        {duplicateNameError && (
          <div className="validation-result error">Team names must be unique.</div>
        )}
        {name.trim().length === 0 && (
          <div className="empty-note">Enter a team name to continue.</div>
        )}
      </div>

      <div className="field-row">
        <label>Team color</label>
        <div className="color-options">
          {TEAM_COLOR_SCHEME.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`color-swatch ${color === c.value ? "selected" : ""}`}
              style={{ background: c.value, color: c.value }}
              title={c.name}
              aria-label={c.name}
              onClick={() => onColorChange(c.value)}
            />
          ))}
        </div>
      </div>

      <div className="field-row">
        <label htmlFor={`${playerLabel}-code`}>Algorithm (function decide(context) {"{ ... }"})</label>
        <CodeEditor id={`${playerLabel}-code`} value={code} onChange={onCodeChange} />
      </div>

      <button onClick={handleValidate} className="primary">
        Validate Algorithm
      </button>

      {validationResult && (
        <div className={`validation-result ${validationResult.valid ? "success" : "error"}`}>
          {validationResult.valid ? (
            <span>Algorithm is valid.</span>
          ) : (
            <>
              <strong>Validation failed:</strong>
              <ul>
                {validationResult.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {validated && !validationResult && (
        <div className="validation-result success">Algorithm is valid.</div>
      )}
    </div>
  );
}
