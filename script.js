'use strict';

// ===== STATE =====
const state = {
  operation: 'add',
  level: 'easy',
  theme: 'theme-rainbow',
  score: 0,
  questionNum: 0,
  totalQuestions: 10,
  correctCount: 0,
  currentAnswer: null,
  currentChoices: [],
  currentQuestionType: 'basic', // 'basic' | 'missing' | 'order'
  currentEffectiveOp: 'add',    // actual operation used for current question
  numpadValue: '',
  timerInterval: null,
  timeLeft: 30,
  questionStartTime: null,
  totalTimeTaken: 0,
  hintUsed: false,
};

const LEVEL_RANGES = { easy: 10, medium: 20, hard: 50 };
const TIME_LIMIT = 30;

// ===== SOUNDS =====
const sounds = {
  correct:  new Audio('public/correct.mp3'),
  wrong:    new Audio('public/uh-oh.mp3'),
  confetti: new Audio('public/confetti.mp3'),
};

function playSound(name) {
  const snd = sounds[name];
  if (!snd) return;
  snd.currentTime = 0;
  snd.play().catch(() => {}); // silently ignore autoplay blocks
}

// ===== DOM REFS =====
const $ = id => document.getElementById(id);
const screens = {
  welcome: $('screen-welcome'),
  game:    $('screen-game'),
  results: $('screen-results'),
};

// ===== SCREEN NAVIGATION =====
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ===== THEME =====
function applyTheme(theme) {
  document.body.className = theme;
  state.theme = theme;
}

// ===== OPERATION BUTTON LOCKING =====
function updateOpButtonStates() {
  const isHard = state.level === 'hard';

  document.querySelectorAll('.op-btn').forEach(btn => {
    const op = btn.dataset.op;
    // On hard: only 'order' is available. On easy/medium: 'order' is locked.
    const locked = isHard ? (op !== 'order') : (op === 'order');
    btn.classList.toggle('op-locked', locked);
  });

  // Auto-switch operation if the current one is now locked
  if (isHard && state.operation !== 'order') {
    setActiveOperation('order');
  } else if (!isHard && state.operation === 'order') {
    setActiveOperation('add');
  }
}

