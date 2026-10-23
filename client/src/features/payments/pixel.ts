/**
 * Paymob Pixel — Paymob's card fields rendered inside our own checkout. The
 * fields live in Paymob's secure frame, so card details never touch our page
 * or server. The SDK is ~1MB, so it's fetched only when a student actually
 * pays by card, pinned to an exact version and integrity-checked. It's served
 * from our own site (public/vendor — the npm package's main.js, unchanged),
 * not a CDN; only Paymob's secure card frame itself comes from Paymob.
 * Upgrading = replace the file, rename it with the new version, update both
 * lines below.
 */
const PIXEL_SRC = "/vendor/paymob-pixel-1.2.9.js";
const PIXEL_INTEGRITY =
  "sha384-xnq75vsvc/LrukeE02DnxkObMpdOVTEf5V9DfolAgepYSYasG7ElcO7tSwntlOqq";

/** What Paymob answers a card payment with (when no 3-D Secure redirect is needed). */
export interface PixelPayResponse {
  status?: number;
  data?: Record<string, unknown> | unknown[];
}

interface PixelOptions {
  publicKey: string;
  clientSecret: string;
  paymentMethods: string[];
  elementId: string;
  disablePay?: boolean;
  showSaveCard?: boolean;
  showPaymobLogo?: boolean;
  cardValidationChanged?: (isValid: boolean) => void;
  afterPaymentComplete?: (response: PixelPayResponse) => void;
  customStyle?: Record<string, unknown>;
}

interface PixelInstance {
  _root?: { unmount(): void } | null;
  render?: () => void;
}

interface PixelClass {
  new (options: PixelOptions): PixelInstance;
  _instances?: Record<string, unknown>;
}

declare global {
  interface Window {
    Pixel?: PixelClass;
  }
}

let loading: Promise<PixelClass> | null = null;

/** Loads the SDK once; safe to call early (e.g. while checkout is starting). */
export function loadPixel(): Promise<PixelClass> {
  if (window.Pixel) return Promise.resolve(window.Pixel);
  loading ??= new Promise<PixelClass>((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.src = PIXEL_SRC;
    script.integrity = PIXEL_INTEGRITY;
    script.crossOrigin = "anonymous";
    const fail = () => {
      script.remove();
      loading = null;
      reject(new Error("Paymob Pixel failed to load"));
    };
    script.onload = () => (window.Pixel ? resolve(window.Pixel) : fail());
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}

let mounted = 0;

/**
 * Renders the card fields into `container`; returns the cleanup. Each mount
 * gets a fresh host element, since Pixel claims its element for good.
 */
export function mountPixel(
  Pixel: PixelClass,
  container: HTMLElement,
  options: Omit<PixelOptions, "elementId">,
): () => void {
  const host = document.createElement("div");
  host.id = `paymob-pixel-${++mounted}`;
  container.appendChild(host);
  const instance = new Pixel({ ...options, elementId: host.id });
  return () => {
    // Pixel has no destroy(): unmounting its React root also drops its
    // window listeners (payFromOutside), so a closed checkout can't pay.
    // Its data request may still be in flight and render once more when it
    // lands — into a host that's gone ("Container with ID … not found"), so
    // that render is switched off first. Relies on the pinned version above.
    instance.render = () => undefined;
    try {
      instance._root?.unmount();
    } catch {
      /* already gone */
    }
    delete Pixel._instances?.[host.id];
    host.remove();
  };
}

/** Starts the payment with our own button (Pixel's is hidden by disablePay). */
export function submitPixelPayment(): void {
  window.dispatchEvent(new Event("payFromOutside"));
}

let probe: CanvasRenderingContext2D | null | undefined;

/** A theme token as #rrggbb — the frame takes plain colors, not oklch(). */
function tokenHex(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (probe === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    probe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!value || !probe) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = fallback;
  probe.fillStyle = value; // an unparseable value leaves the fallback
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** The card fields dressed in the platform's current palette (light or dark), in Arabic. */
export function pixelStyle(): Record<string, unknown> {
  const foreground = tokenHex("--foreground", "#1f2937");
  return {
    Direction: "rtl",
    HideCardLabel: true,
    Font_Family: getComputedStyle(document.body).fontFamily,
    Font_Size_Label: "14",
    Font_Size_Input_Fields: "16",
    Font_Weight_Label: 700,
    Font_Weight_Input_Fields: 600,
    Color_Container: tokenHex("--card", "#ffffff"),
    Color_Input_Fields: tokenHex("--background", "#ffffff"),
    Color_Border_Input_Fields: tokenHex("--border", "#e5e7eb"),
    Color_Primary: tokenHex("--primary", "#1d4ed8"),
    Color_Error: tokenHex("--destructive", "#dc2626"),
    Color_Disabled: tokenHex("--muted", "#f3f4f6"),
    Text_Color_For_Label: foreground,
    Text_Color_For_Input_Fields: foreground,
    Color_For_Text_Placeholder: tokenHex("--muted-foreground", "#6b7280"),
    Radius_Border: "12",
    Width_of_Container: "100%",
    Container_Padding: "0",
    // (Vertical_Padding is the padding INSIDE each field — left at Pixel's default.)
    Vertical_Spacing_between_components: "12",
    Label_Text: {
      cardLabel: "بيانات الكارت",
    },
    Placeholder_Text: {
      holderName: "الاسم المكتوب على الكارت",
      cardNumber: "رقم الكارت",
      expiryDate: "شهر / سنة",
      securityCode: "CVV",
    },
    Error_Text: {
      cardNumber: {
        required: "اكتب رقم الكارت",
        invalid: "رقم الكارت مش صحيح",
      },
      expiryDate: {
        required: "اكتب تاريخ الانتهاء",
        invalid: "تاريخ الانتهاء مش صحيح",
      },
      securityCode: "اكتب الـ CVV (٣ أرقام ورا الكارت)",
      holderName: "اكتب الاسم المكتوب على الكارت",
    },
    Hint_Text: {
      cvvModalTitle: "الـ CVV",
      cvvVisaMastercardQuestion: "كارت فيزا أو ماستركارد؟",
      cvvVisaMastercardHint: "٣ أرقام مكتوبة ورا الكارت جنب التوقيع.",
      cvvAmexQuestion: "كارت أمريكان إكسبريس؟",
      cvvAmexHint: "٤ أرقام مكتوبة قدّام الكارت فوق الرقم.",
    },
  };
}
