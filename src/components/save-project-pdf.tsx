"use client";

export function SaveProjectPdf() {
  return (
    <button className="project-aside__save" onClick={() => window.print()} type="button">
      Save as PDF
      <span aria-hidden="true">↓</span>
    </button>
  );
}
