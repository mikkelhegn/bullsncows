import { HandleRequest, HttpRequest, HttpResponse, Kv } from "@fermyon/spin-sdk"
import { Logger } from "tslog";
import { v4 as uuidv4 } from 'uuid';

interface InternalGame {
  id: string,
  solution: number[],
  guesses: number,
  solved: boolean
}

interface Response {
  cows: number,
  bulls: number,
  gameId?: string,
  guesses?: number,
  solved?: boolean
}

const decoder = new TextDecoder();

export const handleRequest: HandleRequest = async function (request: HttpRequest): Promise<HttpResponse> {
  const requestId = uuidv4()
  const log = new Logger({
    prefix: [requestId],
    stylePrettyLogs: false,
  });

  let internalGame: InternalGame = {} as InternalGame;
  let response: Response = {
    cows: 0,
    bulls: 0
  };
  //let guess: number[] = new Array<number>(4);
  let guess: number[] = new Array<number>(3);
  let store = Kv.openDefault();

  // Check if it's an existing game or not
  let id = getURLParameter("id", request.uri.toLowerCase());

  if (id == null) {
    // New game
    id = uuidv4();
    log.info(`Starting new game: ${id}`)

    // Generate solution
    //let solution: number[] = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let solution: number[] = shuffle([0, 1, 2, 3, 4]);
    solution.length = 3;

    internalGame = {
      id: id,
      solution: solution,
      guesses: 0,
      solved: false
    }

    store.setJson(internalGame.id, internalGame);
    log.info(`Game status: ${JSON.stringify(internalGame)}`);
  } else {
    // It's an existing game
    try {
      internalGame = store.getJson(id);
    } catch (error) {
      log.error(error)
      return {
        status: 500,
        headers: { "content-type": "text/plain" },
        body: `Error retrieving game with id: ${id}}`
      };
    }
    log.info(`Continuing game: ${JSON.stringify(internalGame.id)}`);
  };

  // Evaluate guess
  let guessParam = getURLParameter("guess", request.uri.toLowerCase());
  if (guessParam != undefined) {
    try {
      guess = Array.from(guessParam.split(''), Number);
      if (hasDuplicates(guess)) {
        log.error("Guess has duplicates values")
        return {
          status: 400,
          headers: { "content-type": "text/plain" },
          body: "Use can only use each number once."
        };
      }
      log.info(`Guess is: ${guess}`);
    } catch (error) {
      log.error("Guess is wrong format")
      return {
        status: 400,
        headers: { "content-type": "text/plain" },
        body: "Guess has to be 3 numbers, e.g., '123'. The numbers have to be between 0-4. Use can only use each number once."
      };
    }
  } else {
    log.error("No guess provided")
    return {
      status: 400,
      headers: { "content-type": "text/plain" },
      body: "No guess provided. Use '?guess=123' to provide the guess"
    };
  }

  ++internalGame.guesses

  // Gather bulls and cows
  guess.forEach((value, index, array) => {
    if (guess[index] == internalGame.solution[index]) {
      ++response.bulls
    } else {
      if (internalGame.solution.includes(guess[index])) {
        ++response.cows
      }
    }
  });

  log.info(`Bulls: ${response.bulls}, Cows: ${response.cows}`)

  if (response.bulls == 3) {
    internalGame.solved = true;
    log.info(`Solved game: ${internalGame.id} in ${internalGame.guesses} guesses`);
  }

  store.setJson(internalGame.id, internalGame);

  log.info(`Saved game state: ${JSON.stringify(internalGame)}`);

  response.gameId = internalGame.id;
  response.guesses = internalGame.guesses;
  response.solved = internalGame.solved;

  return {
    status: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(response)
  };
}

function getURLParameter(name: string, uri: string): string | null {
  return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(uri) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}

function shuffle(array: number[]): number[] {
  let currentIndex = array.length, randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function hasDuplicates<T>(arr: T[]): boolean {
  return new Set(arr).size < arr.length;
}