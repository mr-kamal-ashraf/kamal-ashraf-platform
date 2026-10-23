import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { Types } from "mongoose";
import { User, type UserDocument } from "../users/user.model";
import { ApiError } from "../../shared/utils/ApiError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../shared/utils/jwt";
import { env } from "../../config/env";
import { ROLES } from "../../config/constants";
import {
  createSession,
  findSessionByRefreshToken,
  findSessionByAnyRefreshHash,
  findSessionJustRotatedFrom,
  rotateSession,
  revokeSession,
  revokeAllUserSessions,
  revokeOtherUserSessions,
} from "../sessions/session.service";
import type {
  RegisterInput,
  LoginInput,
  RegistrationVerificationCheckInput,
  PasswordResetRequestInput,
  PasswordResetCheckInput,
  PasswordResetInput,
} from "./auth.validation";
import { logger } from "../../shared/utils/logger";
import {
  clearLoginAttempts,
  lockAccount,
  takeLoginAttempt,
} from "../../shared/utils/loginLockout";
import { RegistrationVerification } from "./registration-verification.model";
import { PasswordReset } from "./password-reset.model";
import {
  isWhatsappReady,
  sendWhatsappText,
} from "../whatsapp-bridge/whatsapp-bridge.service";

// Pre-computed bcrypt hash of a dummy random string.
// Purpose: when a login attempt uses an unknown phone number, we still run
// bcrypt.compare() against this hash so the response time is the same as a
// real failed login. This prevents an attacker from enumerating valid phone
// numbers by measuring response times (timing side-channel attack).
const DUMMY_BCRYPT_HASH =
  "$2a$12$CwTycUXWue0Thq9StjUM0uJ8nC9wQhQLBXa8l7w2eJg6P9aQ2bR1y";

interface AuthMeta {
  userAgent: string;
  ipAddress: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  user: UserDocument;
  tokens: AuthTokens;
  sessionId: string;
}

const REGISTRATION_CODE_TTL_MS = 10 * 60 * 1000;
const REGISTRATION_CODE_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REGISTRATION_CODE_ATTEMPTS = 5;

function generateVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function buildStudentVerificationMessage(code: string): string {
  const platform = env.PLATFORM_NAME?.trim() || "منصتنا";
  return [
    `كود تأكيد إنشاء حسابك على ${platform}: ${code}`,
    "الكود صالح لمدة 10 دقائق.",
  ].join("\n");
}

function buildParentVerificationMessage(code: string): string {
  const platform = env.PLATFORM_NAME?.trim() || "منصتنا";
  return [
    `كود تأكيد رقم ولي الأمر على ${platform}: ${code}`,
    "الكود صالح لمدة 10 دقائق.",
  ].join("\n");
}

/**
 * Creates a code pair and delivers it over the platform's linked WhatsApp
 * number. Both deliveries must succeed; otherwise the code pair is deleted so
 * no account can be created from a partially delivered verification.
 */
