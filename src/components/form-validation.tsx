"use client";

import { useEffect } from "react";
import { isMobileNumberField, isStudentNumberField } from "@/lib/forms/input";
import { scrollToElement } from "@/lib/scroll";
import "./form-validation.css";

// Every form's check before it's sent, on the site and in the portal: a required field left empty
// (or one filled in the wrong format) gets a red edge, and the first gets a tooltip saying what to
// do, in place of the browser's own bubble. It runs when a form is submitted, when a step's own check
// asks the browser (reportValidity), and when a multi-step form's Next calls `reportMissing`.
//
// It reads the page as it is: a field counts when it's on screen and enabled. The portal's pickers
// (Dropdown, Combobox, DatePicker) send their value in a hidden input, which carries `data-required`
// when the picker is required; the red edge and the tooltip go on the picker's button.

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Problem = { control: Control; anchor: HTMLElement; message: string };

const isControl = (element: unknown): element is Control => element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement;
const onScreen = (element: HTMLElement) => element.getClientRects().length > 0 && !element.closest("[inert]");

/** What the field is called, as its label shows it. */
function labelOf(control: Control, anchor: HTMLElement): string {
  const direct = anchor.getAttribute("aria-label") ?? control.getAttribute("aria-label");
  const ids = anchor.getAttribute("aria-labelledby") ?? control.getAttribute("aria-labelledby");
  const named = ids?.split(/\s+/).map((id) => document.getElementById(id)).find((element) => element && !anchor.contains(element));
  // A field's wrapper, on forms whose label is a span beside the control rather than a <label>.
  const wrapped = anchor.closest(".apply-field, .portal-field, .ev-field, .pp-field")?.querySelector("[class*='field-label']");
  const label = named ?? (control.type !== "hidden" ? control.labels?.[0] : undefined) ?? wrapped ?? anchor.closest("label") ?? anchor.closest("fieldset")?.querySelector("legend");
  let text = direct ?? "";
  if (!text && label) {
    const copy = label.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("input, select, textarea, button, svg, small, [aria-hidden='true'], [role='tooltip'], .portal-field-error").forEach((node) => node.remove());
    text = copy.textContent ?? "";
  }
  text = text.replace(/\s+/g, " ").replace(/\s*\*$/, "").replace(/\s*\((?:optional|required)\)$/i, "").trim();
  return text.length > 0 && text.length <= 60 ? text : "";
}

/** What a field needs, in a few words. */
function messageFor(control: Control, anchor: HTMLElement): string {
  const label = labelOf(control, anchor);
  const name = control.name;
  const empty = control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio") ? false : !control.value.trim();
  if (control instanceof HTMLInputElement && control.type === "checkbox") return "Tick this box to continue.";
  if (control instanceof HTMLInputElement && control.type === "radio") return label ? `Choose an answer for ${label}.` : "Choose one of the options.";
  if (control instanceof HTMLSelectElement || control.type === "hidden") return empty ? (label ? `Choose ${label}.` : "Choose an option.") : "Choose a valid option.";
  if (empty) return label ? `Fill in ${label}.` : "Fill in this field.";
  // A field that says what's wrong with it (the form builder's answers, setCustomValidity).
  if (control.validity.customError && control.validationMessage) return control.validationMessage;
  if (isStudentNumberField(name)) return "Use the 10-digit student number, numbers only.";
  if (isMobileNumberField(name)) return "Use an 11-digit mobile number starting with 09, numbers only.";
  if (control instanceof HTMLInputElement && control.type === "email") return "Enter a valid email address, like name@example.com.";
  if (control instanceof HTMLInputElement && control.type === "url") return "Enter a full web address, starting with https://";
  return control.title || control.validationMessage || "Check this field.";
}

/** Where a problem is shown: the field, a picker's button, or a tick box's whole label. */
function anchorOf(control: Control): HTMLElement {
  if (control.type === "hidden") return control.parentElement?.querySelector<HTMLElement>(":scope > [role='combobox'], :scope > button, :scope > input:not([type='hidden'])") ?? control.parentElement ?? control;
  if (control instanceof HTMLInputElement && control.type === "radio") return control.closest<HTMLElement>("[role='radiogroup'], fieldset") ?? control.closest("label") ?? control;
  if (control instanceof HTMLInputElement && control.type === "checkbox") return control.closest("label") ?? control;
  return control;
}

/** Whether a control needs fixing, without the browser's own bubble. */
function needsFixing(control: Control): boolean {
  if (control.disabled || control.closest("fieldset:disabled")) return false;
  // A picker inside another (a date picker in a date-and-time picker) has no name of its own.
  if (control.type === "hidden") return control.dataset.required === "true" && Boolean(control.name) && !control.value.trim();
  if (!control.willValidate) return false;
  if (!control.validity.valid) return true;
  // Spaces alone don't fill a required field.
  return control.required && !(control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) && !control.value.trim();
}

/** The fields in `scope` that need fixing, on screen, in page order; one per group of radio buttons. */
function findProblems(scope: ParentNode): Problem[] {
  const problems: Problem[] = [];
  const groups = new Set<string>();
  for (const control of scope.querySelectorAll<Control>("input, select, textarea")) {
    if (!needsFixing(control)) continue;
    const anchor = anchorOf(control);
    // A picker waiting on another (a program before its college) isn't asked for yet.
    if (!onScreen(anchor) || anchor.matches(":disabled")) continue;
    if (control instanceof HTMLInputElement && control.type === "radio") {
      const group = `${control.form?.id ?? ""}:${control.name}`;
      if (groups.has(group)) continue;
      groups.add(group);
    }
    problems.push({ control, anchor, message: messageFor(control, anchor) });
  }
  return problems;
}

