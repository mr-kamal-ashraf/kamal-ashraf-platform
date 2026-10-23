import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";

/** Color palettes the frontend ships (see client/src/styles.css). */
export const PALETTES = ["green", "burgundy"] as const;
export type Palette = (typeof PALETTES)[number];

/** Image slots that can be replaced per palette. */
export const ASSET_SLOTS = ["logo", "logoDark", "hero"] as const;
export type AssetSlot = (typeof ASSET_SLOTS)[number];

/** Platform fonts the frontend ships (see client/src/config/fonts.ts). */
export const FONTS = [
  "cairo",
  "tajawal",
  "almarai",
  "ibm-plex",
  "noto-kufi",
  "readex",
  "alexandria",
  "vazirmatn",
  "rubik",
  "beiruti",
  "zain",
  "mada",
  "baloo",
  "marhey",
  "lemonada",
  "playpen",
  "changa",
  "kufam",
  "el-messiri",
  "reem-kufi",
] as const;
export type FontKey = (typeof FONTS)[number];

/** Content sections the teacher can edit from the admin panel. */
export const SETTINGS_SECTIONS = [
  "theme",
  "typography",
  "hero",
  "whyUs",
  "faq",
  "contact",
  "announcement",
  "welcome",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/**
 * The platform's appearance & content settings, edited by the teacher from the
 * admin panel ("المظهر والمحتوى"). There is exactly one document (key "main").
 *
 * Every section stores OVERRIDES only: a section left `null` means "use the
 * defaults built into the frontend", so an empty collection renders the site
 * exactly as it ships. Section shapes are validated with Zod at the API edge
 * (site-settings.validation.ts), which is why they're stored as Mixed here.
 */
export interface ISiteSettings {
  key: string;
  theme: Record<string, unknown> | null;
  typography: Record<string, unknown> | null;
  hero: Record<string, unknown> | null;
  whyUs: Record<string, unknown> | null;
  faq: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  announcement: Record<string, unknown> | null;
  /** The popup a student sees when a course opens for them. */
  welcome: Record<string, unknown> | null;
  /** Uploaded image URLs per palette; a missing/null slot falls back to the shipped image. */
  assets: Partial<Record<Palette, Partial<Record<AssetSlot, string | null>>>>;
  favicon: string | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SiteSettingsDocument = HydratedDocument<ISiteSettings>;

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    theme: { type: Schema.Types.Mixed, default: null },
    typography: { type: Schema.Types.Mixed, default: null },
    hero: { type: Schema.Types.Mixed, default: null },
    whyUs: { type: Schema.Types.Mixed, default: null },
    faq: { type: Schema.Types.Mixed, default: null },
    contact: { type: Schema.Types.Mixed, default: null },
    announcement: { type: Schema.Types.Mixed, default: null },
    welcome: { type: Schema.Types.Mixed, default: null },
    assets: { type: Schema.Types.Mixed, default: {} },
    favicon: { type: String, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  {
    timestamps: true,
    minimize: false,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret._id;
        delete ret.__v;
        delete ret.key;
        delete ret.updatedBy;
        delete ret.createdAt;
        return ret;
      },
    },
  }
);

export const SiteSettings: Model<ISiteSettings> =
  mongoose.models.SiteSettings ||
  mongoose.model<ISiteSettings>("SiteSettings", siteSettingsSchema);
