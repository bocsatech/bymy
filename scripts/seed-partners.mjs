#!/usr/bin/env node
/** Demo fizetős partnerek betöltése az adatbázisba. */
import { fileURLToPath } from "url";
import { savePartner, partnerStats } from "../lib/partners.mjs";

export const demoPartners = [
  {
    name: "Fejér Autószerviz Kft.",
    address: "Fő utca 12.",
    postal_code: "8000",
    phone: "+36 22 123 4567",
    opening_hours: "H–P 8–17, Szo 8–12",
    google_rating: 4.7,
    google_review_count: 89,
    is_active: true,
    is_paid: true,
    services: ["autoszerelo", "autovillamossag"],
  },
  {
    name: "Gumi-Pro Székesfehérvár",
    address: "Berényi út 45.",
    postal_code: "8000",
    phone: "+36 22 234 5678",
    opening_hours: "H–P 7:30–18, Szo 8–14",
    google_rating: 4.5,
    google_review_count: 142,
    is_active: true,
    is_paid: true,
    services: ["gumiszerelo"],
  },
  {
    name: "Klíma-Autó Bt.",
    address: "Vásárhelyi u. 3.",
    postal_code: "8019",
    phone: "+36 22 345 6789",
    google_rating: 4.3,
    google_review_count: 56,
    is_active: true,
    is_paid: true,
    services: ["klimaszerelo", "autoszerelo"],
  },
  {
    name: "Dabas Gumiszerviz",
    address: "Kossuth L. u. 88.",
    postal_code: "1900",
    phone: "+36 29 456 7890",
    google_rating: 4.6,
    google_review_count: 73,
    is_active: true,
    is_paid: true,
    services: ["gumiszerelo", "lakatos"],
  },
  {
    name: "MVK Vizsgaállomás",
    address: "Ipari park 1.",
    postal_code: "8000",
    phone: "+36 22 567 8901",
    google_rating: 4.2,
    google_review_count: 210,
    is_active: true,
    is_paid: true,
    services: ["muszakivizsga", "eredetvizsga"],
  },
  {
    name: "Autó-Átírás Fejér",
    address: "Piac tér 5.",
    postal_code: "8000",
    phone: "+36 22 678 9012",
    google_rating: 4.8,
    google_review_count: 34,
    is_active: true,
    is_paid: true,
    services: ["atiras_ugyintezes"],
  },
  {
    name: "Premium Autókozmetika",
    address: "Palotai út 20.",
    postal_code: "8019",
    phone: "+36 22 789 0123",
    google_rating: 4.9,
    google_review_count: 28,
    is_active: true,
    is_paid: true,
    services: ["autokozmetika"],
  },
  {
    name: "Budapest Átírás Center",
    address: "Váci út 100.",
    postal_code: "1138",
    phone: "+36 1 234 5678",
    google_rating: 4.4,
    google_review_count: 95,
    is_active: true,
    is_paid: true,
    services: ["atiras_ugyintezes"],
  },
  {
    name: "Pest Autószerelő 24",
    address: "Gyáli út 15.",
    postal_code: "1117",
    phone: "+36 1 345 6789",
    google_rating: 4.1,
    google_review_count: 167,
    is_active: true,
    is_paid: true,
    services: ["autoszerelo", "autovillamossag", "klimaszerelo"],
  },
  {
    name: "Velencei Gumiszerviz",
    address: "Fő utca 2.",
    postal_code: "2481",
    phone: "+36 25 123 456",
    google_rating: 4.0,
    google_review_count: 41,
    is_active: true,
    is_paid: true,
    services: ["gumiszerelo"],
  },
];

export function seedDemoPartnersIfEmpty() {
  const before = partnerStats();
  if (before.total > 0) {
    return { seeded: false, stats: before };
  }
  for (const row of demoPartners) {
    savePartner(row);
  }
  return { seeded: true, stats: partnerStats() };
}

export function seedDemoPartners() {
  for (const row of demoPartners) {
    savePartner(row);
  }
  return partnerStats();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("Demo partnerek betöltve:", seedDemoPartners());
}