export async function sendRegistrationVerificationCodes(input: {
  studentPhone: string;
  parentPhone: string;
}): Promise<{ expiresInSeconds: number; resendAfterSeconds: number }> {
  const existingUser = await User.exists({ studentPhone: input.studentPhone });
  if (existingUser) {
    throw ApiError.conflict(
      "رقم موبايل الطالب ده مسجل قبل كده",
      "PHONE_ALREADY_REGISTERED",
    );
  }

  if (!isWhatsappReady()) {
    throw new ApiError(
      503,
      "خدمة واتساب مش متصلة دلوقتي، حاول تاني بعد ما المنصة تربط واتساب.",
      { code: "WHATSAPP_NOT_CONNECTED" },
    );
  }

  const now = new Date();
  const current = await RegistrationVerification.findOne({
    studentPhone: input.studentPhone,
    parentPhone: input.parentPhone,
  }).select("resendAvailableAt");

  if (current?.resendAvailableAt && current.resendAvailableAt > now) {
    const seconds = Math.ceil(
      (current.resendAvailableAt.getTime() - now.getTime()) / 1000,
    );
    throw ApiError.tooManyRequests(
      `استنى ${seconds} ثانية قبل طلب أكواد جديدة.`,
      "VERIFICATION_RESEND_COOLDOWN",
    );
  }

  const [studentCode, parentCode] = [
    generateVerificationCode(),
    generateVerificationCode(),
  ];
  const [studentCodeHash, parentCodeHash] = await Promise.all([
    bcrypt.hash(studentCode, env.BCRYPT_SALT_ROUNDS),
    bcrypt.hash(parentCode, env.BCRYPT_SALT_ROUNDS),
  ]);

  const expiresAt = new Date(now.getTime() + REGISTRATION_CODE_TTL_MS);
  const resendAvailableAt = new Date(
    now.getTime() + REGISTRATION_CODE_RESEND_COOLDOWN_MS,
  );
  await RegistrationVerification.findOneAndUpdate(
    { studentPhone: input.studentPhone, parentPhone: input.parentPhone },
    {
      $set: {
        studentCodeHash,
        parentCodeHash,
        attempts: 0,
        expiresAt,
        resendAvailableAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const [studentDelivery, parentDelivery] = await Promise.all([
    sendWhatsappText(
      input.studentPhone,
      buildStudentVerificationMessage(studentCode),
    ),
    sendWhatsappText(
      input.parentPhone,
      buildParentVerificationMessage(parentCode),
    ),
  ]);

  if (!studentDelivery.sent || !parentDelivery.sent) {
    await RegistrationVerification.deleteOne({
      studentPhone: input.studentPhone,
      parentPhone: input.parentPhone,
    });
    logger.warn("[auth] registration verification delivery failed", {
      studentSent: studentDelivery.sent,
      parentSent: parentDelivery.sent,
      studentReason: studentDelivery.reason,
      parentReason: parentDelivery.reason,
    });
    throw new ApiError(
      503,
      "تعذر إرسال الكودين على واتساب. اتأكد إن الرقمين عليهما واتساب وحاول تاني.",
      { code: "VERIFICATION_DELIVERY_FAILED" },
    );
  }

  return { expiresInSeconds: 600, resendAfterSeconds: 60 };
}

type RegistrationVerificationInput = Pick<
  RegisterInput,
  | "studentPhone"
  | "parentPhone"
  | "studentVerificationCode"
  | "parentVerificationCode"
>;

/**
 * Validates a code pair, optionally consuming it only after final
 * registration. Like the reset code, the try is taken atomically before
 * comparing (parallel guesses can't share one count) and given back when
 * both codes are right.
 */
async function validateRegistrationVerification(
  input: RegistrationVerificationInput,
  consume: boolean,
): Promise<void> {
  const pair = {
    studentPhone: input.studentPhone,
    parentPhone: input.parentPhone,
  };
  const verification = await RegistrationVerification.findOneAndUpdate(
    {
      ...pair,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_REGISTRATION_CODE_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { new: true },
  ).select("+studentCodeHash +parentCodeHash attempts");

  const exceeded = () => {
    throw ApiError.tooManyRequests(
      "تم إدخال كود خاطئ مرات كثيرة. اطلب كودين جديدين.",
      "VERIFICATION_ATTEMPTS_EXCEEDED",
    );
  };

  if (!verification) {
    if (
      await RegistrationVerification.findOneAndDelete({
        ...pair,
        attempts: { $gte: MAX_REGISTRATION_CODE_ATTEMPTS },
      })
    ) {
      exceeded();
    }
    throw ApiError.forbidden(
      "الكودين انتهت صلاحيتهم أو لم يتم طلبهما. اطلب كودين جديدين.",
      "VERIFICATION_NOT_FOUND_OR_EXPIRED",
    );
  }

  const [studentMatches, parentMatches] = await Promise.all([
    bcrypt.compare(input.studentVerificationCode, verification.studentCodeHash),
    bcrypt.compare(input.parentVerificationCode, verification.parentCodeHash),
  ]);

  if (!studentMatches || !parentMatches) {
    if (verification.attempts >= MAX_REGISTRATION_CODE_ATTEMPTS) {
      await verification.deleteOne();
      exceeded();
    }
    throw ApiError.forbidden(
      "كود الطالب أو كود ولي الأمر غير صحيح.",
      "INVALID_VERIFICATION_CODE",
    );
  }

  await RegistrationVerification.updateOne(
    { _id: verification._id },
    { $inc: { attempts: -1 } },
  );
  if (!consume) return;

  // Consume the pair before creating an account. The _id condition makes an
  // accidental duplicate submit unable to reuse the same successful codes.
  const consumed = await RegistrationVerification.deleteOne({
    _id: verification._id,
    expiresAt: { $gt: new Date() },
  });
  if (consumed.deletedCount !== 1) {
    throw ApiError.forbidden(
      "الكودين تم استخدامهما أو انتهت صلاحيتهما. اطلب كودين جديدين.",
      "VERIFICATION_ALREADY_CONSUMED",
    );
  }
}

/** Confirms code correctness while keeping the pair for the final submit. */
export async function verifyRegistrationVerificationCodes(
  input: RegistrationVerificationCheckInput,
): Promise<void> {
  await validateRegistrationVerification(input, false);
}

/** Validates and consumes a code pair immediately before account creation. */
async function consumeRegistrationVerification(
  input: RegisterInput,
): Promise<void> {
  await validateRegistrationVerification(input, true);
}

/**
 * Creates a new student account.
 * - Checks for duplicate phone number before saving.
 * - Hashes the password before storing (never stores plaintext).
 * - Account starts active — students browse and buy courses immediately.
   Access to a course's lessons is gated by ownership (a purchase or an admin
   cash-grant), not by a global account activation step.
 */
export async function registerStudent(
  input: RegisterInput,
): Promise<UserDocument> {
  const existing = await User.findOne({ studentPhone: input.studentPhone });
  if (existing) {
    throw ApiError.conflict(
      "رقم الهاتف ده مسجل قبل كده",
      "PHONE_ALREADY_REGISTERED",
    );
  }

  await consumeRegistrationVerification(input);

  const passwordHash = await bcrypt.hash(
    input.password,
    env.BCRYPT_SALT_ROUNDS,
  );

  const user = await User.create({
    firstName: input.firstName,
    secondName: input.secondName,
    thirdName: input.thirdName,
    studentPhone: input.studentPhone,
    parentPhone: input.parentPhone,
    passwordHash,
    stage: input.stage,
    isActive: true,
    isSuspended: false,
  });

  return user;
}

/**
 * Issue tokens for a freshly registered student so they are logged-in
 * immediately after sign-up — no separate login step required.
 */
export async function loginStudentAfterRegister(
  user: UserDocument,
  meta: AuthMeta,
): Promise<AuthResult> {
  user.lastLoginAt = new Date();
  await user.save();

  const tokensAndSession = await issueTokensAndSession(user._id, meta);
  return { user, ...tokensAndSession };
}

/**
 * Authenticates a student using phone number + password.
 *
 * Security measures:
 *  1. Dummy bcrypt compare if phone not found (timing attack prevention).
 *  2. Account lockout after MAX_LOGIN_ATTEMPTS failed attempts.
 *  3. Suspended accounts are rejected even if credentials are correct.
 *  4. On success: failed attempts and lockout are reset.
 */
export async function loginStudent(
  input: LoginInput,
  meta: AuthMeta,
): Promise<AuthResult> {
  const user = await User.findOne({ studentPhone: input.studentPhone }).select(
    "+passwordHash",
  );

  if (!user) {
    // Run a dummy compare so an attacker cannot tell from response time
    // whether the phone number exists in our database.
    await bcrypt.compare(input.password, DUMMY_BCRYPT_HASH);
    throw ApiError.unauthorized(
      "رقم الهاتف أو كلمة السر غير صحيحة",
      "INVALID_CREDENTIALS",
    );
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw ApiError.tooManyRequests(
      "حسابك متوقف مؤقتاً بسبب محاولات دخول كتيرة. حاول تاني بعد شوية",
      "ACCOUNT_LOCKED",
    );
  }

  if (user.isSuspended) {
    throw ApiError.forbidden(
      "حسابك معلّق. تواصل مع الأستاذ",
      "ACCOUNT_SUSPENDED",
    );
  }

  const attempt = await takeLoginAttempt(User, user._id);
  if (!attempt) {
    throw ApiError.tooManyRequests(
      "حسابك متوقف مؤقتاً بسبب محاولات دخول كتيرة. حاول تاني بعد شوية",
      "ACCOUNT_LOCKED",
    );
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatch) {
    if (attempt.last) {
      await lockAccount(User, user._id);
      logger.warn(`Student account locked due to failed attempts`, {
        userId: user._id.toString(),
      });
    }
    throw ApiError.unauthorized(
      "رقم الهاتف أو كلمة السر غير صحيحة",
      "INVALID_CREDENTIALS",
    );
  }

  user.lastLoginAt = new Date();
  await clearLoginAttempts(User, user._id, { lastLoginAt: user.lastLoginAt });

  const tokensAndSession = await issueTokensAndSession(user._id, meta);

  return { user, ...tokensAndSession };
}

/**
 * Internal helper: creates a DB session record and signs a new token pair.
 * Called by both loginStudent() and loginStudentAfterRegister().
 *
 * Flow:
 *   1. Sign a temp refresh token (before session exists) just to get the value.
 *   2. Store the session (hash of refresh token is saved, not the raw token).
 *   3. Sign the access token with the session ID embedded in the payload.
 */
async function issueTokensAndSession(
  userId: Types.ObjectId,
  meta: AuthMeta,
): Promise<{ tokens: AuthTokens; sessionId: string }> {
  const tempRefreshToken = signRefreshToken({
    sub: userId.toString(),
    role: ROLES.STUDENT,
  });

  const session = await createSession({
    userId,
    role: ROLES.STUDENT,
    refreshToken: tempRefreshToken,
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });

  const accessToken = signAccessToken({
    sub: userId.toString(),
    role: ROLES.STUDENT,
    sessionId: session._id.toString(),
  });

  return {
    tokens: { accessToken, refreshToken: tempRefreshToken },
    sessionId: session._id.toString(),
  };
}

/**
 * Rotates the student's session:
 *  1. Verifies the refresh token signature and expiry.
 *  2. Looks up the matching active session in the DB.
 *  3. If the token is valid but matches an OLD (already-rotated) hash,
 *     it was probably stolen — revoke ALL sessions for that user.
 *  4. Issues a new token pair and saves the new hash to the session.
 *
 * A refresh racing another one for the same session (two tabs) gets a new
 * access token only — refreshToken null: the browser already holds the new
 * refresh cookie the other request set.
 *
 * This is called by POST /auth/refresh.
 */
export async function refreshStudentSession(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  userId: string;
}> {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized(
      "الجلسة انتهت، سجّل الدخول تاني.",
      "INVALID_REFRESH_TOKEN",
    );
  }

  if (payload.role !== ROLES.STUDENT) {
    throw ApiError.unauthorized(
      "الجلسة غير صالحة، سجّل الدخول تاني.",
      "WRONG_TOKEN_TYPE",
    );
  }

  let session = await findSessionByRefreshToken(refreshToken);
  let racing = false;
  if (!session) {
    session = await findSessionJustRotatedFrom(refreshToken);
    racing = !!session;
  }
  if (!session) {
    // Token is JWT-valid but doesn't match any active session.
    // If it matches a previously-rotated hash, treat as theft and
    // revoke every session this user has.
    const stolenSession = await findSessionByAnyRefreshHash(refreshToken);
    if (stolenSession) {
      logger.warn("Refresh-token reuse detected — revoking all user sessions", {
        userId: payload.sub,
        sessionId: stolenSession._id.toString(),
      });
      await revokeAllUserSessions(
        stolenSession.userId,
        ROLES.STUDENT,
        "REFRESH_TOKEN_REUSE",
      );
    }
    throw ApiError.unauthorized(
      "الجلسة منتهية أو ملغية. سجّل دخول من جديد",
      "SESSION_NOT_FOUND",
    );
  }

  const user = await User.findById(payload.sub);
  if (!user || user.isSuspended) {
    await revokeSession(session._id, "USER_NOT_AVAILABLE");
    throw ApiError.unauthorized("الحساب غير متاح", "USER_NOT_AVAILABLE");
  }

  const newAccessToken = signAccessToken({
    sub: user._id.toString(),
    role: ROLES.STUDENT,
    sessionId: session._id.toString(),
  });

  if (!racing) {
    const newRefreshToken = signRefreshToken({
      sub: user._id.toString(),
      role: ROLES.STUDENT,
    });
    if (await rotateSession(session._id, refreshToken, newRefreshToken)) {
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        userId: user._id.toString(),
      };
    }
    // A parallel refresh rotated it first — or the session was just revoked.
    if (!(await findSessionJustRotatedFrom(refreshToken))) {
      throw ApiError.unauthorized(
        "الجلسة منتهية أو ملغية. سجّل دخول من جديد",
        "SESSION_NOT_FOUND",
      );
    }
  }

  return {
    accessToken: newAccessToken,
    refreshToken: null,
    userId: user._id.toString(),
  };
}

/**
 * Logs out a student by revoking their current session in the DB.
 * The HttpOnly cookies are cleared by the controller after this call.
 */
export async function logoutStudent(sessionId: string | undefined) {
  if (!sessionId) return;
  await revokeSession(sessionId);
}

/**
 * Allows a student to change their own password.
 * Verifies the current password before updating, then revokes every OTHER
 * session so other devices must log in again with the new password, while
 * the device that made the change stays signed in.
 */
export async function changeStudentPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionId?: string,
) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw ApiError.notFound("المستخدم غير موجود", "USER_NOT_FOUND");

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw ApiError.badRequest(
      "كلمة السر الحالية غير صحيحة",
      "WRONG_CURRENT_PASSWORD",
    );
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  await user.save();
  await revokeOtherUserSessions(
    user._id,
    ROLES.STUDENT,
    currentSessionId,
    "password_changed",
  );
}

