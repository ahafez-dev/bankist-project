'use strict';

/**
 * Bankist — Modern Fintech Application
 * Handles login, transfers, loans, account closure, and movement sorting.
 * @module BankistApp
 */

/** Simulated network delay in milliseconds (login and transfer). */
const NETWORK_DELAY_MS = 1200;

/** Logout countdown duration in seconds. */
const LOGOUT_TIMER_SECONDS = 300; // 5 minutes

/**
 * Creates username from account owner (e.g. "Jonas Schmedtmann" → "js").
 * Mutates each account to add a `username` property.
 * @param {Array<{owner: string}>} accounts - Array of account objects.
 * @returns {void}
 */
function createUsernames(accounts) {
  accounts.forEach(acc => {
    acc.username = acc.owner
      .toLowerCase()
      .split(' ')
      .map(name => name[0])
      .join('');
  });
}

/**
 * Formats a movement date as relative or absolute string.
 * @param {Date} date - Movement date.
 * @param {Date} now - Current date for "days ago" calculation.
 * @returns {string} Formatted date string.
 */
function formatMovementDate(date, now = new Date()) {
  const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (daysDiff === 0) return 'Today';
  if (daysDiff === 1) return 'Yesterday';
  if (daysDiff <= 7) return `${daysDiff} days ago`;
  const day = `${date.getDate()}`.padStart(2, '0');
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Bankist application controller. */
class BankistApp {
  /**
   * @param {Object} options - DOM elements and data.
   * @param {HTMLParagraphElement} options.labelWelcome
   * @param {HTMLSpanElement} options.labelDate
   * @param {HTMLParagraphElement} options.labelBalance
   * @param {HTMLParagraphElement} options.labelSumIn
   * @param {HTMLParagraphElement} options.labelSumOut
   * @param {HTMLParagraphElement} options.labelSumInterest
   * @param {HTMLSpanElement} options.labelTimer
   * @param {HTMLElement} options.containerApp
   * @param {HTMLElement} options.containerMovements
   * @param {HTMLButtonElement} options.btnLogin
   * @param {HTMLButtonElement} options.btnTransfer
   * @param {HTMLButtonElement} options.btnLoan
   * @param {HTMLButtonElement} options.btnClose
   * @param {HTMLButtonElement} options.btnSort
   * @param {HTMLInputElement} options.inputLoginUsername
   * @param {HTMLInputElement} options.inputLoginPin
   * @param {HTMLInputElement} options.inputTransferTo
   * @param {HTMLInputElement} options.inputTransferAmount
   * @param {HTMLInputElement} options.inputLoanAmount
   * @param {HTMLInputElement} options.inputCloseUsername
   * @param {HTMLInputElement} options.inputClosePin
   * @param {HTMLElement} options.spinnerOverlay
   * @param {HTMLElement} options.spinnerText
   * @param {Array<Object>} options.accounts
   */
  constructor(options) {
    this.#labelWelcome = options.labelWelcome ?? null;
    this.#labelDate = options.labelDate ?? null;
    this.#labelBalance = options.labelBalance ?? null;
    this.#labelSumIn = options.labelSumIn ?? null;
    this.#labelSumOut = options.labelSumOut ?? null;
    this.#labelSumInterest = options.labelSumInterest ?? null;
    this.#labelTimer = options.labelTimer ?? null;
    this.#containerApp = options.containerApp ?? null;
    this.#containerMovements = options.containerMovements ?? null;
    this.#btnLogin = options.btnLogin ?? null;
    this.#btnTransfer = options.btnTransfer ?? null;
    this.#btnLoan = options.btnLoan ?? null;
    this.#btnClose = options.btnClose ?? null;
    this.#btnSort = options.btnSort ?? null;
    this.#inputLoginUsername = options.inputLoginUsername ?? null;
    this.#inputLoginPin = options.inputLoginPin ?? null;
    this.#inputTransferTo = options.inputTransferTo ?? null;
    this.#inputTransferAmount = options.inputTransferAmount ?? null;
    this.#inputLoanAmount = options.inputLoanAmount ?? null;
    this.#inputCloseUsername = options.inputCloseUsername ?? null;
    this.#inputClosePin = options.inputClosePin ?? null;
    this.#spinnerOverlay = options.spinnerOverlay ?? null;
    this.#spinnerText = options.spinnerText ?? null;
    this.#accounts = options.accounts ?? [];
    this.#currentAccount = null;
    this.#sorted = false;
    this.#logoutTimerId = null;
    this.#bindEvents();
  }

  #labelWelcome;
  #labelDate;
  #labelBalance;
  #labelSumIn;
  #labelSumOut;
  #labelSumInterest;
  #labelTimer;
  #containerApp;
  #containerMovements;
  #btnLogin;
  #btnTransfer;
  #btnLoan;
  #btnClose;
  #btnSort;
  #inputLoginUsername;
  #inputLoginPin;
  #inputTransferTo;
  #inputTransferAmount;
  #inputLoanAmount;
  #inputCloseUsername;
  #inputClosePin;
  #spinnerOverlay;
  #spinnerText;
  #accounts;
  #currentAccount;
  #sorted;
  #logoutTimerId;

  /** Binds all DOM event listeners. */
  #bindEvents() {
    this.#btnLogin?.addEventListener('click', e => this.#handleLogin(e));
    this.#btnTransfer?.addEventListener('click', e => this.#handleTransfer(e));
    this.#btnLoan?.addEventListener('click', e => this.#handleLoan(e));
    this.#btnClose?.addEventListener('click', e => this.#handleClose(e));
    this.#btnSort?.addEventListener('click', e => this.#handleSort(e));
    document.querySelector('.login')?.addEventListener('submit', e => this.#handleLogin(e));
    document.querySelector('.form--transfer')?.addEventListener('submit', e => this.#handleTransfer(e));
    document.querySelector('.form--loan')?.addEventListener('submit', e => this.#handleLoan(e));
    document.querySelector('.form--close')?.addEventListener('submit', e => this.#handleClose(e));
  }

  /**
   * Shows the loading overlay with optional message.
   * @param {string} [message='Processing...'] - Text shown below the spinner.
   */
  #showSpinner(message = 'Processing...') {
    if (this.#spinnerText) this.#spinnerText.textContent = message ?? 'Processing...';
    this.#spinnerOverlay?.classList.add('spinner-overlay--active');
    if (this.#spinnerOverlay) this.#spinnerOverlay.setAttribute('aria-hidden', 'false');
  }

  /** Hides the loading overlay. */
  #hideSpinner() {
    this.#spinnerOverlay?.classList.remove('spinner-overlay--active');
    this.#spinnerOverlay?.setAttribute('aria-hidden', 'true');
  }

  /**
   * Wraps an async action with spinner and simulated delay.
   * @param {string} message - Spinner message.
   * @param {() => Promise<void>} fn - Async action to run after delay.
   */
  async #withNetworkDelay(message, fn) {
    this.#showSpinner(message);
    await new Promise(r => setTimeout(r, NETWORK_DELAY_MS));
    await fn?.();
    this.#hideSpinner();
  }

  /**
   * Renders the movements list.
   * @param {number[]} movements - Array of movement amounts.
   * @param {boolean} [sort=false] - If true, sort ascending.
   */
  #displayMovements(movements, sort = false) {
    const container = this.#containerMovements;
    if (!container) return;
    container.innerHTML = '';
    const movs = sort ? movements.slice().sort((a, b) => a - b) : movements;
    const now = new Date();
    movs.forEach((mov, i) => {
      const type = mov > 0 ? 'deposit' : 'withdrawal';
      const daysAgo = i;
      const dateStr = formatMovementDate(new Date(now - daysAgo * 86400000), now);
      const html = `
        <div class="movements__row">
          <div class="movements__type movements__type--${type}">${i + 1} ${type}</div>
          <div class="movements__date">${dateStr}</div>
          <div class="movements__value" data-type="${type}">${mov}€</div>
        </div>
      `;
      container.insertAdjacentHTML('afterbegin', html);
    });
  }

  /**
   * Computes balance from movements and updates the balance label.
   * @param {{ movements: number[] }} acc - Current account (mutated with balance).
   */
  #calcDisplayBalance(acc) {
    acc.balance = acc.movements.reduce((sum, mov) => sum + mov, 0);
    const label = this.#labelBalance;
    if (label) label.textContent = `${acc.balance}€`;
  }

  /**
   * Computes summary (in, out, interest) and updates summary labels.
   * @param {{ movements: number[], interestRate: number }} acc - Current account.
   */
  #calcDisplaySummary(acc) {
    const incomes = acc.movements
      .filter(mov => mov > 0)
      .reduce((sum, mov) => sum + mov, 0);
    if (this.#labelSumIn) this.#labelSumIn.textContent = `${incomes}€`;

    const out = acc.movements
      .filter(mov => mov < 0)
      .reduce((sum, mov) => sum + mov, 0);
    if (this.#labelSumOut) this.#labelSumOut.textContent = `${Math.abs(out)}€`;

    const interest = acc.movements
      .filter(mov => mov > 0)
      .map(deposit => (deposit * (acc.interestRate ?? 0)) / 100)
      .filter(int => int >= 1)
      .reduce((sum, int) => sum + int, 0);
    if (this.#labelSumInterest) this.#labelSumInterest.textContent = `${interest}€`;
  }

  /** Updates the displayed date in the balance section. */
  #displayDate() {
    const now = new Date();
    const day = `${now.getDate()}`.padStart(2, '0');
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const year = now.getFullYear();
    if (this.#labelDate) this.#labelDate.textContent = `${day}/${month}/${year}`;
  }

  /**
   * Refreshes the full UI for the current account (movements, balance, summary, date).
   * @param {{ movements: number[], interestRate: number }} acc - Account to display.
   */
  #updateUI(acc) {
    this.#displayMovements(acc.movements, this.#sorted);
    this.#calcDisplayBalance(acc);
    this.#calcDisplaySummary(acc);
    this.#displayDate();
  }

  /** Starts or resets the logout countdown timer. */
  #startLogoutTimer() {
    if (this.#logoutTimerId) clearInterval(this.#logoutTimerId);
    let time = LOGOUT_TIMER_SECONDS;
    const updateLabel = () => {
      const min = Math.trunc(time / 60);
      const sec = time % 60;
      if (this.#labelTimer) {
        this.#labelTimer.textContent = `${`${min}`.padStart(2, '0')}:${`${sec}`.padStart(2, '0')}`;
      }
      if (time <= 0) {
        clearInterval(this.#logoutTimerId);
        this.#currentAccount = null;
        this.#containerApp?.classList.remove('app--visible');
        if (this.#labelWelcome) this.#labelWelcome.textContent = 'Log in to get started';
      }
      time--;
    };
    updateLabel();
    this.#logoutTimerId = setInterval(updateLabel, 1000);
  }

  /**
   * Handles login form submit: validates credentials and shows app UI or keeps overlay.
   * @param {Event} e - Click/submit event.
   */
  #handleLogin(e) {
    e?.preventDefault();
    const user = this.#inputLoginUsername?.value?.trim() ?? '';
    const pin = Number(this.#inputLoginPin?.value) || 0;
    const account = this.#accounts.find(acc => acc.username === user);

    if (account?.pin !== pin) {
      this.#inputLoginUsername?.focus();
      return;
    }

    this.#withNetworkDelay('Logging in...', () => {
      this.#currentAccount = account;
      const firstName = account.owner.split(' ')[0] ?? account.owner;
      if (this.#labelWelcome) this.#labelWelcome.textContent = `Welcome back, ${firstName}`;
      this.#containerApp?.classList.add('app--visible');
      this.#inputLoginUsername.value = '';
      this.#inputLoginPin.value = '';
      this.#inputLoginPin?.blur();
      this.#updateUI(account);
      this.#startLogoutTimer();
    });
  }

  /**
   * Handles transfer: validates amount and receiver, then updates both accounts and UI.
   * @param {Event} e - Click event.
   */
  #handleTransfer(e) {
    e?.preventDefault();
    const amount = Number(this.#inputTransferAmount?.value) || 0;
    const toUser = (this.#inputTransferTo?.value?.trim() ?? '').toLowerCase();
    const receiver = this.#accounts.find(acc => acc.username === toUser);
    const current = this.#currentAccount;
    const balance = current?.balance ?? 0;

    const valid =
      amount > 0 &&
      receiver &&
      balance >= amount &&
      receiver?.username !== current?.username;

    this.#inputTransferAmount.value = '';
    this.#inputTransferTo.value = '';

    if (!valid) return;

    this.#withNetworkDelay('Transferring...', () => {
      current.movements.push(-amount);
      receiver.movements.push(amount);
      this.#updateUI(current);
      this.#startLogoutTimer();
    });
  }

  /**
   * Handles loan request: checks eligibility (any deposit >= 10% of amount) and adds deposit.
   * @param {Event} e - Click event.
   */
  #handleLoan(e) {
    e?.preventDefault();
    const amount = Number(this.#inputLoanAmount?.value) || 0;
    const current = this.#currentAccount;
    const eligible = amount > 0 && current?.movements?.some(mov => mov >= amount * 0.1);

    this.#inputLoanAmount.value = '';

    if (!eligible) return;

    current.movements.push(amount);
    this.#updateUI(current);
    this.#startLogoutTimer();
  }

  /**
   * Handles account closure: confirms user/PIN and removes account, then hides UI.
   * @param {Event} e - Click event.
   */
  #handleClose(e) {
    e?.preventDefault();
    const user = this.#inputCloseUsername?.value?.trim() ?? '';
    const pin = Number(this.#inputClosePin?.value) || 0;
    const current = this.#currentAccount;

    if (user !== current?.username || pin !== current?.pin) {
      this.#inputCloseUsername.value = '';
      this.#inputClosePin.value = '';
      return;
    }

    const index = this.#accounts.findIndex(acc => acc.username === current.username);
    if (index !== -1) this.#accounts.splice(index, 1);
    this.#currentAccount = null;
    this.#containerApp?.classList.remove('app--visible');
    if (this.#labelWelcome) this.#labelWelcome.textContent = 'Log in to get started';
    this.#inputCloseUsername.value = '';
    this.#inputClosePin.value = '';
  }

  /**
   * Toggles movement list sort (ascending) and re-renders.
   * @param {Event} e - Click event.
   */
  #handleSort(e) {
    e?.preventDefault();
    const acc = this.#currentAccount;
    if (!acc?.movements) return;
    this.#sorted = !this.#sorted;
    if (this.#btnSort) {
      this.#btnSort.textContent = this.#sorted ? '↑ SORT' : '↓ SORT';
    }
    this.#displayMovements(acc.movements, this.#sorted);
  }
}

// ——— Data ———
const account1 = {
  owner: 'Jonas Schmedtmann',
  movements: [200, 450, -400, 3000, -650, -130, 70, 1300],
  interestRate: 1.2,
  pin: 1111,
};

const account2 = {
  owner: 'Jessica Davis',
  movements: [5000, 3400, -150, -790, -3210, -1000, 8500, -30],
  interestRate: 1.5,
  pin: 2222,
};

const account3 = {
  owner: 'Steven Thomas Williams',
  movements: [200, -200, 340, -300, -20, 50, 400, -460],
  interestRate: 0.7,
  pin: 3333,
};

const account4 = {
  owner: 'Sarah Smith',
  movements: [430, 1000, 700, 50, 90],
  interestRate: 1,
  pin: 4444,
};

const accounts = [account1, account2, account3, account4];
createUsernames(accounts);

// ——— DOM refs and init ———
const app = new BankistApp({
  labelWelcome: document.querySelector('.welcome'),
  labelDate: document.querySelector('.date'),
  labelBalance: document.querySelector('.balance__value'),
  labelSumIn: document.querySelector('.summary__value--in'),
  labelSumOut: document.querySelector('.summary__value--out'),
  labelSumInterest: document.querySelector('.summary__value--interest'),
  labelTimer: document.querySelector('.timer'),
  containerApp: document.querySelector('.app'),
  containerMovements: document.querySelector('.movements'),
  btnLogin: document.querySelector('.login__btn'),
  btnTransfer: document.querySelector('.form__btn--transfer'),
  btnLoan: document.querySelector('.form__btn--loan'),
  btnClose: document.querySelector('.form__btn--close'),
  btnSort: document.querySelector('.btn--sort'),
  inputLoginUsername: document.querySelector('.login__input--user'),
  inputLoginPin: document.querySelector('.login__input--pin'),
  inputTransferTo: document.querySelector('.form__input--to'),
  inputTransferAmount: document.querySelector('.form__input--amount'),
  inputLoanAmount: document.querySelector('.form__input--loan-amount'),
  inputCloseUsername: document.querySelector('.form--close .form__input--user'),
  inputClosePin: document.querySelector('.form--close .form__input--pin'),
  spinnerOverlay: document.getElementById('spinnerOverlay'),
  spinnerText: document.getElementById('spinnerText'),
  accounts,
});
