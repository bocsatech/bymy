/**
 * Vételár mezők: legördülő lista 500 000 Ft-os lépésekkel, de a mezőbe
 * bármilyen konkrét összeg be is írható.
 *
 * A natív <datalist> nem járható út: number típusú mezőn a Chrome nem rajzol
 * legördülő jelzést, a felajánlott értékek pedig nem jeleníthetők meg ezres
 * tagolással, mert a number mező csak nyers számot fogad el.
 *
 * A beírt összeg ezres tagolással jelenik meg, a gépi olvasáshoz a nyers
 * számjegyek a mező `data-amount` attribútumában maradnak.
 */

const STEP = 500_000;
const MAX = 50_000_000;

const priceFormat = new Intl.NumberFormat("hu-HU");

const AMOUNTS = (() => {
  const amounts = [];
  for (let amount = STEP; amount <= MAX; amount += STEP) amounts.push(amount);
  return amounts;
})();

function digitsOf(value) {
  return String(value ?? "").replace(/\D+/g, "");
}

function formatDigits(digits) {
  return digits ? priceFormat.format(Number(digits)) : "";
}

function initPriceCombo(input) {
  const field = input.closest(".home-qs-field");
  if (!field) return;

  field.classList.add("home-qs-field--combo");

  const list = document.createElement("ul");
  list.className = "home-qs-combo-list";
  list.id = `${input.id}-lista`;
  list.hidden = true;
  list.setAttribute("role", "listbox");
  field.appendChild(list);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);

  let options = [];
  let activeIndex = -1;
  let typing = false;

  function setActive(index) {
    activeIndex = index;
    options.forEach((option, i) => {
      const isActive = i === index;
      option.classList.toggle("is-active", isActive);
      option.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    if (index < 0) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    input.setAttribute("aria-activedescendant", options[index].id);
    options[index].scrollIntoView({ block: "nearest" });
  }

  function close() {
    if (list.hidden) return;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  }

  /* A beírt számjegyekkel kezdődő összegeket ajánljuk fel: „35” → 3 500 000. */
  function render(typed) {
    const matches = typed
      ? AMOUNTS.filter((amount) => String(amount).startsWith(typed))
      : AMOUNTS;

    list.textContent = "";
    options = matches.map((amount) => {
      const option = document.createElement("li");
      option.className = "home-qs-combo-option";
      option.id = `${list.id}-${amount}`;
      option.dataset.amount = String(amount);
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.textContent = formatDigits(String(amount));
      list.appendChild(option);
      return option;
    });
    return options.length > 0;
  }

  /*
   * Szűrni csak gépelés közben van értelme: kész összeg mellett a teljes lista
   * jön be a mostani értékre görgetve.
   */
  function open() {
    const amount = input.dataset.amount;
    if (!render(typing ? digitsOf(input.value) : "")) {
      close();
      return;
    }
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    list.scrollTop = 0;
    setActive(
      typing || !amount
        ? -1
        : options.findIndex((option) => option.dataset.amount === amount),
    );
  }

  function setAmount(digits) {
    if (digits) input.dataset.amount = digits;
    else delete input.dataset.amount;
  }

  /* Ezres tagolással írjuk vissza, amit a felhasználó beírt vagy kiválasztott. */
  function commit(digits) {
    typing = false;
    input.value = formatDigits(digits);
    setAmount(digits);
  }

  /* A mezőre (címkéjére, nyilára) kattintva a teljes lista nyílik-záródik. */
  field.addEventListener("pointerdown", (event) => {
    if (list.contains(event.target)) return;
    if (!list.hidden) {
      close();
      return;
    }
    typing = false;
    open();
  });

  /* A nyers összeg gépelés közben is naprakész, nem csak a mező elhagyásakor. */
  input.addEventListener("input", () => {
    typing = true;
    setAmount(digitsOf(input.value));
    open();
  });

  input.addEventListener("blur", () => {
    commit(digitsOf(input.value));
    close();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (list.hidden) {
        typing = false;
        open();
      } else {
        setActive(Math.min(activeIndex + 1, options.length - 1));
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!list.hidden) setActive(Math.max(activeIndex - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      if (list.hidden) return;
      event.preventDefault();
      close();
      return;
    }
    /* Nyitott listán az Enter választ, nem indítja el a keresést. */
    if (event.key === "Enter" && !list.hidden && activeIndex >= 0) {
      event.preventDefault();
      commit(options[activeIndex].dataset.amount);
      close();
    }
  });

  /* A mousedown alapértelmezését elnyomjuk, különben a mező elveszti a
     fókuszt, a blur bezárja a listát, és a click már nem talál elemet. */
  list.addEventListener("mousedown", (event) => event.preventDefault());
  list.addEventListener("click", (event) => {
    const option = event.target.closest(".home-qs-combo-option");
    if (!option) return;
    commit(option.dataset.amount);
    close();
  });

  input.form?.addEventListener("reset", () => {
    typing = false;
    delete input.dataset.amount;
    close();
  });
}

export function initHomePriceCombos(inputs) {
  for (const input of inputs) {
    if (input) initPriceCombo(input);
  }
}