// ── Forgot password ───────────────────────────────────────────────────────────
// A six-digit code goes to the student's own WhatsApp; the same rules as the
// registration codes apply (hashed, 10-minute life, resend cooldown, a few
// tries per code). Resetting signs the student out everywhere.

const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PASSWORD_RESET_ATTEMPTS = 5;

function platformName(): string {
  return env.PLATFORM_NAME?.trim() || "منصتنا";
}

function buildPasswordResetMessage(code: string): string {
  return [
    `كود تغيير كلمة السر لحسابك على ${platformName()}: ${code}`,
    "الكود صالح لمدة 10 دقائق.",
    "لو مش إنت اللي طلبت تغيير كلمة السر، تجاهل الرسالة دي وحسابك في أمان.",
  ].join("\n");
}

function buildPasswordChangedMessage(): string {
  return [
    `تم تغيير كلمة السر لحسابك على ${platformName()} ✅`,
    "لو مش إنت اللي غيّرتها، كلّم المستر فوراً.",
  ].join("\n");
}

/** Sends a reset code to the WhatsApp of the account registered with this phone. */
export async function requestPasswordReset(
  input: PasswordResetRequestInput,
): Promise<{ expiresInSeconds: number; resendAfterSeconds: number }> {
  const user = await User.findOne({ studentPhone: input.studentPhone }).select(
    "_id studentPhone",
  );
  if (!user) {
    throw ApiError.notFound(
      "الرقم ده مش مسجل على المنصة. اتأكد من الرقم أو اعمل حساب جديد.",
      "PHONE_NOT_REGISTERED",
    );
  }

  if (!isWhatsappReady()) {
    throw new ApiError(
      503,
      "خدمة واتساب مش متصلة دلوقتي، حاول تاني بعد شوية.",
      { code: "WHATSAPP_NOT_CONNECTED" },
    );
  }

  const now = new Date();
  const current = await PasswordReset.findOne({ userId: user._id }).select(
    "resendAvailableAt",
  );
  if (current && current.resendAvailableAt > now) {
    const seconds = Math.ceil(
      (current.resendAvailableAt.getTime() - now.getTime()) / 1000,
    );
    throw ApiError.tooManyRequests(
      `استنى ${seconds} ثانية قبل ما تطلب كود جديد.`,
      "PASSWORD_RESET_RESEND_COOLDOWN",
    );
  }

  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, env.BCRYPT_SALT_ROUNDS);
  await PasswordReset.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        codeHash,
        attempts: 0,
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_CODE_TTL_MS),
        resendAvailableAt: new Date(
          now.getTime() + PASSWORD_RESET_RESEND_COOLDOWN_MS,
        ),
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );

  const delivery = await sendWhatsappText(
    user.studentPhone,
    buildPasswordResetMessage(code),
  );
  if (!delivery.sent) {
    await PasswordReset.deleteOne({ userId: user._id });
    logger.warn("[auth] password reset code delivery failed", {
      reason: delivery.reason,
    });
    throw new ApiError(
      503,
      "تعذر إرسال الكود على واتساب. اتأكد إن الرقم عليه واتساب وحاول تاني.",
      { code: "PASSWORD_RESET_DELIVERY_FAILED" },
    );
  }

  return {
    expiresInSeconds: PASSWORD_RESET_CODE_TTL_MS / 1000,
    resendAfterSeconds: PASSWORD_RESET_RESEND_COOLDOWN_MS / 1000,
  };
}

