import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";

/**
 * One message in a student⟷AI chat thread.
 *
 * IMPORTANT: this collection is owned by n8n (WF6's "Build User/Assistant
 * Message Doc" + "Save ... Message" Mongo nodes write every row directly,
 * bypassing this backend entirely). This model exists ONLY so the Express
 * API can READ and DELETE rows for the student-facing history/clear
 * endpoints — it never INSERTS through this model, so the field list here
 * must keep matching whatever WF6 actually writes, not the other way round.
 *
 * Collection name is forced to "chatMessages" (n8n's raw Mongo-node name,
 * not pluralized/camel-cased the way Mongoose would default it from the
 * model name).
 */
export interface IChatMessage {
  conversationId: string;
  participantType: string;       // "student" today; n8n owns the value set
  participantId: string;         // the student's User _id, as a string
  teacherId: string;             // env.PLATFORM_TEACHER_ID slug
  role: "user" | "assistant";
  content: string;
  intent?: string;
  wasBlocked: boolean;
  createdAt: Date;               // n8n writes an ISO string; Mongoose casts both ways
}

export type ChatMessageDocument = HydratedDocument<IChatMessage>;

const chatMessageSchema = new Schema<IChatMessage>(
  {
    conversationId: { type: String, required: true, index: true },
    participantType: { type: String, default: "student" },
    participantId: { type: String, required: true, index: true },
    teacherId: { type: String, default: "" },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, default: "" },
    intent: { type: String },
    wasBlocked: { type: Boolean, default: false },
    createdAt: { type: Date, required: true },
  },
  {
    // n8n manages createdAt itself; this model never writes rows, so there's
    // no updatedAt to maintain either.
    timestamps: false,
    // Rows come from n8n's own Set nodes, which could grow a field this
    // schema doesn't know about yet — don't drop that data on read.
    strict: false,
  },
);

chatMessageSchema.index({ participantId: 1, conversationId: 1, createdAt: 1 });

export const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage ||
  mongoose.model<IChatMessage>("ChatMessage", chatMessageSchema, "chatMessages");