function setActiveOperation(op) {
  state.operation = op;
  document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-op="${op}"]`).classList.add('active');
}

// ===== QUESTION GENERATION (ROUTER) =====
function generateQuestion() {
  state.hintUsed = false;

  if (state.operation === 'order') {
    return generateOrderOfOpsQuestion();
  }

  if (state.operation === 'mixed' && state.level === 'medium') {
    return generateMissingElementQuestion();
  }

  // For 'mixed' on easy: pick a random basic operation
  let op = state.operation;
  if (op === 'mixed') {
    const ops = ['add', 'subtract', 'multiply', 'divide'];
    op = ops[rand(0, 3)];
  }

  return generateBasicQuestion(op);
}

// ===== BASIC QUESTION (Add / Subtract / Multiply / Divide) =====
function generateBasicQuestion(op) {
  state.currentQuestionType = 'basic';
  state.currentEffectiveOp  = op;
  const max = LEVEL_RANGES[state.level];

  let a, b, answer, display;

  switch (op) {
    case 'add':
      a = rand(1, max);
      b = rand(1, max);
      answer  = a + b;
      display = `${a} + ${b} = ?`;
      break;

    case 'subtract':
      a = rand(1, max);
      b = rand(1, a);   // b ≤ a → answer ≥ 0
      answer  = a - b;
      display = `${a} − ${b} = ?`;
      break;

    case 'multiply': {
      const mMax = state.level === 'easy' ? 5 : state.level === 'medium' ? 10 : 12;
      a = rand(1, mMax);
      b = rand(1, mMax);
      answer  = a * b;
      display = `${a} × ${b} = ?`;
      break;
    }

    case 'divide': {
      const dMax = state.level === 'easy' ? 5 : state.level === 'medium' ? 10 : 12;
      b      = rand(1, dMax);
      answer = rand(1, dMax);
      a      = b * answer;
      display = `${a} ÷ ${b} = ?`;
      break;
    }
  }

  state.currentAnswer = answer;
  return { display };
}

// ===== MISSING ELEMENT QUESTION (Medium + Mixed Ops) =====
// Shows one operand as "___" and the player finds the missing value.
function generateMissingElementQuestion() {
  state.currentQuestionType = 'missing';

  const ops = ['add', 'subtract', 'multiply', 'divide'];
  const op  = ops[rand(0, 3)];
  state.currentEffectiveOp = op;

  const max      = LEVEL_RANGES['medium'];
  const hideFirst = Math.random() < 0.5; // true = hide left operand, false = hide right
  let answer, display;

  switch (op) {
    case 'add': {
      const a = rand(1, max);
      const b = rand(1, max);
      const sum = a + b;
      if (hideFirst) { answer = a; display = `___ + ${b} = ${sum}`; }
      else            { answer = b; display = `${a} + ___ = ${sum}`; }
      break;
    }

    case 'subtract': {
      const a    = rand(2, max);
      const b    = rand(1, a - 1); // b < a so diff > 0
      const diff = a - b;
      if (hideFirst) { answer = a; display = `___ − ${b} = ${diff}`; }
      else            { answer = b; display = `${a} − ___ = ${diff}`; }
      break;
    }

    case 'multiply': {
      const mMax    = 10;
      const a       = rand(1, mMax);
      const b       = rand(1, mMax);
      const product = a * b;
      if (hideFirst) { answer = a; display = `___ × ${b} = ${product}`; }
      else            { answer = b; display = `${a} × ___ = ${product}`; }
      break;
    }

    case 'divide': {
      const dMax    = 10;
      const divisor  = rand(1, dMax);
      const quotient = rand(1, dMax);
      const dividend = divisor * quotient;
      if (hideFirst) {
        // ___ ÷ divisor = quotient  → answer is dividend
        answer  = dividend;
        display = `___ ÷ ${divisor} = ${quotient}`;
      } else {
        // dividend ÷ ___ = quotient  → answer is divisor
        answer  = divisor;
        display = `${dividend} ÷ ___ = ${quotient}`;
      }
      break;
    }
  }

  state.currentAnswer = answer;
  return { display };
}

// ===== ORDER OF OPERATIONS QUESTION (Hard only) =====
// Generates "a op1 b op2 c = ?" where op1 and op2 are always mixed precedence
// so the player must apply × / ÷ before + / −.
function generateOrderOfOpsQuestion() {
  state.currentQuestionType = 'order';
  state.currentEffectiveOp  = 'order';

  const highOps = ['×', '÷'];
  const lowOps  = ['+', '−'];
  let attempts  = 0;

  while (attempts < 300) {
    attempts++;

    // Always mix precedence levels so the question tests PEMDAS/BODMAS
    let op1, op2;
    if (Math.random() < 0.5) {
      op1 = lowOps[rand(0, 1)];   // low first: a + b × c
      op2 = highOps[rand(0, 1)];
    } else {
      op1 = highOps[rand(0, 1)];  // high first: a × b + c
      op2 = lowOps[rand(0, 1)];
    }

    const a = rand(1, 15);
    const b = rand(2, 9);
    const c = rand(2, 9);

    const result = evalWithPrecedence(a, op1, b, op2, c);

    if (result !== null && result > 0 && result <= 100 && Number.isInteger(result)) {
      state.currentAnswer = result;
      return { display: `${a} ${op1} ${b} ${op2} ${c} = ?` };
    }
  }

  // Fallback (should rarely be reached)
  state.currentAnswer = 17;
  return { display: `5 × 3 + 2 = ?` };
}

// Evaluate "a op1 b op2 c" respecting operator precedence (× ÷ before + −)
function evalWithPrecedence(a, op1, b, op2, c) {
  const isHigh = op => op === '×' || op === '÷';

  if (!isHigh(op1) && isHigh(op2)) {
    // a op1 (b op2 c)
    const right = applyOp(b, op2, c);
    if (right === null) return null;
    return applyOp(a, op1, right);
  } else {
    // (a op1 b) op2 c
    const left = applyOp(a, op1, b);
    if (left === null) return null;
    return applyOp(left, op2, c);
  }
}

function applyOp(x, op, y) {
  if (op === '+') return x + y;
  if (op === '−') return x - y;
  if (op === '×') return x * y;
  if (op === '÷') {
    if (y === 0 || !Number.isInteger(x / y)) return null;
    return x / y;
  }
  return null;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===== MULTIPLE CHOICE (EASY) =====
function generateChoices(correctAnswer) {
  const wrongSet = new Set();
  let attempts = 0;

  while (wrongSet.size < 3 && attempts < 200) {
    attempts++;
    const candidate = rand(Math.max(0, correctAnswer - 10), correctAnswer + 10);
    if (candidate !== correctAnswer) wrongSet.add(candidate);
  }

  // Fallback if range was too narrow
  let fallback = correctAnswer + 1;
  while (wrongSet.size < 3) {
    if (fallback !== correctAnswer) wrongSet.add(fallback);
    fallback++;
  }

  return shuffleArray([correctAnswer, ...wrongSet]);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== NUMPAD =====
function updateNumpadDisplay() {
  const display = $('numpad-display');
  if (state.numpadValue === '') {
    display.textContent = '?';
    display.classList.add('numpad-display-empty');
  } else {
    display.textContent = state.numpadValue;
    display.classList.remove('numpad-display-empty');
  }
}

function setNumpadDisabled(disabled) {
  document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.disabled = disabled;
  });
}

// ===== INPUT MODE =====
function showInputMode(mode) {
  $('choice-wrap').classList.toggle('hidden', mode !== 'choice');
  $('numpad-wrap').classList.toggle('hidden', mode !== 'numpad');
}

// ===== TIMER =====
function startTimer() {
  state.timeLeft = TIME_LIMIT;
  updateTimerDisplay();
  clearInterval(state.timerInterval);

  const progressBar = $('progress-bar');
  progressBar.style.width = '100%';

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();
    progressBar.style.width = `${(state.timeLeft / TIME_LIMIT) * 100}%`;

    if (state.timeLeft <= 5) {
      $('timer').parentElement.classList.add('urgent');
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      handleTimeout();
    }
  }, 1000);
}

function updateTimerDisplay() {
  $('timer').textContent = state.timeLeft;
}

function stopTimer() {
  clearInterval(state.timerInterval);
  $('timer').parentElement.classList.remove('urgent');
}

// ===== GAME FLOW =====
function startGame() {
  state.score          = 0;
  state.questionNum    = 0;
  state.correctCount   = 0;
  state.totalTimeTaken = 0;
  state.numpadValue    = '';

  showScreen('game');
  nextQuestion();
}

function nextQuestion() {
  if (state.questionNum >= state.totalQuestions) {
    endGame();
    return;
  }

  state.questionNum++;
  $('q-num').textContent = state.questionNum;
  $('score').textContent = state.score;

  const { display } = generateQuestion();
  $('equation').textContent = display;

  hideFeedback();
  $('hint-text').classList.add('hidden');

  // Easy level always uses multiple-choice buttons
  if (state.level === 'easy') {
    state.currentChoices = generateChoices(state.currentAnswer);
    const choiceBtns = document.querySelectorAll('.choice-btn');
    choiceBtns.forEach((btn, i) => {
      btn.textContent = state.currentChoices[i];
      btn.dataset.value = state.currentChoices[i];
      btn.classList.remove('correct', 'incorrect');
      btn.disabled = false;
    });
    showInputMode('choice');
  } else {
    // Medium (basic or missing-element) and Hard (order of ops) use the numpad
    state.numpadValue = '';
    updateNumpadDisplay();
    setNumpadDisabled(false);
    showInputMode('numpad');
  }

  state.questionStartTime = Date.now();
  startTimer();
}

function submitAnswer(userAnswer) {
  stopTimer();

  const timeTaken = (Date.now() - state.questionStartTime) / 1000;
  state.totalTimeTaken += timeTaken;

  if (userAnswer === state.currentAnswer) {
    let points = 10;
    if (timeTaken < 5 && !state.hintUsed)  points = 15;
    else if (timeTaken < 10 && !state.hintUsed) points = 12;
    if (state.hintUsed) points = Math.max(5, points - 4);

    state.score += points;
    state.correctCount++;
    playSound('correct');
    showFeedback(true, `Correct! +${points} ⭐`);
  } else {
    playSound('wrong');
    showFeedback(false, `Not quite! The answer was ${state.currentAnswer}`);
  }

  $('score').textContent = state.score;
  setTimeout(() => nextQuestion(), 1500);
}

function submitChoiceAnswer(selectedValue, clickedBtn) {
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    if (parseInt(btn.dataset.value, 10) === state.currentAnswer) {
      btn.classList.add('correct');
    } else if (btn === clickedBtn) {
      btn.classList.add('incorrect');
    }
  });
  submitAnswer(selectedValue);
}

function submitNumpadAnswer() {
  if (state.numpadValue === '') return;
  const userAnswer = parseInt(state.numpadValue, 10);
  if (isNaN(userAnswer)) return;
  setNumpadDisabled(true);
  submitAnswer(userAnswer);
}

function handleTimeout() {
  state.totalTimeTaken += TIME_LIMIT;

  if (state.level === 'easy') {
    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.disabled = true;
      if (parseInt(btn.dataset.value, 10) === state.currentAnswer) {
        btn.classList.add('correct');
      }
    });
  } else {
    setNumpadDisabled(true);
  }

  showFeedback(false, `Time's up! The answer was ${state.currentAnswer}`);
  setTimeout(() => nextQuestion(), 1600);
}

