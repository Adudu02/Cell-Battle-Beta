import { formatStressProfileReport, runStressProfile } from './stressProfile.js';

function parseCliInteger(flag: string, fallback: number, positionalIndex?: number): number {
  const flagIndex = process.argv.findIndex((argument) => argument === flag);
  if (flagIndex !== -1) {
    const nextValue = Number.parseInt(process.argv[flagIndex + 1] ?? '', 10);
    return Number.isFinite(nextValue) ? nextValue : fallback;
  }

  if (positionalIndex !== undefined) {
    const positionalArguments = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
    const positionalValue = Number.parseInt(positionalArguments[positionalIndex] ?? '', 10);
    return Number.isFinite(positionalValue) ? positionalValue : fallback;
  }

  return fallback;
}

const summary = runStressProfile({
  turns: parseCliInteger('--turns', 250, 0),
  turnLimit: parseCliInteger('--turn-limit', 5000),
  topSlowTurns: parseCliInteger('--top', 5, 1),
});

console.log(formatStressProfileReport(summary));