/**
 * Checks a reset code; a wrong code counts against the code's few tries. The
 * try is taken atomically BEFORE comparing, so parallel guesses can't share
 * one count and get more than the few tries; a right code gives it back.
 */
async function checkPasswordResetCode(input: PasswordResetCheckInput) {
  const user = await User.findOne({ studentPhone: input.studentPhone }).select(
    "_id",
  );
  const reset = user
    ? await PasswordReset.findOneAndUpdate(
        {
          userId: user._id,
          expiresAt: { $gt: new Date() },
          attempts: { $lt: MAX_PASSWORD_RESET_ATTEMPTS },
        },
        { $inc: { attempts: 1 } },
        { new: true },
      ).select("+codeHash attempts")
    : null;

  const exceeded = () => {
    throw ApiError.tooManyRequests(
      "دخلت كود غلط مرات كتير. اطلب كود جديد.",
      "PASSWORD_RESET_ATTEMPTS_EXCEEDED",
    );
  };

  if (!user || !reset) {
    if (
      user &&
      (await PasswordReset.findOneAndDelete({
        userId: user._id,
        attempts: { $gte: MAX_PASSWORD_RESET_ATTEMPTS },
      }))
    ) {
      exceeded();
    }
    throw ApiError.forbidden(
      "الكود انتهت صلاحيته أو ماتطلبش. اطلب كود جديد.",
      "PASSWORD_RESET_NOT_FOUND_OR_EXPIRED",
    );
  }

  if (!(await bcrypt.compare(input.code, reset.codeHash))) {
    if (reset.attempts >= MAX_PASSWORD_RESET_ATTEMPTS) {
      await reset.deleteOne();
      exceeded();
    }
    throw ApiError.forbidden(
      "الكود غلط. اتأكد منه وحاول تاني.",
      "INVALID_PASSWORD_RESET_CODE",
    );
  }

  await PasswordReset.updateOne({ _id: reset._id }, { $inc: { attempts: -1 } });
  return { userId: user._id, resetId: reset._id };
}

