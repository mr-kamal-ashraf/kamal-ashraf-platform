/**
 * DEPRECATED — this file only remains as a compatibility shim.
 *
 * The old standalone URL-based upload form has been superseded by
 * `CurriculumManagementView`, which handles upload + list + delete in one
 * page and speaks the current file-based API (`aiApi.uploadCurriculum`
 * expects a `File`, not a `file_url` string). The admin route
 * `/admin/ai/curriculum` already renders `CurriculumManagementView` directly
 * (see `app/admin/(panel)/ai/curriculum/page.tsx` and the nav config in
 * `features/admin/shell/config/nav.ts`).
 *
 * Nothing in the codebase imports this component today, but re-exporting the
 * new one under the old name keeps any stray import from breaking. Safe to
 * delete this file entirely once you're sure nothing external depends on it.
 */
export { CurriculumManagementView as CurriculumUploadView } from "./CurriculumManagementView";
