"use client";

import { newsCategories, type NewsPost } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";

type Values = Pick<NewsPost, "title" | "category" | "date" | "excerpt" | "body" | "featured">;

export function NewsForm({ action, initial, submitLabel }: { action: (state: FormState, formData: FormData) => Promise<FormState>; initial: Values; submitLabel: string }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Title" error={errors.title} wide>
          <input name="title" defaultValue={initial.title} maxLength={160} required />
        </Field>
        <Field label="Category" error={errors.category}>
          <select name="category" defaultValue={initial.category}>
            {Object.entries(newsCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
        <Field label="Publish date" error={errors.date}>
          <input name="date" type="date" defaultValue={initial.date} required />
        </Field>
        <Field label="Summary" hint="Shown on the news card. One or two sentences." error={errors.excerpt} wide>
          <textarea name="excerpt" rows={3} defaultValue={initial.excerpt} maxLength={300} required />
        </Field>
        <Field label="Full article" hint="Separate paragraphs with a blank line." error={errors.body} wide>
          <textarea name="body" rows={12} defaultValue={initial.body} />
        </Field>
        <label className="portal-check is-wide">
          <input name="featured" type="checkbox" defaultChecked={initial.featured} />
          <span><strong>Feature this post<InfoTip>Shows it as the large lead story on the News page. Only one post can be featured.</InfoTip></strong></span>
        </label>
      </div>
      <FormFooter state={state} pending={pending} submitLabel={submitLabel} cancelHref="/portal/news" />
    </form>
  );
}
