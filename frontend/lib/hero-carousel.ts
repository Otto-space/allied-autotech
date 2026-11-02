export const HERO_INTERVAL_MS = 6000;
export const HERO_IMAGE_TIMEOUT_MS = 8000;
export type HeroState = {
  current: number;
  ready: boolean[];
  failed: boolean[];
  pending: { index: number; direction: number; manual: boolean } | null;
  revision: number;
  announcement: number | null;
};
export const initialHeroState: HeroState = {
  current: 0,
  ready: [false, false, false],
  failed: [false, false, false],
  pending: null,
  revision: 0,
  announcement: null,
};
type Action =
  | { type: "cancel-auto" }
  | { type: "go"; index?: number; direction: number; manual: boolean }
  | { type: "ready"; index: number }
  | { type: "failed"; index: number };

function select(
  state: HeroState,
  index: number,
  direction: number,
  manual: boolean,
): HeroState {
  const count = state.ready.length;
  for (let attempts = 0; attempts < count; attempts++, index += direction) {
    const target = ((index % count) + count) % count;
    if (state.failed[target]) continue;
    if (target === state.current && !state.failed[state.current])
      return { ...state, pending: null, revision: state.revision + 1 };
    if (!state.ready[target])
      return {
        ...state,
        pending: { index: target, direction, manual },
        revision: state.revision + 1,
      };
    return {
      ...state,
      current: target,
      pending: null,
      revision: state.revision + 1,
      announcement: manual ? target : null,
    };
  }
  return { ...state, pending: null, revision: state.revision + 1 };
}

export function heroReducer(state: HeroState, action: Action): HeroState {
  if (action.type === "cancel-auto") {
    return state.pending && !state.pending.manual && !state.failed[state.current]
      ? { ...state, pending: null, revision: state.revision + 1 }
      : state;
  }
  if (action.type === "go") {
    const from = state.pending?.index ?? state.current;
    return select(
      state,
      action.index ?? from + action.direction,
      action.direction,
      action.manual,
    );
  }
  if (action.type === "ready") {
    if (state.failed[action.index]) return state;
    const next = { ...state, ready: state.ready.map((v, i) => i === action.index || v) };
    if (state.pending?.index === action.index) {
      const p = state.pending;
      return select(next, p.index, p.direction, p.manual);
    }
    return next;
  }
  const next = { ...state, failed: state.failed.map((v, i) => i === action.index || v) };
  const request = state.pending;
  if (request?.index === action.index)
    return select(
      next,
      request.index + request.direction,
      request.direction,
      request.manual,
    );
  if (state.current === action.index && !request)
    return select(next, action.index + 1, 1, false);
  return next;
}