function showFeedback(correct, msg) {
  const fb = $('feedback');
  fb.textContent = msg;
  fb.className = `feedback ${correct ? 'correct' : 'incorrect'}`;
}

function hideFeedback() {
  $('feedback').className = 'feedback hidden';
}

function showHint() {
  if (state.hintUsed) return;
  state.hintUsed = true;

  let hint = '';
  const ans = state.currentAnswer;

  if (state.currentQuestionType === 'order') {
    hint = 'Remember: × and ÷ are calculated before + and −!';

  } else if (state.currentQuestionType === 'missing') {
    switch (state.currentEffectiveOp) {
      case 'add':      hint = 'Think about what number you add to reach the total!'; break;
      case 'subtract': hint = 'Use the opposite operation to find the missing number!'; break;
      case 'multiply': hint = 'Think: what times the given number gives the product?'; break;
      case 'divide':   hint = 'Use multiplication to work backwards and find the answer!'; break;
    }
    if (ans <= 15) hint += ` (The missing number is between ${Math.max(0, ans - 3)} and ${ans + 3})`;

  } else {
    switch (state.currentEffectiveOp) {
      case 'add':      hint = 'Try counting up from the bigger number!'; break;
      case 'subtract': hint = 'Think: what do you add to get back to the start?'; break;
      case 'multiply': hint = 'Try adding the number to itself multiple times.'; break;
      case 'divide':   hint = 'Think: how many groups of equal size fit in?'; break;
    }
    if (ans <= 10) hint += ` (The answer is between ${Math.max(0, ans - 3)} and ${ans + 3})`;
  }

  const hintEl = $('hint-text');
  hintEl.textContent = `💡 ${hint}`;
  hintEl.classList.remove('hidden');
}

