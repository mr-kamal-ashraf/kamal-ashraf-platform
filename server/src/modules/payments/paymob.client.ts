import axios from "axios";
import crypto from "crypto";
import { env } from "../../config/env";
import { PAYMENT_METHOD, type PaymentMethod } from "../../config/constants";
import { ApiError } from "../../shared/utils/ApiError";
import { logger } from "../../shared/utils/logger";

/**
 * Thin client for Paymob's classic "Accept" flow:
 *   auth token -> order -> payment key -> (card) iframe URL
 *                                      -> (wallet) pay request,
 * Paymob's Intention API for card fields embedded in our page (Pixel), plus
 * HMAC verification for the transaction callback (the same for every method
 * and both flows).
 *
 * All credentials are optional in env: a method is offered only when its own
 * integration id is set (see availablePaymentMethods). Each teacher's
 * deployment supplies its OWN Paymob credentials.
 */

/** Card fields inside our checkout (Pixel) instead of Paymob's iframe page. */
export function isEmbeddedCardEnabled(): boolean {
  return !!(env.PAYMOB_SECRET_KEY && env.PAYMOB_PUBLIC_KEY && env.PAYMOB_INTEGRATION_ID);
}

/** The integration id each method pays through (card also needs the iframe or Pixel). */
function integrationIdFor(method: PaymentMethod): string | undefined {
  if (method === PAYMENT_METHOD.CARD) {
    return env.PAYMOB_IFRAME_ID || isEmbeddedCardEnabled()
      ? env.PAYMOB_INTEGRATION_ID
      : undefined;
  }
  return env.PAYMOB_WALLET_INTEGRATION_ID;
}

/** The methods students can choose, in display order. */
export function availablePaymentMethods(): PaymentMethod[] {
  if (!env.PAYMOB_API_KEY || !env.PAYMOB_HMAC_SECRET) return [];
  return Object.values(PAYMENT_METHOD).filter((m) => !!integrationIdFor(m));
}

export function isPaymobConfigured(): boolean {
  return availablePaymentMethods().length > 0;
}

export function assertMethodAvailable(method: PaymentMethod): number {
  if (!isPaymobConfigured()) {
    // The student only sees "not available"; the fix is for the developer.
    logger.error(
      "Checkout refused: Paymob isn't configured — set PAYMOB_API_KEY, PAYMOB_HMAC_SECRET and an integration id per payment method",
    );
    throw new ApiError(
      503,
      "الدفع أونلاين مش متاح دلوقتي — حاول تاني بعد شوية.",
      { code: "PAYMOB_NOT_CONFIGURED", isOperational: true },
    );
  }
  const id = integrationIdFor(method);
  if (!id || !availablePaymentMethods().includes(method)) {
    throw ApiError.badRequest(
      "طريقة الدفع دي مش متاحة دلوقتي — اختار طريقة تانية.",
      "PAYMENT_METHOD_UNAVAILABLE",
    );
  }
  return Number(id);
}

const http = axios.create({ timeout: 20000 });

/** Step 1 — exchange the account API key for a short-lived auth token. */
export async function getAuthToken(method: PaymentMethod): Promise<string> {
  assertMethodAvailable(method);
  return fetchAuthToken();
}

async function fetchAuthToken(): Promise<string> {
  try {
    const { data } = await http.post(`${env.PAYMOB_BASE_URL}/auth/tokens`, {
      api_key: env.PAYMOB_API_KEY,
    });
    if (!data?.token) throw new Error("no token in Paymob auth response");
    return data.token as string;
  } catch (err) {
    logger.error("Paymob auth failed", {
      error: err instanceof Error ? err.message : err,
    });
    throw ApiError.internal("فشل الاتصال ببوابة الدفع. حاول تاني بعد شوية.");
  }
}

/**
 * Asks Paymob directly for an order's latest transaction — the safety net
 * for when the server-to-server callback is late or never arrives. The
 * answer comes from Paymob over our authenticated API call, so it needs no
 * HMAC. Looked up by Paymob's order id when we have it (both the classic and
 * the Intention flow create one), else by our merchant order id. Returns null
 * when the order has no transaction yet (or Paymob can't be reached — the
 * webhook may still settle it).
 */
