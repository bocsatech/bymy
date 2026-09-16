import { getUserById } from "./web-users-store.mjs";
import { maskPhone } from "./listing-detail-view.mjs";

function isCompanyAccount(profile) {
  const type = String(profile?.accountType || "").toLowerCase();
  return type === "business" || type === "dealer";
}

function profileDisplayName(user) {
  const profile = user?.profile || {};
  if (isCompanyAccount(profile)) {
    const company = String(profile.company || "").trim();
    if (company) return company;
  }
  const named = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (named) return named;
  const company = String(profile.company || "").trim();
  if (company) return company;
  return String(user?.displayName || "").trim();
}

export function sellerProfilePhone(profile = {}) {
  if (isCompanyAccount(profile)) {
    return String(profile.companyPhone || profile.phone || "").trim();
  }
  return String(profile.phone || "").trim();
}

export function mergeSellerProfilePhone(detail, profile) {
  if (!detail || String(detail.phone ?? "").trim()) return detail;
  const phone = sellerProfilePhone(profile);
  if (!phone) return detail;
  return {
    ...detail,
    phone,
    phoneMasked: maskPhone(phone),
  };
}

export async function attachSellerProfile(detail, userId) {
  const id = Number(userId);
  if (!detail || !Number.isFinite(id) || id <= 0) return detail;
  try {
    const user = await getUserById(id);
    if (!user) return detail;
    const profile = user.profile || {};
    const avatar = String(
      profile.companyLogoDataUrl || profile.avatarDataUrl || ""
    ).trim();
    const name = profileDisplayName(user);
    const companyAccount = isCompanyAccount(profile);
    const withSeller = {
      ...detail,
      sellerAvatarUrl: avatar || detail.sellerAvatarUrl || "",
      sellerIsCompany: companyAccount,
      sellerName: companyAccount
        ? name || detail.sellerName
        : detail.sellerName && detail.sellerName !== "Eladó"
          ? detail.sellerName
          : name || detail.sellerName,
    };
    return mergeSellerProfilePhone(withSeller, profile);
  } catch {
    return detail;
  }
}
