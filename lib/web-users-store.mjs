/**
 * Web users — SQLite lokálisan, Supabase productionön (mindig async).
 */
import { isSupabaseBackend } from "./supabase/client.mjs";
import * as supabase from "./supabase/users.mjs";

export {
  SESSION_COOKIE,
  getProfilesFilePath,
  ensureProfilesStore,
  parseCookies,
  getSessionTokenFromRequest,
  sessionCookieHeader,
  clearSessionCookieHeader,
} from "./web-users.mjs";

async function sqlite() {
  return import("./web-users.mjs");
}

function dispatch(name) {
  return async (...args) => {
    if (isSupabaseBackend()) return supabase[name](...args);
    return (await sqlite())[name](...args);
  };
}

export const initWebUsersSchema = dispatch("initWebUsersSchema");
export const createUserSession = dispatch("createUserSession");
export const findOrCreateOAuthUser = dispatch("findOrCreateOAuthUser");
export const listUserIdentities = dispatch("listUserIdentities");
export const destroySession = dispatch("destroySession");
export const getUserBySessionToken = dispatch("getUserBySessionToken");
export const registerUser = dispatch("registerUser");
export const activateUserByToken = dispatch("activateUserByToken");
export const createActivationForEmail = dispatch("createActivationForEmail");
export const loginUser = dispatch("loginUser");
export const changeUserPassword = dispatch("changeUserPassword");
export const setUserDisplayName = dispatch("setUserDisplayName");
export const saveUserProfile = dispatch("saveUserProfile");
export const mergeUserProfileJson = dispatch("mergeUserProfileJson");
export const deleteUserAccount = dispatch("deleteUserAccount");
export const getUserById = dispatch("getUserById");
export const countWebUsers = dispatch("countWebUsers");
export const inspectWebUsersDb = dispatch("inspectWebUsersDb");
