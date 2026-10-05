"use client";

import { useState, type ReactNode } from "react";
import { newsCategories, type NewsCategory, type NewsPost } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { Dropdown, type DropdownOption } from "./dropdown";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";

type Values = Pick<NewsPost, "title" | "category" | "date" | "excerpt" | "body" | "featured">;

/** The categories under the page each is shown on. */
const categoryOptions: DropdownOption[] = Object.entries(newsCategories).map(([value, label]) => ({ value, label, group: value === "explainer" ? "Election Explainer page" : "News page" }));

export function NewsForm({ action, initial, submitLabel, danger }: { action: (state: FormState, formData: FormData) => Promise<FormState>; initial: Values; submitLabel: string; danger?: ReactNode }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const [category, setCategory] = useState<NewsCategory>(initial.category);
  // Explainers are guides on their own page, which has no featured post.
  const isExplainer = category === "explainer";

  return (
    <form className="portal-form" onSubmit={onSubmit} noValidate>
      <div className="portal-form-grid">
        <Field label="Title" error={errors.title} wide>
          <input name="title" defaultValue={initial.title} maxLength={160} required />
        </Field>
        <Field label="Category" hint="Press releases, announcements and publications are shown on the News page. An explainer is shown on the Election Explainer page instead." error={errors.category}>
          <Dropdown name="category" value={category} onChange={(next) => setCategory(next as NewsCategory)} options={categoryOptions} />
        </Field>
        <Field label="Publish date" error={errors.date}>
          <input name="date" type="date" defaultValue={initial.date} required />
        </Field>
        <Field label="Summary" hint="Shown under the title in the list, and at the top of the post. One or two sentences." error={errors.excerpt} wide>
          <textarea name="excerpt" rows={3} defaultValue={initial.excerpt} maxLength={300} required />
        </Field>
        <Field label={isExplainer ? "Full guide" : "Full article"} hint="Separate paragraphs with a blank line." error={errors.body} wide>
          <textarea name="body" rows={12} defaultValue={initial.body} />
        </Field>
        {!isExplainer && (
          <label className="portal-check is-wide">
            <input name="featured" type="checkbox" defaultChecked={initial.featured} />
            <span><strong>Feature this post<InfoTip>Sets it apart at the top of the News page, and shows it first in the website menu’s Featured cards. Only one post can be featured.</InfoTip></strong></span>
          </label>
        )}
      </div>
      <FormFooter state={state} pending={pending} submitLabel={submitLabel} cancelHref="/portal/news" danger={danger} />
    </form>
  );
}
