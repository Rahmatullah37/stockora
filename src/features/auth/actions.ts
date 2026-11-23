"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/safe-redirect";
import { getSiteUrl } from "@/lib/utils/site-url";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import type { ActionResult } from "@/hooks/use-form-action";

/**
 * Server Actions for authentication.
 * They run ONLY on the server. Each one re-validates its input with Zod,
 * because data coming from the browser can never be trusted.
 */

const FORM_INVALID = "Please check the form and try again.";

/** Turns Supabase's technical error codes into messages a shopkeeper understands. */
function friendlyAuthError(error: { code?: string; message: string }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please verify your email first. Check your inbox for the link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try logging in instead.";
    case "weak_password":
      return "That password is too weak. Use a longer password with letters and numbers.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "same_password":
      return "Your new password must be different from your old one.";
    case "session_not_found":
    case "session_expired":
      return "Your reset link has expired. Please request a new one.";
   default:
  console.error("Auth error:", error.code, error.message);
  return "Something went wrong. Please try again.";
  }
}

export async function loginAction(
  values: LoginInput,
  next?: string,
): Promise<ActionResult | void> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  console.log("[LOGIN RESULT]", {
  hasUser: Boolean(data?.user),
  hasSession: Boolean(data?.session),
  error: error
    ? {
        name: error.name,
        message: error.message,
        code: error.code,
        status: error.status,
      }
    : null,
});
  if (error) return { error: friendlyAuthError(error) };

  // If the shop owner invited this email, join the shop now.
  await supabase.rpc("accept_pending_invitations");

  // Use the language the person chose in their profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", data.user.id)
    .maybeSingle();
  if (isLocale(profile?.preferred_language)) {
    (await cookies()).set(LOCALE_COOKIE, profile.preferred_language, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  redirect(safeRedirectPath(next));
}


// export async function loginAction(
//   values: LoginInput,
//   next?: string,
// ): Promise<ActionResult | void> {
//   const parsed = loginSchema.safeParse(values);
//   if (!parsed.success) return { error: FORM_INVALID };

//   const supabase = await createClient();

//   const { error } = await supabase.auth.signInWithPassword(parsed.data);

//   if (error) {
//     return { error: friendlyAuthError(error) };
//   }

//   redirect(safeRedirectPath(next));
// }


export async function registerAction(
  values: RegisterInput,
): Promise<ActionResult | void> {
  const parsed = registerSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };
  const input = parsed.data;

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();

  // The shop details travel as "user metadata". A database trigger
  // (handle_new_user) turns them into a profile, a shop, an owner membership,
  // default settings and a Free subscription — all in one transaction.
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
      data: {
        full_name: input.fullName,
        phone_number: input.phone,
        shop_name: input.shopName,
        country: input.country,
        currency: input.currency,
        address: input.address,
        business_category: input.businessCategory,
      },
    },
  });

  if (error) {
    // "Database error saving new user" means our trigger rejected the data.
    if (error.code === "unexpected_failure") {
      console.error("Sign-up trigger failed:", error.message);
      return {
        error:
          "We could not create your shop. Please check your details, and make sure the database migrations were applied.",
      };
    }
    return { error: friendlyAuthError(error) };
  }

  // When the email already exists, Supabase (with email confirmation on) returns
  // a fake user with no identities, to avoid revealing which emails are registered.
  if (data.user && data.user.identities?.length === 0) {
    return { error: "An account with this email already exists. Try logging in instead." };
  }

  // Email confirmation OFF -> we already have a session. ON -> ask them to verify.
  if (data.session) redirect("/dashboard");
  redirect(`/verify-email?email=${encodeURIComponent(input.email)}`);
}

export async function forgotPasswordAction(
  values: ForgotPasswordInput,
): Promise<ActionResult | void> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };

  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  });

  // Only report rate-limit problems. For everything else we show the same
  // message, so nobody can use this form to discover which emails are registered.
  if (error && error.code === "over_email_send_rate_limit") {
    return { error: friendlyAuthError(error) };
  }
  return { success: "sent" };
}

export async function resetPasswordAction(
  values: ResetPasswordInput,
): Promise<ActionResult | void> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return { error: FORM_INVALID };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
 if (error) {
  console.error("Login failed:", error.code, error.status, error.message);
  return { error: friendlyAuthError(error) };
}

  redirect("/dashboard");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