/* The tooltip: one for the page, in the top layer so it shows over dialogs too. */

const ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';
const marked = new Set<Problem>();
let tip: HTMLDivElement | null = null;
let shown: Problem | null = null;
let frame = 0;

function tipElement() {
  if (tip?.isConnected) return tip;
  tip = document.createElement("div");
  tip.className = "field-tip";
  tip.setAttribute("role", "alert");
  if ("popover" in tip) tip.popover = "manual";
  tip.innerHTML = `${ICON}<span></span>`;
  document.body.append(tip);
  return tip;
}

function place() {
  if (!shown || !tip) return;
  const box = shown.anchor.getBoundingClientRect();
  if (!box.width && !box.height) return hideTip();
  const width = tip.offsetWidth;
  const height = tip.offsetHeight;
  const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8));
  const below = box.bottom + 10 + height <= window.innerHeight - 8 || box.top - 10 - height < 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${below ? box.bottom + 10 : box.top - 10 - height}px`;
  tip.dataset.side = below ? "below" : "above";
  // The arrow points at the field: near its start, or its middle when it's narrow.
  tip.style.setProperty("--tip-arrow", `${Math.max(12, Math.min(box.left - left + Math.min(24, box.width / 2), width - 16))}px`);
}

const follow = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(place);
};

function showTip(problem: Problem) {
  const element = tipElement();
  element.querySelector("span")!.textContent = problem.message;
  shown = problem;
  if (typeof element.showPopover === "function") {
    // Opened again, so it's on top of any dialog opened since.
    if (element.matches(":popover-open")) element.hidePopover();
    element.showPopover();
  } else {
    element.dataset.open = "true";
  }
  place();
  element.classList.remove("is-in");
  void element.offsetWidth;
  element.classList.add("is-in");
}

function hideTip() {
  shown = null;
  if (!tip) return;
  tip.classList.remove("is-in");
  delete tip.dataset.open;
  try { tip.hidePopover?.(); } catch { /* Not open. */ }
}

function unmark(problem: Problem) {
  problem.anchor.removeAttribute("data-field-problem");
  marked.delete(problem);
  if (shown === problem) hideTip();
}

/** Marks every problem, and points the tooltip at the first one, focusing and scrolling to it. */
function report(problems: Problem[]) {
  for (const problem of [...marked]) if (problems.every((next) => next.anchor !== problem.anchor)) unmark(problem);
  for (const problem of problems) {
    problem.anchor.setAttribute("data-field-problem", "");
    marked.add(problem);
  }
  const first = problems[0];
  if (!first) return hideTip();
  // A picker isn't focused: focus would open its list over the tooltip.
  if (first.control.type !== "hidden") first.control.focus({ preventScroll: true });
  // Through the page's scroller, so a glide still running from the wheel doesn't carry it off (src/lib/scroll.ts).
  scrollToElement(first.anchor, { smooth: true, center: true });
  showTip(first);
  // A smooth scroll moves the field after the tooltip is placed.
  setTimeout(place, 350);
}

/**
 * For a multi-step form's Next: checks the fields on screen in `scope`, shows the problems, and
 * returns whether the step can be left.
 */
export function reportMissing(scope: ParentNode | null | undefined): boolean {
  if (!scope) return true;
  const problems = findProblems(scope);
  report(problems);
  return problems.length === 0;
}

/** Fixed fields lose their red edge, and the tooltip goes once its field is fixed or left. */
function recheck() {
  for (const problem of [...marked]) if (!problem.anchor.isConnected || !needsFixing(problem.control)) unmark(problem);
}

export function FormValidation() {
  useEffect(() => {
    let batch: Control[] = [];
    let recheckTimer = 0;
    const later = () => {
      clearTimeout(recheckTimer);
      // After React has applied the change (a picker's hidden input updates on render).
      recheckTimer = window.setTimeout(recheck, 0);
    };

    // Forms that don't leave checking to the browser (noValidate) are checked as they're sent.
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.validation === "off" || event.submitter?.hasAttribute("formnovalidate")) return;
      const problems = findProblems(form);
      if (!problems.length) return;
      event.preventDefault();
      event.stopPropagation();
      report(problems);
    };

    // The browser's own check (a submit without noValidate, or a step's reportValidity): our tooltip instead of its bubble.
    const onInvalid = (event: Event) => {
      const control = event.target;
      if (!isControl(control) || !onScreen(anchorOf(control))) return;
      event.preventDefault();
      if (!batch.length) queueMicrotask(() => {
        const controls = batch;
        batch = [];
        report(controls.map((item) => ({ control: item, anchor: anchorOf(item), message: messageFor(item, anchorOf(item)) })));
      });
      batch.push(control);
    };

    const onFocus = (event: FocusEvent) => {
      if (shown && event.target instanceof Node && !shown.anchor.contains(event.target) && event.target !== shown.control && !tip?.contains(event.target)) hideTip();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && shown) hideTip();
      later();
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", later, true);
    document.addEventListener("change", later, true);
    document.addEventListener("click", later, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus, true);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", later, true);
      document.removeEventListener("change", later, true);
      document.removeEventListener("click", later, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("focusin", onFocus, true);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      clearTimeout(recheckTimer);
      for (const problem of [...marked]) unmark(problem);
      tip?.remove();
      tip = null;
    };
  }, []);
  return null;
}