export async function inquireTransaction(ids: {
  paymobOrderId?: string | null;
  merchantOrderId: string;
}): Promise<Record<string, unknown> | null> {
  if (!env.PAYMOB_API_KEY) return null;
  const { merchantOrderId } = ids;
  try {
    const authToken = await fetchAuthToken();
    const { data } = await http.post(
      `${env.PAYMOB_BASE_URL}/ecommerce/orders/transaction_inquiry`,
      ids.paymobOrderId
        ? { auth_token: authToken, order_id: Number(ids.paymobOrderId) }
        : { auth_token: authToken, merchant_order_id: merchantOrderId },
      { timeout: 8000 },
    );
    return data && typeof data === "object" && "id" in data
      ? (data as Record<string, unknown>)
      : null;
  } catch (err) {
    // 404 = no transaction on this order yet; anything else is logged.
    if (!(axios.isAxiosError(err) && err.response?.status === 404)) {
      logger.warn("Paymob transaction inquiry failed", {
        merchantOrderId,
        detail: payErrorDetail(err),
      });
    }
    return null;
  }
}

interface CreateOrderInput {
  authToken: string;
  amountCents: number;
  merchantOrderId: string;
  currency: string;
}

/** Step 2 — register the order with Paymob. Returns Paymob's numeric order id. */
export async function createOrder(input: CreateOrderInput): Promise<string> {
  try {
    const { data } = await http.post(`${env.PAYMOB_BASE_URL}/ecommerce/orders`, {
      auth_token: input.authToken,
      delivery_needed: false,
      amount_cents: input.amountCents,
      currency: input.currency,
      merchant_order_id: input.merchantOrderId,
      items: [],
    });
    if (!data?.id) throw new Error("no order id in Paymob order response");
    return String(data.id);
  } catch (err) {
    const detail =
      axios.isAxiosError(err) && err.response
        ? JSON.stringify(err.response.data)
        : err instanceof Error
          ? err.message
          : String(err);
    logger.error("Paymob create order failed", { detail });
    throw ApiError.internal("فشل إنشاء طلب الدفع. حاول تاني بعد شوية.");
  }
}

interface BillingData {
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
}

/** Paymob wants a full address block; a course purchase has none, so "NA". */
function fullBillingData(billing: BillingData) {
  return {
    first_name: billing.first_name || "NA",
    last_name: billing.last_name || "NA",
    phone_number: billing.phone_number || "NA",
    email: billing.email || "NA",
    apartment: "NA",
    floor: "NA",
    street: "NA",
    building: "NA",
    shipping_method: "NA",
    postal_code: "NA",
    city: "NA",
    country: "NA",
    state: "NA",
  };
}

interface PaymentKeyInput {
  method: PaymentMethod;
  authToken: string;
  amountCents: number;
  orderId: string;
  currency: string;
  billing: BillingData;
  /** How long the key stays valid. */
  expirationSeconds: number;
}

/** Step 3 — obtain the payment key token for the chosen method's integration. */
export async function getPaymentKey(input: PaymentKeyInput): Promise<string> {
  const integrationId = assertMethodAvailable(input.method);
  try {
    const { data } = await http.post(
      `${env.PAYMOB_BASE_URL}/acceptance/payment_keys`,
      {
        auth_token: input.authToken,
        amount_cents: input.amountCents,
        expiration: input.expirationSeconds,
        order_id: input.orderId,
        billing_data: fullBillingData(input.billing),
        currency: input.currency,
        integration_id: integrationId,
      },
    );
    if (!data?.token) throw new Error("no payment key token in Paymob response");
    return data.token as string;
  } catch (err) {
    const detail =
      axios.isAxiosError(err) && err.response
        ? JSON.stringify(err.response.data)
        : err instanceof Error
          ? err.message
          : String(err);
    logger.error("Paymob payment key failed", { detail });
    throw ApiError.internal("فشل تجهيز صفحة الدفع. حاول تاني بعد شوية.");
  }
}

