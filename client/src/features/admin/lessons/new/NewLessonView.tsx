"use client";

import { AnimatePresence, motion } from "framer-motion";
import { StepProgress } from "@/features/admin/shared/StepProgress";
import { NewLessonProvider, useNewLesson } from "./NewLessonProvider";
import { NewLessonActions } from "./sections/NewLessonActions";
import { NewLessonBasicFields } from "./sections/NewLessonBasicFields";
import { NewLessonHeader } from "./sections/NewLessonHeader";
import { NewLessonStatusBanner } from "./sections/NewLessonStatusBanner";
import { NewLessonThumbnail } from "./sections/NewLessonThumbnail";
import { NewLessonVideo } from "./sections/NewLessonVideo";

function NewLessonContent() {
  const { wizardStep, steps, onSubmit, formRef } = useNewLesson();

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <NewLessonHeader />
      <StepProgress step={wizardStep} steps={steps} />
      <NewLessonStatusBanner />
      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        className="space-y-6 rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6"
      >
        <div className="min-h-[240px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={wizardStep}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {wizardStep === 0 && <NewLessonBasicFields group="course" />}
              {wizardStep === 1 && <NewLessonBasicFields group="details" />}
              {wizardStep === 2 && <NewLessonVideo />}
              {wizardStep === 3 && <NewLessonThumbnail />}
            </motion.div>
          </AnimatePresence>
        </div>
        <NewLessonActions />
      </form>
    </div>
  );
}

export function NewLessonView() {
  return (
    <NewLessonProvider>
      <NewLessonContent />
    </NewLessonProvider>
  );
}
