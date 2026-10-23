"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Keeps one broken settings panel from taking the whole page down: the
 * teacher sees a short message with a retry button, the other tabs keep
 * working, and the real error goes to the console for the developer.
 */
export class PanelBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean; detail: string }
> {
  state = { failed: false, detail: "" };

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, detail: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[appearance] panel "${this.props.name}" crashed`, error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="text-sm font-bold text-destructive">حصلت مشكلة في عرض القسم ده.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          جرّب تاني، ولو المشكلة فضلت موجودة كلّم المطوّر. باقي الأقسام شغالة عادي.
        </p>
        <button
          type="button"
          onClick={() => this.setState({ failed: false, detail: "" })}
          className="mt-3 min-h-10 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground"
        >
          حاول تاني
        </button>
        <details className="mt-3 text-start text-[11px] text-muted-foreground">
          <summary className="cursor-pointer">تفاصيل للمطوّر</summary>
          <code className="mt-1 block break-all" dir="ltr">
            {this.props.name}: {this.state.detail}
          </code>
        </details>
      </div>
    );
  }
}
