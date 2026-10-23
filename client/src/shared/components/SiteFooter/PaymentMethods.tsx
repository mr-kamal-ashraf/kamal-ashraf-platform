import Image from "next/image";

// White chips in both themes: brand marks are drawn for light backgrounds.
const CHIP =
  "flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 shadow-sm";
const CHIP_TEXT = "text-[11px] font-extrabold text-neutral-700";

/**
 * The ways students can pay (all through Paymob): cards (Visa, Mastercard)
 * and mobile wallets (Vodafone Cash and the rest). The card marks are the
 * public-domain files in /assets/payments; wallets get a plain icon + name.
 */
export function PaymentMethods() {
  return (
    <div className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-6 py-4 sm:flex-row sm:justify-between sm:px-10">
        <p className="text-xs font-bold text-muted-foreground">
          طرق الدفع المتاحة
        </p>
        <ul
          aria-label="طرق الدفع المتاحة"
          className="flex flex-wrap items-center justify-center gap-2"
        >
          <li className={CHIP}>
            <Image
              src="/assets/payments/visa.svg"
              alt="Visa"
              width={43}
              height={14}
              unoptimized
            />
          </li>
          <li className={CHIP}>
            <Image
              src="/assets/payments/mastercard.svg"
              alt="Mastercard"
              width={32}
              height={20}
              unoptimized
            />
          </li>
          <li className={CHIP}>
            <svg
              className="size-4 text-neutral-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v3h-4a2 2 0 0 0 0 4h4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" />
            </svg>
            <span className={CHIP_TEXT}>محافظ إلكترونية</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