/** Confirms the code is right so the wizard can ask for the new password. */
export async function verifyPasswordResetCode(
  input: PasswordResetCheckInput,
): Promise<void> {
  await checkPasswordResetCode(input);
}

/**
 * Sets the new password. The code is checked again and consumed first, so it
 * can't be replayed; then every session is revoked (anyone signed in with the
 * old password is out) and the student gets a WhatsApp confirmation.
 */
export async function resetStudentPassword(
  input: PasswordResetInput,
): Promise<void> {
  const { userId, resetId } = await checkPasswordResetCode(input);

  const consumed = await PasswordReset.deleteOne({ _id: resetId });
  if (consumed.deletedCount !== 1) {
    throw ApiError.forbidden(
      "الكود ده اتستخدم قبل كده. اطلب كود جديد.",
      "PASSWORD_RESET_ALREADY_USED",
    );
  }

  const passwordHash = await bcrypt.hash(
    input.newPassword,
    env.BCRYPT_SALT_ROUNDS,
  );
  await User.updateOne({ _id: userId }, { $set: { passwordHash } });
  await revokeAllUserSessions(userId, ROLES.STUDENT, "password_reset");

  // Best effort: the reset already succeeded if this message can't go out.
  void sendWhatsappText(
    input.studentPhone,
    buildPasswordChangedMessage(),
  ).catch((err: unknown) =>
    logger.warn("[auth] password changed notice not sent", {
      error: err instanceof Error ? err.message : err,
    }),
  );
}