/** Builds the hosted iframe URL the student is redirected to. */
export function buildIframeUrl(paymentToken: string): string {
  return `${env.PAYMOB_BASE_URL}/acceptance/iframes/${env.PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
}

interface CardIntentionInput {
  amountCents: number;
  currency: string;
  merchantOrderId: string;
  itemName: string;
  billing: BillingData;
  expirationSeconds: number;
  /** Where the student lands after the bank's 3-D Secure page. */
  redirectionUrl: string;
}

/**
 * Card fields embedded in our page: creates a Paymob payment intention for
 * the card integration. The browser gets only the public key + this
 * intention's client secret to render Paymob's card fields (Pixel); the
 * resulting transaction reports back through the same webhook, with our
 * merchant order id (special_reference) and Paymob's order id.
 */
export async function createCardIntention(
  input: CardIntentionInput,
): Promise<{ clientSecret: string; paymobOrderId: string }> {
  const integrationId = assertMethodAvailable(PAYMENT_METHOD.CARD);
  try {
    const { data } = await http.post(
      `${new URL(env.PAYMOB_BASE_URL).origin}/v1/intention/`,
      {
        amount: input.amountCents,
        currency: input.currency,
        payment_methods: [integrationId],
        items: [
          { name: input.itemName.slice(0, 50), amount: input.amountCents, quantity: 1 },
        ],
        billing_data: fullBillingData(input.billing),
        special_reference: input.merchantOrderId,
        expiration: input.expirationSeconds,
        redirection_url: input.redirectionUrl,
      },
      { headers: { Authorization: `Token ${env.PAYMOB_SECRET_KEY}` } },
    );
    if (!data?.client_secret || !data?.intention_order_id) {
      throw new Error("no client secret / order id in Paymob intention response");
    }
    return {
      clientSecret: String(data.client_secret),
      paymobOrderId: String(data.intention_order_id),
    };
  } catch (err) {
    logger.error("Paymob card intention failed", { detail: payErrorDetail(err) });
    throw ApiError.internal("فشل تجهيز الدفع بالكارت. حاول تاني بعد شوية.");
  }
}

/** The account's public key — safe for the browser, pairs with a client secret. */
export function paymobPublicKey(): string {
  return env.PAYMOB_PUBLIC_KEY ?? "";
}

/** Step 4 for wallets — Paymob's pay request with a payment source. */
async function pay(
  source: { identifier: string; subtype: "WALLET" },
  paymentToken: string,
): Promise<Record<string, unknown>> {
  const { data } = await http.post(`${env.PAYMOB_BASE_URL}/acceptance/payments/pay`, {
    source,
    payment_token: paymentToken,
  });
  return (data ?? {}) as Record<string, unknown>;
}

function payErrorDetail(err: unknown): string {
  return axios.isAxiosError(err) && err.response
    ? JSON.stringify(err.response.data)
    : err instanceof Error
      ? err.message
      : String(err);
}

/**
 * Wallet: Paymob answers with a page on the wallet provider where the student
 * confirms with their wallet PIN / OTP; we send them there.
 */
export async function payWithWallet(
  paymentToken: string,
  walletPhone: string,
): Promise<{ redirectUrl: string; transactionId: string | null }> {
  try {
    const data = await pay({ identifier: walletPhone, subtype: "WALLET" }, paymentToken);
    const redirectUrl = (data.redirect_url || data.iframe_redirection_url) as string | undefined;
    if (!redirectUrl) throw new Error(`no redirect url in wallet response: ${JSON.stringify(data)}`);
    return { redirectUrl, transactionId: data.id !== undefined ? String(data.id) : null };
  } catch (err) {
    logger.error("Paymob wallet pay failed", { detail: payErrorDetail(err) });
    throw ApiError.badRequest(
      "تعذر بدء الدفع بالمحفظة. اتأكد إن الرقم عليه محفظة (فودافون كاش أو غيرها) وحاول تاني.",
      "WALLET_PAY_FAILED",
    );
  }
}

/**
 * The fixed field order Paymob concatenates before HMAC-signing a transaction
 * callback. Must be kept EXACTLY in this order.
 */
const HMAC_ORDER = [
  "amount_cents",
  "created_at",
  "currency",
  "error_occured",
  "has_parent_transaction",
  "id",
  "integration_id",
  "is_3d_secure",
  "is_auth",
  "is_capture",
  "is_refunded",
  "is_standalone_payment",
  "is_voided",
  "order",
  "owner",
  "pending",
  "source_data.pan",
  "source_data.sub_type",
  "source_data.type",
  "success",
] as const;

function readPath(obj: Record<string, unknown>, key: string): unknown {
  if (key === "order") {
    const order = obj.order as Record<string, unknown> | undefined;
    return order?.id;
  }
  if (key.startsWith("source_data.")) {
    const sd = obj.source_data as Record<string, unknown> | undefined;
    return sd?.[key.slice("source_data.".length)];
  }
  return obj[key];
}

/**
 * Verifies a Paymob transaction callback HMAC.
 * `obj` is the transaction object (req.body.obj); `received` is the hmac
 * Paymob sent (query ?hmac= or body.hmac). Uses a timing-safe comparison.
 */
export function verifyHmac(
  obj: Record<string, unknown>,
  received: string | undefined,
): boolean {
  if (!received || !env.PAYMOB_HMAC_SECRET) return false;
  const concatenated = HMAC_ORDER.map((key) => {
    const val = readPath(obj, key);
    if (val === null || val === undefined) return "";
    if (typeof val === "boolean") return val ? "true" : "false";
    return String(val);
  }).join("");

  const computed = crypto
    .createHmac("sha512", env.PAYMOB_HMAC_SECRET)
    .update(concatenated)
    .digest("hex");

  try {
    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(String(received), "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
