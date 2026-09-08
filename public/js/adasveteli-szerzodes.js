import { fetchListing } from "./db-client.js?v=contract1";
import { getAuthUser, getProfile, requireAuthForPage } from "./site-auth.js?v=privateStreet1";
import { emptyPerson, isBusinessProfile, personFromProfile, vehicleFromListing } from "./adasveteli-data.js?v=contract1";
import { getPrivateStreet } from "./private-local-street.js?v=privateStreet1";

const root = document.getElementById("contract-root");
const state = { role: "seller", listing: null, vehicle: null, own: null, other: emptyPerson("person") };

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function field(name, label, value = "", wide = false, type = "text") {
  return `<label class="contract-field${wide ? " contract-field--wide" : ""}"><span>${label}</span><input data-field="${name}" type="${type}" value="${escapeHtml(value)}" /></label>`;
}

function partyFields(prefix, party, heading) {
  const isCompany = party.type === "company";
  return `<section class="contract-section"><h2>${heading}</h2>
    <div class="contract-grid">
      <label class="contract-field"><span>Fél típusa</span><select data-party-type="${prefix}"><option value="person"${isCompany ? "" : " selected"}>Magánszemély</option><option value="company"${isCompany ? " selected" : ""}>Cég</option></select></label>
      ${field(`${prefix}.fullName`, isCompany ? "Kapcsolattartó / képviselő neve" : "Teljes név", party.fullName)}
      ${isCompany ? field(`${prefix}.companyName`, "Cégnév", party.companyName, true) + field(`${prefix}.taxId`, "Adószám", party.taxId) + field(`${prefix}.representative`, "Cégjegyzésre jogosult képviselő", party.representative) : ""}
      ${field(`${prefix}.postalCode`, "Irányítószám", party.postalCode)}
      ${field(`${prefix}.city`, "Település", party.city)}
      ${field(`${prefix}.street`, "Utca, házszám", party.street, true)}
      ${field(`${prefix}.phone`, "Telefonszám", party.phone, false, "tel")}
      ${field(`${prefix}.email`, "E-mail", party.email, false, "email")}
      <div class="contract-field--wide contract-sensitive"><p class="contract-note"><strong>Csak ebben a böngészőben:</strong> a következő adatokat a Bymy nem menti és nem továbbítja.</p></div>
      ${!isCompany ? field(`${prefix}.birthPlace`, "Születési hely", party.birthPlace) + field(`${prefix}.birthDate`, "Születési idő", party.birthDate, false, "date") + field(`${prefix}.motherName`, "Anyja neve", party.motherName, true) : ""}
      ${field(`${prefix}.idCardNumber`, "Személyazonosító okmány száma", party.idCardNumber)}
      ${field(`${prefix}.addressCardNumber`, "Lakcímkártya száma", party.addressCardNumber)}
    </div></section>`;
}

