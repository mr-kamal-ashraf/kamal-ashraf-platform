import { SITE } from "@/shared/i18n/site";
import { AuthBrandPanel } from "../../components/AuthBrandPanel";

export function RegisterBrandSide() {
  return (
    <AuthBrandPanel
      title="نوّرت المنصة!"
      subtitle={`اعمل حسابك في دقايق وابدأ رحلتك معانا مع ${SITE.teacherName} 🤍`}
    />
  );
}
