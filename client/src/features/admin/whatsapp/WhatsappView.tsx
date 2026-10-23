"use client";

import { WhatsappProvider } from "./WhatsappProvider";
import { WhatsappHeader } from "./sections/WhatsappHeader";
import { WhatsappStatusCard } from "./sections/WhatsappStatusCard";
import { WhatsappAiRepliesCard } from "./sections/WhatsappAiRepliesCard";
import { WhatsappTestCard } from "./sections/WhatsappTestCard";
import { WhatsappQrCard } from "./sections/WhatsappQrCard";

export function WhatsappView() {
  return (
    <WhatsappProvider>
      <div className="space-y-5 sm:space-y-6">
        <WhatsappHeader />
        <WhatsappStatusCard />
        <WhatsappAiRepliesCard />
        <WhatsappTestCard />
        <WhatsappQrCard />
      </div>
    </WhatsappProvider>
  );
}
