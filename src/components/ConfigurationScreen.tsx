import { useState } from "react";
import PlayerConfigPanel from "./PlayerConfigPanel";
import type { Player } from "../game/types";
import { TEAM_COLOR_SCHEME } from "../game/constants";
import { PLAYER1_DEFAULT_TEMPLATE, PLAYER2_DEFAULT_TEMPLATE } from "../game/initialState";
import { validateAlgorithm, type ValidationResult } from "../game/validation";

interface ConfigurationScreenProps {
  onStart: (player1: Player, player2: Player) => void;
}

export default function ConfigurationScreen({ onStart }: ConfigurationScreenProps) {
  const [p1Name, setP1Name] = useState("Crimson Swarm");
  const [p1Color, setP1Color] = useState(TEAM_COLOR_SCHEME[0].value);
  const [p1Code, setP1Code] = useState(PLAYER1_DEFAULT_TEMPLATE);
  const [p1Validation, setP1Validation] = useState<ValidationResult | null>(null);

  const [p2Name, setP2Name] = useState("Ocean Cluster");
  const [p2Color, setP2Color] = useState(TEAM_COLOR_SCHEME[1].value);
  const [p2Code, setP2Code] = useState(PLAYER2_DEFAULT_TEMPLATE);
  const [p2Validation, setP2Validation] = useState<ValidationResult | null>(null);

  const namesValid = p1Name.trim().length > 0 && p2Name.trim().length > 0;
  const duplicateNames = namesValid && p1Name.trim().toLowerCase() === p2Name.trim().toLowerCase();

  const p1Valid = p1Validation?.valid === true;
  const p2Valid = p2Validation?.valid === true;

  const canStart = namesValid && !duplicateNames && p1Valid && p2Valid;

  const blockers: string[] = [];
  if (!namesValid) blockers.push("Both teams need a name.");
  if (duplicateNames) blockers.push("Team names must be different.");
  if (!p1Valid) blockers.push("Player 1's algorithm must be validated successfully.");
  if (!p2Valid) blockers.push("Player 2's algorithm must be validated successfully.");

  const handleStart = () => {
    if (!canStart) return;

    // Re-validate one last time to guard against stale results after edits
    const v1 = validateAlgorithm(p1Code);
    const v2 = validateAlgorithm(p2Code);
    if (!v1.valid || !v2.valid) {
      setP1Validation(v1);
      setP2Validation(v2);
      return;
    }

    const player1: Player = { id: 1, name: p1Name.trim(), color: p1Color, code: p1Code, validated: true };
    const player2: Player = { id: 2, name: p2Name.trim(), color: p2Color, code: p2Code, validated: true };
    onStart(player1, player2);
  };

  return (
    <div>
      <div className="config-grid">
        <PlayerConfigPanel
          playerLabel="Player 1"
          name={p1Name}
          color={p1Color}
          code={p1Code}
          validated={p1Valid}
          validationResult={p1Validation}
          duplicateNameError={duplicateNames}
          onNameChange={(v) => {
            setP1Name(v);
            setP1Validation(null);
          }}
          onColorChange={setP1Color}
          onCodeChange={(v) => {
            setP1Code(v);
            setP1Validation(null);
          }}
          onValidate={setP1Validation}
        />
        <PlayerConfigPanel
          playerLabel="Player 2"
          name={p2Name}
          color={p2Color}
          code={p2Code}
          validated={p2Valid}
          validationResult={p2Validation}
          duplicateNameError={duplicateNames}
          onNameChange={(v) => {
            setP2Name(v);
            setP2Validation(null);
          }}
          onColorChange={setP2Color}
          onCodeChange={(v) => {
            setP2Code(v);
            setP2Validation(null);
          }}
          onValidate={setP2Validation}
        />
      </div>

      <div className="config-footer">
        {!canStart && (
          <div className="blockers">
            {blockers.map((b, i) => (
              <div key={i}>{b}</div>
            ))}
          </div>
        )}
        <button className="primary" disabled={!canStart} onClick={handleStart} style={{ fontSize: "1rem", padding: "0.7rem 2.2rem" }}>
          Play
        </button>
      </div>
    </div>
  );
}