function render() {
  const seller = state.role === "seller" ? state.own : state.other;
  const buyer = state.role === "buyer" ? state.own : state.other;
  const vehicle = state.vehicle;
  root.innerHTML = `<div class="contract-layout">
    <article class="contract-sheet" id="contract-print">
      <h1>GÉPJÁRMŰ ADÁSVÉTELI SZERZŐDÉS</h1>
      <p>A dokumentum kitöltését ellenőrizd aláírás és nyomtatás előtt.</p>
      <section class="contract-section"><h2>1. A jármű adatai</h2><div class="contract-grid">
        ${field("vehicle.make", "Gyártmány", vehicle.make)}${field("vehicle.model", "Típus / modell", vehicle.model)}${field("vehicle.type", "Kivitel", vehicle.type)}${field("vehicle.year", "Gyártási év", vehicle.year)}${field("vehicle.plate", "Rendszám", vehicle.plate)}${field("vehicle.vin", "Alvázszám", vehicle.vin)}${field("vehicle.mileage", "Kilométeróra állása", vehicle.mileage)}${field("vehicle.color", "Szín", vehicle.color)}${field("vehicle.price", "Vételár", vehicle.price)}${field("contract.date", "Szerződés kelte", new Date().toISOString().slice(0, 10), false, "date")}${field("contract.place", "Kötés helye", "")}
      </div></section>
      ${partyFields("seller", seller, "2. Eladó adatai")}
      ${partyFields("buyer", buyer, "3. Vevő adatai")}
      <section class="contract-section"><h2>4. Nyilatkozatok</h2><p class="contract-note">Az eladó kijelenti, hogy a jármű tulajdonjogával rendelkezik, és a járművet a vevő részére a fenti vételár ellenében értékesíti. A vevő a járművet megtekintett, ismert állapotban veszi át. A felek a jármű és az okmányok átadásának időpontját a végleges nyomtatott példányon rögzítik.</p></section>
      <div class="contract-signatures"><div class="contract-signature">Eladó aláírása</div><div class="contract-signature">Vevő aláírása</div></div>
    </article>
    <aside class="contract-side no-print"><h2>Adásvételi kitöltése</h2><p>Az autó és a saját fiókod adatai automatikusan bekerültek.</p>
      <div class="contract-role"><button type="button" data-role="seller" class="${state.role === "seller" ? "is-active" : ""}">Eladó vagyok</button><button type="button" data-role="buyer" class="${state.role === "buyer" ? "is-active" : ""}">Vevő vagyok</button></div>
      <p class="contract-sensitive">A másik fél adatait kézzel töltheted ki. Az okmány- és születési adatok csak ezen az eszközön, a nyitott szerződésben szerepelnek.</p>
      <div class="contract-qr"><strong>Mobilappos QR-adatátadás</strong><span>A biztonságos appos jóváhagyás a következő kiadásban érkezik. Addig a másik fél mezői kézzel kitölthetők.</span></div>
      <div class="contract-actions"><button type="button" class="contract-action contract-action--primary" data-print>Nyomtatás / PDF mentése</button><button type="button" class="contract-action" data-clear>Szenzitív adatok törlése</button></div><p class="contract-status" data-status></p>
    </aside></div>`;
  bind();
}

function partyForPrefix(prefix) {
  const ownPrefix = state.role === "seller" ? "seller" : "buyer";
  return prefix === ownPrefix ? state.own : state.other;
}

function bind() {
  root.querySelectorAll("[data-field]").forEach((input) => input.addEventListener("input", () => {
    const [group, key] = input.dataset.field.split(".");
    if (group === "vehicle") state.vehicle[key] = input.value;
    else if (group === "contract") return;
    else partyForPrefix(group)[key] = input.value;
  }));
  root.querySelectorAll("[data-role]").forEach((button) => button.addEventListener("click", () => { state.role = button.dataset.role; render(); }));
  root.querySelectorAll("[data-party-type]").forEach((select) => select.addEventListener("change", () => { partyForPrefix(select.dataset.partyType).type = select.value; render(); }));
  root.querySelector("[data-clear]")?.addEventListener("click", () => {
    [state.own, state.other].forEach((party) => { party.birthPlace = ""; party.birthDate = ""; party.motherName = ""; party.idCardNumber = ""; party.addressCardNumber = ""; });
    render();
    root.querySelector("[data-status]").textContent = "A csak helyben kezelt szenzitív mezők törölve.";
  });
  root.querySelector("[data-print]")?.addEventListener("click", () => window.print());
}

async function init() {
  const allowed = await requireAuthForPage();
  if (!allowed) return;
  const listingId = Number(new URLSearchParams(location.search).get("id"));
  if (!Number.isFinite(listingId) || listingId <= 0) { root.innerHTML = "<p class=\"contract-loading\">Hiányzó hirdetés.</p>"; return; }
  try {
    state.listing = await fetchListing(listingId);
    state.vehicle = vehicleFromListing(state.listing);
    const profile = getProfile();
    const user = getAuthUser();
    state.own = personFromProfile(profile, user);
    if (!isBusinessProfile(profile)) {
      const localStreet = await getPrivateStreet(user?.email);
      if (localStreet) state.own.street = localStreet;
    }
    document.querySelector("[data-contract-back]").href = `/hirdetes.html?id=${listingId}`;
    render();
  } catch (error) { root.innerHTML = `<p class="contract-loading">${escapeHtml(error.message || "A szerződés nem tölthető be.")}</p>`; }
}

init();
