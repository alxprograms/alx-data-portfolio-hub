"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { submitShowcaseAction } from "@/app/actions/showcase";
import { createClient } from "@/lib/supabase/client";

type ProjectOption = { slug: string; title: string };

type SubmissionField =
  | "name"
  | "email"
  | "title"
  | "project"
  | "otherProjectTitle"
  | "summary"
  | "tools"
  | "github"
  | "liveUrl"
  | "coverImage"
  | "consent";

const validationMessages: Record<SubmissionField, string> = {
  name: "Enter your name.",
  email: "Enter a valid email address.",
  title: "Add a title for your showcase.",
  project: "Choose the project you completed.",
  otherProjectTitle: "Enter the name of the project.",
  summary: "Describe what you built in at least 20 characters.",
  tools: "List at least one tool you used.",
  github: "Enter a valid GitHub repository URL.",
  liveUrl: "Enter a valid URL or leave this field empty.",
  coverImage: "Add a cover image.",
  consent: "Confirm that the work is yours and may be displayed.",
};

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function ShowcaseSubmissionForm({ projects }: { projects: ProjectOption[] }) {
  const [fileName, setFileName] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SubmissionField, string>>>({});

  function clearFieldError(name: string) {
    if (!(name in validationMessages)) return;
    setFieldErrors((current) => {
      if (!current[name as SubmissionField]) return current;
      const next = { ...current };
      delete next[name as SubmissionField];
      return next;
    });
  }

  function fieldState(name: SubmissionField) {
    return {
      "aria-describedby": fieldErrors[name] ? `${name}-error` : undefined,
      "aria-invalid": Boolean(fieldErrors[name]),
    };
  }

  function fieldClass(name: SubmissionField, base = "") {
    return [base, fieldErrors[name] ? "has-error" : ""].filter(Boolean).join(" ");
  }

  function fieldError(name: SubmissionField) {
    return fieldErrors[name] ? (
      <small className="field-error" id={`${name}-error`}>{fieldErrors[name]}</small>
    ) : null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const controls = Array.from(event.currentTarget.elements).filter(
      (element): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement,
    );
    const nextFieldErrors: Partial<Record<SubmissionField, string>> = {};

    controls.forEach((control) => {
      if (!control.name || control.checkValidity()) return;
      const name = control.name as SubmissionField;
      nextFieldErrors[name] = validationMessages[name] ?? control.validationMessage;
    });

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Complete the highlighted fields before submitting.");
      controls.find((control) => nextFieldErrors[control.name as SubmissionField])?.focus();
      return;
    }

    const form = new FormData(event.currentTarget);
    const image = form.get("coverImage");
    if (!(image instanceof File) || !image.size) {
      setFieldErrors({ coverImage: validationMessages.coverImage });
      setError("Complete the highlighted fields before submitting.");
      return;
    }

    const extension = extensionByType[image.type];
    if (!extension || image.size > 5 * 1024 * 1024) {
      setFieldErrors({ coverImage: "Use a PNG, JPG, or WebP image no larger than 5 MB." });
      setError("Choose a supported cover image before submitting.");
      return;
    }

    setFieldErrors({});
    setPending(true);

    const id = crypto.randomUUID();
    const coverImagePath = `${id}/cover.${extension}`;
    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("showcase-submissions")
      .upload(coverImagePath, image, { contentType: image.type, upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      setPending(false);
      return;
    }

    const result = await submitShowcaseAction({
      id,
      projectSlug: selectedProject === "other" ? "" : selectedProject,
      projectTitle: selectedProject === "other" ? String(form.get("otherProjectTitle") ?? "") : "",
      learnerName: String(form.get("name") ?? ""),
      learnerEmail: String(form.get("email") ?? ""),
      title: String(form.get("title") ?? ""),
      summary: String(form.get("summary") ?? ""),
      tools: String(form.get("tools") ?? "").split(",").map((tool) => tool.trim()).filter(Boolean),
      githubUrl: String(form.get("github") ?? ""),
      liveUrl: String(form.get("liveUrl") ?? ""),
      coverImagePath,
      consented: form.get("consent") === "on",
    });

    if (!result.ok) {
      setError(result.message);
      setPending(false);
      return;
    }

    setSubmitted(true);
    setPending(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (submitted) {
    return (
      <div className="submission-success">
        <span aria-hidden="true">✓</span>
        <p>Submission received</p>
        <h1>Your work is ready for review.</h1>
        <p>ALX staff will review the project before it appears in the public showcase.</p>
        <div><Link href="/showcase">Browse learner work</Link><button onClick={() => setSubmitted(false)} type="button">Submit another project</button></div>
      </div>
    );
  }

  return (
    <form
      className="submission-form"
      noValidate
      onInput={(event) => clearFieldError((event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).name)}
      onSubmit={submit}
    >
      <section>
        <div className="submission-section-heading"><span>01</span><div><h2>About you</h2><p>Your email is used for submission follow-up and is never shown publicly.</p></div></div>
        <div className="submission-fields">
          <label className={fieldClass("name")}><span>Name</span><input {...fieldState("name")} autoComplete="name" name="name" required />{fieldError("name")}</label>
          <label className={fieldClass("email")}><span>Email</span><input {...fieldState("email")} autoComplete="email" name="email" required type="email" />{fieldError("email")}</label>
        </div>
      </section>

      <section>
        <div className="submission-section-heading"><span>02</span><div><h2>About the project</h2><p>Give the work a clear title and connect it to the brief you completed.</p></div></div>
        <div className="submission-fields">
          <label className={fieldClass("title", "is-wide")}><span>Showcase title</span><input {...fieldState("title")} name="title" placeholder="e.g. Healthcare Service Coverage Dashboard" required />{fieldError("title")}</label>
          <label className={fieldClass("project", "is-wide")}><span>Project completed</span><select {...fieldState("project")} name="project" onChange={(event) => { setSelectedProject(event.target.value); clearFieldError("project"); }} required value={selectedProject}><option disabled value="">Select a project</option>{projects.map((project) => <option key={project.slug} value={project.slug}>{project.title}</option>)}<option value="other">Another ALX Data project</option></select>{fieldError("project")}</label>
          {selectedProject === "other" && <label className={fieldClass("otherProjectTitle", "is-wide")}><span>Project name</span><input {...fieldState("otherProjectTitle")} name="otherProjectTitle" placeholder="Name the project you completed" required />{fieldError("otherProjectTitle")}</label>}
          <label className={fieldClass("summary", "is-wide")}><span>What did you build and why does it matter?</span><textarea {...fieldState("summary")} maxLength={1000} minLength={20} name="summary" placeholder="Describe the problem, your approach, and the value of the finished work." required rows={6} />{fieldError("summary")}</label>
          <label className={fieldClass("tools")}><span>Tools used</span><input {...fieldState("tools")} name="tools" placeholder="Power BI, MySQL, Google Sheets" required />{fieldError("tools")}</label>
          <label className={fieldClass("github")}><span>GitHub repository</span><input {...fieldState("github")} name="github" placeholder="https://github.com/..." required type="url" />{fieldError("github")}</label>
          <label className={fieldClass("liveUrl", "is-wide")}><span>Live project or dashboard link <em>Optional</em></span><input {...fieldState("liveUrl")} name="liveUrl" placeholder="https://..." type="url" />{fieldError("liveUrl")}</label>
        </div>
      </section>

      <section>
        <div className="submission-section-heading"><span>03</span><div><h2>Show the work</h2><p>Add one strong image that makes the result understandable at a glance.</p></div></div>
        <label className={fieldClass("coverImage", "submission-upload")}>
          <input {...fieldState("coverImage")} accept="image/png,image/jpeg,image/webp" name="coverImage" onChange={(event) => { setFileName(event.target.files?.[0]?.name ?? ""); clearFieldError("coverImage"); }} required type="file" />
          <span aria-hidden="true">＋</span>
          <strong>{fileName || "Add a cover image"}</strong>
          <small>{fileName ? "Choose a different image" : "PNG, JPG, or WebP, up to 5 MB. Dashboard screenshots work well."}</small>
          {fieldError("coverImage")}
        </label>
      </section>

      <section className="submission-confirmation">
        <label className={fieldClass("consent")}><input {...fieldState("consent")} name="consent" required type="checkbox" /><span>I confirm that this is my work and that ALX may display the submitted name, project details, links, and cover image in the public showcase.</span>{fieldError("consent")}</label>
        <button disabled={pending} type="submit">{pending ? "Submitting…" : "Submit for review"} <span aria-hidden="true">↗</span></button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </form>
  );
}
