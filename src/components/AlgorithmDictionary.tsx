import { ALGORITHM_DICTIONARY } from "../game/algorithmTemplates";

export function AlgorithmDictionary() {
  return (
    <div className="dictionary-card">
      <section>
        <strong>Allowed shape</strong>
        <pre className="dictionary-card__code">{`function decide(context) {
  if (context.neighbors.east === "enemy") {
    return "ae";
  }

  return "mn";
}`}</pre>
      </section>

      <section>
        <strong>Useful context fields</strong>
        <ul>
          {ALGORITHM_DICTIONARY.contextFields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      </section>

      <section>
        <strong>Neighbor keys</strong>
        <ul>
          {ALGORITHM_DICTIONARY.neighbors.map((neighbor) => (
            <li key={neighbor}>{neighbor}</li>
          ))}
        </ul>
      </section>

      <section>
        <strong>Neighbor values</strong>
        <ul>
          {ALGORITHM_DICTIONARY.neighborStates.map((state) => (
            <li key={state}>{state}</li>
          ))}
        </ul>
      </section>

      <section>
        <strong>Valid action codes</strong>
        <ul>
          {ALGORITHM_DICTIONARY.actionCodes.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>

      <section>
        <strong>Important behavior</strong>
        <ul>
          <li>Cells never auto-attack. They attack only if your function returns an `a...` action.</li>
          <li>Every cell is effectively `1 hp`, so a valid attack eliminates the enemy immediately.</li>
        </ul>
      </section>
    </div>
  );
}
