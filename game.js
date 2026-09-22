const WORD_LENGTH = 6;
const MAX_GUESSES = 6;

// Word resets at 12:01 AM IST (UTC+5:30) every day.
// Strategy: shift the current UTC time by (IST offset − 1 min) so that
// the IST calendar date flips exactly at 00:01 IST, then diff against epoch.
function getDailyWord() {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+5:30
  const RESET_MS      = 1 * 60 * 1000;              // 1-minute delay past midnight

  const shifted = new Date(Date.now() + IST_OFFSET_MS - RESET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();

  // Epoch: 1 Jan 2024 00:01 IST expressed in the same shifted frame = 1 Jan 2024 UTC
  const epochMs  = Date.UTC(2024, 0, 1);
  const todayMs  = Date.UTC(y, m, d);
  const dayIndex = Math.floor((todayMs - epochMs) / 86400000);

  return WORDS[((dayIndex % WORDS.length) + WORDS.length) % WORDS.length];
}

const TARGET = getDailyWord();
let currentRow = 0;
let currentGuess = "";
let gameOver = false;
const letterStates = {}; // letter -> 'correct' | 'present' | 'absent'

function buildGrid() {
  const grid = document.getElementById("grid");
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement("div");
    row.className = "row";
    row.id = `row-${r}`;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.id = `tile-${r}-${c}`;
      row.appendChild(tile);
    }
    grid.appendChild(row);
  }
}

function buildKeyboard() {
  const rows = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["ENTER","Z","X","C","V","B","N","M","⌫"]
  ];
  const kb = document.getElementById("keyboard");
  rows.forEach(keys => {
    const row = document.createElement("div");
    row.className = "kb-row";
    keys.forEach(k => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = k;
      btn.className = "kb-key";
      if (k === "ENTER" || k === "⌫") btn.classList.add("wide");
      btn.dataset.key = k;
      btn.id = `key-${k}`;
      btn.addEventListener("click", () => handleKey(k));
      row.appendChild(btn);
    });
    kb.appendChild(row);
  });
}

function handleKey(key) {
  if (gameOver) return;
  if (key === "⌫" || key === "BACKSPACE") {
    currentGuess = currentGuess.slice(0, -1);
    updateCurrentRow();
  } else if (key === "ENTER") {
    submitGuess();
  } else if (/^[A-Z]$/.test(key) && currentGuess.length < WORD_LENGTH) {
    currentGuess += key;
    updateCurrentRow();
  }
}

function updateCurrentRow() {
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = document.getElementById(`tile-${currentRow}-${c}`);
    tile.textContent = currentGuess[c] || "";
    tile.classList.toggle("filled", !!currentGuess[c]);
  }
}

function submitGuess() {
  if (currentGuess.length < WORD_LENGTH) {
    shakeRow(currentRow);
    showMessage("Not enough letters");
    return;
  }

  if (!VALID_WORDS.has(currentGuess)) {
    shakeRow(currentRow);
    showMessage("Word does not exist, write a valid word");
    return;
  }

  const guess = currentGuess;
  const result = scoreGuess(guess, TARGET);

  revealRow(currentRow, guess, result, () => {
    result.forEach((state, i) => {
      const letter = guess[i];
      const priority = { correct: 3, present: 2, absent: 1 };
      if ((priority[state] || 0) > (priority[letterStates[letter]] || 0)) {
        letterStates[letter] = state;
      }
      updateKeyColor(letter);
    });

    if (guess === TARGET) {
      gameOver = true;
      setTimeout(() => showMessage("Brilliant! 🎉", true), 400);
    } else if (currentRow === MAX_GUESSES - 1) {
      gameOver = true;
      setTimeout(() => showMessage(`The Shal was: ${TARGET}`, true), 400);
    }
    currentRow++;
    currentGuess = "";
  });
}

function scoreGuess(guess, target) {
  const result = Array(WORD_LENGTH).fill("absent");
  const targetArr = target.split("");
  const guessArr = guess.split("");
  const targetCount = {};

  // First pass: correct positions
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessArr[i] === targetArr[i]) {
      result[i] = "correct";
      targetArr[i] = null;
      guessArr[i] = null;
    }
  }

  // Second pass: present letters
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessArr[i] === null) continue;
    const idx = targetArr.indexOf(guessArr[i]);
    if (idx !== -1) {
      result[i] = "present";
      targetArr[idx] = null;
    }
  }

  return result;
}

function revealRow(row, guess, result, callback) {
  const delay = 350;
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = document.getElementById(`tile-${row}-${c}`);
    setTimeout(() => {
      tile.classList.add("flip");
      setTimeout(() => {
        tile.dataset.state = result[c];
        tile.classList.remove("flip");
      }, delay / 2);
    }, c * delay);
  }
  setTimeout(callback, WORD_LENGTH * delay + delay / 2);
}

function updateKeyColor(letter) {
  const btn = document.getElementById(`key-${letter}`);
  if (btn) btn.dataset.state = letterStates[letter];
}

function shakeRow(row) {
  const el = document.getElementById(`row-${row}`);
  el.classList.add("shake");
  el.addEventListener("animationend", () => el.classList.remove("shake"), { once: true });
}

function showMessage(text, persist = false) {
  const msg = document.getElementById("message");
  msg.textContent = text;
  msg.classList.add("show");
  if (!persist) setTimeout(() => msg.classList.remove("show"), 1800);
}

// Fetch the full English word list (~370k words) and add all 6-letter words
// to VALID_WORDS. Game is fully playable immediately with the embedded list;
// this runs in the background and silently extends coverage.
async function loadExtendedWordList() {
  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt"
    );
    if (!res.ok) return;
    const text = await res.text();
    const SIX = /^[A-Z]{6}$/;
    for (const line of text.split('\n')) {
      const w = line.trim().toUpperCase();
      if (SIX.test(w)) VALID_WORDS.add(w);
    }
  } catch {
    // Network unavailable — embedded list still in effect
  }
}

document.addEventListener("keydown", e => {
  const k = e.key.toUpperCase();
  if (k === "BACKSPACE" || k === "ENTER" || /^[A-Z]$/.test(k)) handleKey(k);
});

buildGrid();
buildKeyboard();
loadExtendedWordList();
