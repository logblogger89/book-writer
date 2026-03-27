import { PHASE_DEPENDENCIES } from '../types/pipeline';

export function getDownstreamPhases(fromPhase: string): string[] {
  const downstream: string[] = [];
  const visited = new Set<string>();
  const queue = [fromPhase];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const [phase, deps] of Object.entries(PHASE_DEPENDENCIES)) {
      if (deps.includes(current) && !visited.has(phase)) {
        visited.add(phase);
        downstream.push(phase);
        queue.push(phase);
      }
    }
  }
  return downstream;
}
