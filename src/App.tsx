import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { ConfigurationScreen } from "./components/ConfigurationScreen";
import { FinalScreen } from "./components/FinalScreen";
import { SimulationScreen } from "./components/SimulationScreen";
import { TEAM_DEFAULTS } from "./game/constants";
import { createEngine } from "./game/engine";
import type {
  EngineController,
  PlayerConfig,
  PlayerDraft,
  SimulationSnapshot,
  TeamId,
} from "./game/types";
import { createAlgorithmRunner, validateAlgorithm } from "./game/validation";

const STORAGE_KEY = "battle-of-cells/config/v2";
const AUTOPLAY_TURNS_PER_SECOND = 30;
const AUTOPLAY_TURN_INTERVAL_MS = 1000 / AUTOPLAY_TURNS_PER_SECOND;

type Screen = "configuration" | "simulation" | "final";

function createDefaultPlayers(): Record<TeamId, PlayerDraft> {
  return {
    p1: {
      id: "p1",
      teamName: TEAM_DEFAULTS.p1.teamName,
      teamColor: TEAM_DEFAULTS.p1.teamColor,
      algorithmSource: TEAM_DEFAULTS.p1.algorithmSource,
      validation: {
        status: "idle",
        diagnostics: [],
        normalizedSource: "",
      },
    },
    p2: {
      id: "p2",
      teamName: TEAM_DEFAULTS.p2.teamName,
      teamColor: TEAM_DEFAULTS.p2.teamColor,
      algorithmSource: TEAM_DEFAULTS.p2.algorithmSource,
      validation: {
        status: "idle",
        diagnostics: [],
        normalizedSource: "",
      },
    },
  };
}

function loadStoredPlayers(): Record<TeamId, PlayerDraft> {
  if (typeof window === "undefined") {
    return createDefaultPlayers();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createDefaultPlayers();
  }

  try {
    const parsed = JSON.parse(raw) as Record<TeamId, PlayerDraft>;
    const defaults = createDefaultPlayers();

    return {
      p1: {
        ...defaults.p1,
        ...parsed.p1,
        validation: defaults.p1.validation,
      },
      p2: {
        ...defaults.p2,
        ...parsed.p2,
        validation: defaults.p2.validation,
      },
    };
  } catch {
    return createDefaultPlayers();
  }
}

