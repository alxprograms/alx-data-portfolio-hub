"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProjectList } from "@/components/project-list";
import { readMyProjectSlugs, saveMyProjectSlugs } from "@/lib/my-projects";
import type { ProjectSummary } from "@/types/project";

export function MyProjectsList({ projects }: { projects: ProjectSummary[] }) {
  const [savedSlugs, setSavedSlugs] = useState<string[] | null>(null);
  const projectsBySlug = useMemo(
    () => new Map(projects.map((project) => [project.slug, project])),
    [projects],
  );

  useEffect(() => {
    const storedSlugs = readMyProjectSlugs();
    const publishedSlugs = storedSlugs.filter((slug) => projectsBySlug.has(slug));

    if (publishedSlugs.length !== storedSlugs.length) {
      saveMyProjectSlugs(publishedSlugs);
    }

    setSavedSlugs(publishedSlugs);
  }, [projectsBySlug]);

  if (savedSlugs === null) {
    return <p className="my-projects-loading" role="status">Loading your saved projects…</p>;
  }

  const savedProjects = savedSlugs
    .map((slug) => projectsBySlug.get(slug))
    .filter((project): project is ProjectSummary => Boolean(project));

  if (savedProjects.length === 0) {
    return (
      <div className="my-projects-empty">
        <p>Nothing saved yet</p>
        <h2>Choose a project to start building.</h2>
        <span>When you select “I’m building this” on a brief, it will appear here.</span>
        <Link href="/projects">Explore projects <b aria-hidden="true">↗</b></Link>
      </div>
    );
  }

  return (
    <div>
      <div className="catalogue__summary" aria-live="polite">
        <span>{savedProjects.length} saved project{savedProjects.length === 1 ? "" : "s"}</span>
        <span className="catalogue__summary-rule" aria-hidden="true" />
        <span>Ready when you are</span>
      </div>
      <ProjectList projects={savedProjects} />
    </div>
  );
}