// ===== END GAME =====
function endGame() {
  stopTimer();
  showScreen('results');

  const avgTime = state.totalTimeTaken / state.totalQuestions;

  $('stat-score').textContent   = state.score;
  $('stat-correct').textContent = `${state.correctCount}/10`;
  $('stat-time').textContent    = `${avgTime.toFixed(1)}s`;

  const pct = state.correctCount / state.totalQuestions;
  let emoji, title, subtitle;

  if (pct === 1) {
    emoji = '🏆'; title = 'Perfect Score!'; subtitle = 'You got every single one right. Amazing!';
    launchConfetti();
  } else if (pct >= 0.8) {
    emoji = '🌟'; title = 'Great Job!'; subtitle = `${state.correctCount} out of 10 — you're a math star!`;
    launchConfetti();
  } else if (pct >= 0.6) {
    emoji = '👍'; title = 'Good Work!'; subtitle = `${state.correctCount} out of 10 — keep practising!`;
  } else if (pct >= 0.4) {
    emoji = '💪'; title = 'Keep Trying!'; subtitle = `${state.correctCount} out of 10 — you're getting there!`;
  } else {
    emoji = '📚'; title = 'More Practice!'; subtitle = `${state.correctCount} out of 10 — don't give up!`;
  }

  $('result-emoji').textContent    = emoji;
  $('result-title').textContent    = title;
  $('result-subtitle').textContent = subtitle;
}

// ===== CONFETTI =====
function launchConfetti() {
  playSound('confetti');
  const colors = ['#ff6b9d','#ffa552','#43e97b','#38f9d7','#7b2ff7','#ffd200','#00d4ff'];
  const container = $('confetti-container');
  container.innerHTML = '';

  for (let i = 0; i < 80; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top  = `${-10 - Math.random() * 40}px`;
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width  = `${6 + Math.random() * 10}px`;
    piece.style.height = piece.style.width;
    piece.style.animationDuration = `${1.5 + Math.random() * 2}s`;
    piece.style.animationDelay    = `${Math.random() * 0.8}s`;
    container.appendChild(piece);
  }

  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

// ===== EVENT LISTENERS =====

// Operation buttons
document.querySelectorAll('.op-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('op-locked')) return;
    document.querySelectorAll('.op-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.operation = btn.dataset.op;
  });
});

// Level buttons
document.querySelectorAll('.level-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.level = btn.dataset.level;
    updateOpButtonStates(); // lock/unlock operation buttons for this level
  });
});

// Theme buttons
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyTheme(btn.dataset.theme);
  });
});

// Start
$('btn-start').addEventListener('click', startGame);

// Multiple choice buttons
document.querySelectorAll('.choice-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    const selected = parseInt(btn.dataset.value, 10);
    submitChoiceAnswer(selected, btn);
  });
});

// Numpad buttons
document.querySelectorAll('.numpad-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    const val = btn.dataset.val;
    if (val === 'back') {
      state.numpadValue = state.numpadValue.slice(0, -1);
      updateNumpadDisplay();
    } else if (val === 'submit') {
      submitNumpadAnswer();
    } else {
      // No leading zeros
      if (state.numpadValue === '0') {
        state.numpadValue = val;
      } else if (state.numpadValue.length < 4) {
        state.numpadValue += val;
      }
      updateNumpadDisplay();
    }
  });
});

// Hint
$('btn-hint').addEventListener('click', showHint);

// Play again (same settings)
$('btn-play-again').addEventListener('click', startGame);

// Back to home
$('btn-home').addEventListener('click', () => showScreen('welcome'));
