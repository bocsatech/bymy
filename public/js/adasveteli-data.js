export const CONTRACT_FIELDS = [
  "fullName",
  "companyName",
  "taxId",
  "representative",
  "postalCode",
  "city",
  "street",
  "phone",
  "email",
  "birthPlace",
  "birthDate",
  "motherName",
  "idCardNumber",
  "addressCardNumber",
];

function text(value) {
  return String(value ?? "").trim();
}

export function isBusinessProfile(profile = {}) {
  return text(profile.accountType) === "business" || Boolean(text(profile.company));
}

export function personFromProfile(profile = {}, user = {}) {
  const business = isBusinessProfile(profile);
  const firstName = text(profile.firstName);
  const lastName = text(profile.lastName);
  const personalName = [lastName, firstName].filter(Boolean).join(" ");
  const companyName = text(profile.company);
  const contactName = text(profile.salespersonName) || personalName;

  return {
    type: business ? "company" : "person",
    fullName: business ? contactName : personalName || text(user.displayName),
    companyName: business ? companyName : "",
    taxId: business ? text(profile.companyTaxId) : "",
    representative: business ? contactName : "",
    postalCode: business ? text(profile.companyPostalCode) || text(profile.postalCode) : text(profile.postalCode),
    city: business ? text(profile.companyCity) || text(profile.city) : text(profile.city),
    street: business ? text(profile.companyStreet) || text(profile.companyAddress) || text(profile.street) : text(profile.street),
    phone: business ? text(profile.companyPhone) || text(profile.phone) : text(profile.phone),
    email: business ? text(profile.companyEmail) || text(user.email) : text(user.email),
    birthPlace: "",
    birthDate: "",
    motherName: "",
    idCardNumber: "",
    addressCardNumber: "",
  };
}

function valueFromDetail(detail = {}, listing = {}, keys = []) {
  for (const key of keys) {
    if (detail[key] != null && detail[key] !== "") return text(detail[key]);
    if (listing?.form?.[key] != null && listing.form[key] !== "") return text(listing.form[key]);
  }
  const rows = [...(detail.basics || []), ...(detail.bodyTech || [])];
  for (const key of keys) {
    const found = rows.find((row) => text(row.key) === key || text(row.field_key) === key);
    if (found?.value != null && found.value !== "") return text(found.value);
  }
  return "";
}

export function vehicleFromListing(listing = {}) {
  const detail = listing.detail || {};
  const brand = valueFromDetail(detail, listing, ["gyartmany", "brand"]) || text(detail.brand);
  const model = valueFromDetail(detail, listing, ["modell", "tipus", "model"]);
  return {
    make: brand,
    model,
    type: valueFromDetail(detail, listing, ["tipus", "kivitel"]),
    year: valueFromDetail(detail, listing, ["gyartasi_ev", "year"]),
    month: valueFromDetail(detail, listing, ["gyartasi_honap"]),
    plate: valueFromDetail(detail, listing, ["rendszam", "plate"]),
    vin: valueFromDetail(detail, listing, ["alvazszam", "vin"]),
    mileage: valueFromDetail(detail, listing, ["km", "mileage"]),
    color: valueFromDetail(detail, listing, ["szin", "color"]),
    price: valueFromDetail(detail, listing, ["vetelar", "akcios_ar", "price"]) || text(detail.price),
    title: text(detail.title) || [brand, model].filter(Boolean).join(" ") || text(listing.hirdetes_cime),
  };
}

export function emptyPerson(type = "person") {
  return {
    type: type === "company" ? "company" : "person",
    fullName: "",
    companyName: "",
    taxId: "",
    representative: "",
    postalCode: "",
    city: "",
    street: "",
    phone: "",
    email: "",
    birthPlace: "",
    birthDate: "",
    motherName: "",
    idCardNumber: "",
    addressCardNumber: "",
  };
}
