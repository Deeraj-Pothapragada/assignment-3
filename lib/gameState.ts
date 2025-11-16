/**
 * Simple in-memory storage for active game state.
 * This allows us to pause the game while waiting for human input.
 */

interface GameState {
  streamController: ReadableStreamDefaultController | null;
  waitingForHumanResponse: boolean;
  humanResponseResolver: ((response: string) => void) | null;
}

let activeGameState: GameState = {
  streamController: null,
  waitingForHumanResponse: false,
  humanResponseResolver: null
};

export function setGameStreamController(controller: ReadableStreamDefaultController) {
  activeGameState.streamController = controller;
}

export function getGameStreamController(): ReadableStreamDefaultController | null {
  return activeGameState.streamController;
}

export function waitForHumanResponse(): Promise<string> {
  console.log('[gameState] Waiting for human response...');
  return new Promise((resolve) => {
    activeGameState.waitingForHumanResponse = true;
    activeGameState.humanResponseResolver = resolve;
    console.log('[gameState] Resolver set up');
  });
}

export function submitHumanResponse(response: string) {
  console.log('[gameState] Submitting human response:', response);
  console.log('[gameState] Resolver exists?', !!activeGameState.humanResponseResolver);
  if (activeGameState.humanResponseResolver) {
    activeGameState.humanResponseResolver(response);
    activeGameState.waitingForHumanResponse = false;
    activeGameState.humanResponseResolver = null;
    console.log('[gameState] Response submitted successfully');
  } else {
    console.error('[gameState] No resolver found!');
  }
}

export function isWaitingForHuman(): boolean {
  return activeGameState.waitingForHumanResponse;
}

export function resetGameState() {
  activeGameState = {
    streamController: null,
    waitingForHumanResponse: false,
    humanResponseResolver: null
  };
}
