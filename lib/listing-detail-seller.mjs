/**
 * Eladó név + avatar a tulajdonos profiljából (Willhaben-szerű doboz).
 */
import { getUserById } from "./web-users-store.mjs";

function profileDisplayName(user) {
  const profile = user?.profile || {};
  const named = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (named) return named;
  const company = String(profile.company || "").trim();
  if (company) return company;
  return String(user?.displayName || "").trim();
}

export async function attachSellerProfile(detail, userId) {
  const id = Number(userId);
  if (!detail || !Number.isFinite(id) || id <= 0) return detail;
  try {
    const user = await getUserById(id);
    if (!user) return detail;
    const avatar = String(user.profile?.avatarDataUrl || "").trim();
    const name = profileDisplayName(user);
    return {
      ...detail,
      sellerAvatarUrl: avatar || detail.sellerAvatarUrl || "",
      sellerName:
        detail.sellerName && detail.sellerName !== "Eladó"
          ? detail.sellerName
          : name || detail.sellerName,
    };
  } catch {
    return detail;
  }
}