function toPlayerConfig(player: PlayerDraft): PlayerConfig {
  return {
    id: player.id,
    teamName: player.teamName.trim(),
    teamColor: player.teamColor,
    algorithmSource:
      player.validation.normalizedSource || player.algorithmSource.trim(),
  };
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("configuration");
  const [players, setPlayers] = useState<Record<TeamId, PlayerDraft>>(
    () => loadStoredPlayers(),
  );
  const [simulation, setSimulation] = useState<SimulationSnapshot | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const engineRef = useRef<EngineController | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autoplayCarryMsRef = useRef(0);
  const lastFrameTimeRef = useRef<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }, [players]);

  const configurationIssues: string[] = [];
  const teamNameOne = players.p1.teamName.trim();
  const teamNameTwo = players.p2.teamName.trim();

  if (!teamNameOne || !teamNameTwo) {
    configurationIssues.push("Both team names are required.");
  }

  if (
    teamNameOne &&
    teamNameTwo &&
    teamNameOne.localeCompare(teamNameTwo, undefined, {
      sensitivity: "accent",
    }) === 0
  ) {
    configurationIssues.push("Team names must be unique.");
  }

  if (players.p1.validation.status !== "valid") {
    configurationIssues.push("Player 1 algorithm must validate successfully.");
  }

  if (players.p2.validation.status !== "valid") {
    configurationIssues.push("Player 2 algorithm must validate successfully.");
  }

  const canStartMatch = configurationIssues.length === 0;

  const updatePlayer = (
    teamId: TeamId,
    patch: Partial<Omit<PlayerDraft, "validation">>,
  ) => {
    setPlayers((current) => {
      const nextPlayer = { ...current[teamId], ...patch };
      if (patch.algorithmSource !== undefined) {
        nextPlayer.validation = {
          status: "idle",
          diagnostics: [],
          normalizedSource: "",
        };
      }

      return {
        ...current,
        [teamId]: nextPlayer,
      };
    });
  };

  const handleValidate = async (teamId: TeamId) => {
    const source = players[teamId].algorithmSource;
    setPlayers((current) => ({
      ...current,
      [teamId]: {
        ...current[teamId],
        validation: {
          ...current[teamId].validation,
          status: "validating",
          diagnostics: ["Running syntax and sandbox checks..."],
        },
      },
    }));

    const result = await validateAlgorithm(source);

    setPlayers((current) => {
      if (current[teamId].algorithmSource !== source) {
        return current;
      }

      return {
        ...current,
        [teamId]: {
          ...current[teamId],
          validation: {
            status: result.isValid ? "valid" : "invalid",
            diagnostics: result.diagnostics,
            normalizedSource: result.normalizedSource,
          },
        },
      };
    });
  };

  const startMatch = () => {
    if (!canStartMatch) {
      return;
    }

    try {
      const lockedPlayers: Record<TeamId, PlayerConfig> = {
        p1: toPlayerConfig(players.p1),
        p2: toPlayerConfig(players.p2),
      };

      const engine = createEngine(lockedPlayers, {
        p1: createAlgorithmRunner(lockedPlayers.p1.algorithmSource),
        p2: createAlgorithmRunner(lockedPlayers.p2.algorithmSource),
      });

      engineRef.current = engine;
      setSimulation(engine.getSnapshot());
      setScreen("simulation");
      setIsAutoPlaying(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start the match.";

      setPlayers((current) => ({
        ...current,
        p1: {
          ...current.p1,
          validation:
            current.p1.validation.status === "valid"
              ? {
                  ...current.p1.validation,
                  status: "invalid",
                  diagnostics: [message],
                }
              : current.p1.validation,
        },
        p2: {
          ...current.p2,
          validation:
            current.p2.validation.status === "valid"
              ? {
                  ...current.p2.validation,
                  status: "invalid",
                  diagnostics: [message],
                }
              : current.p2.validation,
        },
      }));
    }
  };

  const commitSimulation = useEffectEvent((nextSnapshot: SimulationSnapshot) => {
    setSimulation(nextSnapshot);
    if (nextSnapshot.result) {
      setIsAutoPlaying(false);
      setScreen("final");
      return;
    }
    setScreen("simulation");
  });

  const advanceTurns = useEffectEvent((turnCount: number) => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    const nextSnapshot = turnCount === 1
      ? engine.stepTurn()
      : engine.stepTurns(turnCount);
    commitSimulation(nextSnapshot);
  });

  const endMatch = useEffectEvent(() => {
    const engine = engineRef.current;
    if (!engine) {
      return;
    }

    commitSimulation(engine.endMatch());
  });

  useEffect(() => {
    if (!isAutoPlaying || screen !== "simulation") {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      autoplayCarryMsRef.current = 0;
      lastFrameTimeRef.current = null;
      return;
    }

    const tick = (timestamp: number) => {
      const engine = engineRef.current;
      if (!engine || engine.isFinished()) {
        animationFrameRef.current = null;
        return;
      }

      const lastTimestamp = lastFrameTimeRef.current ?? timestamp;
      lastFrameTimeRef.current = timestamp;
      autoplayCarryMsRef.current += timestamp - lastTimestamp;

      let turnsToAdvance = 0;
      if (autoplayCarryMsRef.current >= AUTOPLAY_TURN_INTERVAL_MS) {
        autoplayCarryMsRef.current -= AUTOPLAY_TURN_INTERVAL_MS;
        turnsToAdvance = 1;
      }

      if (turnsToAdvance > 0) {
        advanceTurns(turnsToAdvance);
      }

      animationFrameRef.current = window.requestAnimationFrame(tick);
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      autoplayCarryMsRef.current = 0;
      lastFrameTimeRef.current = null;
    };
  }, [isAutoPlaying, screen]);

  const resetMatch = () => {
    engineRef.current = null;
    setSimulation(null);
    setScreen("configuration");
    setIsAutoPlaying(false);
  };

  return (
    <div className="app-shell">
      {screen === "configuration" && (
        <ConfigurationScreen
          players={players}
          issues={configurationIssues}
          canStartMatch={canStartMatch}
          onUpdatePlayer={updatePlayer}
          onValidatePlayer={handleValidate}
          onStartMatch={startMatch}
        />
      )}
      {screen === "simulation" && simulation && (
        <SimulationScreen
          snapshot={simulation}
          isAutoPlaying={isAutoPlaying}
          onPause={() => setIsAutoPlaying(false)}
          onPlay={() => setIsAutoPlaying(true)}
          onStepTurn={() => {
            setIsAutoPlaying(false);
            advanceTurns(1);
          }}
          onEndMatch={() => {
            setIsAutoPlaying(false);
            endMatch();
          }}
        />
      )}
      {screen === "final" && simulation && simulation.result && (
        <FinalScreen
          snapshot={simulation}
          onNewMatch={resetMatch}
        />
      )}
    </div>
  );
}
