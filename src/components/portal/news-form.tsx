"use client";

import { useState, type ReactNode } from "react";
import { newsCategories, type NewsCategory, type NewsPost } from "@/lib/data/types";
import type { FormState } from "@/lib/portal/form";
import { Dropdown, type DropdownOption } from "./dropdown";
import { InfoTip } from "./info-tip";
import { Field, FormFooter, usePortalForm } from "./portal-form";
import { DocumentBodyField } from "./document-body-field";
import { DatePicker } from "./date-picker";

type Values = Pick<NewsPost, "title" | "category" | "date" | "excerpt" | "body" | "featured">;

/** The categories under the page each is shown on. */
const categoryOptions: DropdownOption[] = Object.entries(newsCategories).map(([value, label]) => ({ value, label, group: value === "explainer" ? "Election Explainer page" : "News page" }));

export function NewsForm({ action, initial, submitLabel, danger }: { action: (state: FormState, formData: FormData) => Promise<FormState>; initial: Values; submitLabel: string; danger?: ReactNode }) {
  const { state, pending, onSubmit, errors } = usePortalForm(action);
  const [category, setCategory] = useState<NewsCategory>(initial.category);
  const [summary, setSummary] = useState(initial.excerpt);
  const [body, setBody] = useState(initial.body);
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
          <DatePicker name="date" defaultValue={initial.date} invalid={Boolean(errors.date)} required />
        </Field>
        <div className={`portal-field is-wide${errors.excerpt ? " has-error" : ""}`}>
          <span className="portal-field-label">Summary<InfoTip>Shown under the title in lists and at the top of the post. Keep the text under 300 characters.</InfoTip></span>
          <DocumentBodyField name="excerpt" value={summary} onChange={setSummary} invalid={Boolean(errors.excerpt)} label="Summary editor" windowTitle="Edit summary" />
          {errors.excerpt && <span className="portal-field-error">{errors.excerpt}</span>}
        </div>
        <div className={`portal-field is-wide${errors.body ? " has-error" : ""}`}>
          <span className="portal-field-label">{isExplainer ? "Full guide" : "Full article"}<InfoTip>Format text, add links and lists, or insert tables with the Documents editor.</InfoTip></span>
          <DocumentBodyField value={body} onChange={setBody} invalid={Boolean(errors.body)} label={isExplainer ? "Guide editor" : "Article editor"} windowTitle={isExplainer ? "Edit guide" : "Edit article"} />
          {errors.body && <span className="portal-field-error">{errors.body}</span>}
        </div>
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
