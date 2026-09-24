"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProjectSummary } from "@/types/project";
import { ArrowUpRightIcon, SearchIcon } from "@/components/icons";
import { ProjectList } from "@/components/project-list";

type ProjectCatalogueProps = {
  projects: ProjectSummary[];
  initialLimit?: number;
  browseAllHref?: string;
};

const allCourses = "All courses";
const allLevels = "All levels";

export function ProjectCatalogue({ projects, initialLimit, browseAllHref }: ProjectCatalogueProps) {
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState(allCourses);
  const [difficulty, setDifficulty] = useState(allLevels);
  const courses = useMemo(() => [allCourses, ...Array.from(new Set(projects.map((project) => project.course)))], [projects]);
  const difficulties = useMemo(() => [allLevels, ...Array.from(new Set(projects.map((project) => project.difficulty)))], [projects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
      const searchable = [
        project.title,
        project.summary,
        project.domain,
        project.course,
        project.courseName,
        ...project.skills,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (course === allCourses || project.course === course) &&
        (difficulty === allLevels || project.difficulty === difficulty)
      );
    });
  }, [course, difficulty, projects, query]);

  const hasActiveFilters = Boolean(query.trim()) || course !== allCourses || difficulty !== allLevels;
  const visibleProjects = initialLimit && !hasActiveFilters
    ? filteredProjects.slice(0, initialLimit)
    : filteredProjects;
  const summaryLabel = initialLimit && !hasActiveFilters
    ? `${visibleProjects.length} latest project${visibleProjects.length === 1 ? "" : "s"}`
    : `${filteredProjects.length} project${filteredProjects.length === 1 ? "" : "s"}`;

  return (
    <div className="catalogue">
      <div className="filters" aria-label="Project filters">
        <label className="search-field">
          <span className="sr-only">Search projects</span>
          <SearchIcon className="search-field__icon" />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, industry, or skill"
            type="search"
            value={query}
          />
        </label>

        <label className="select-field">
          <span>Course</span>
          <select onChange={(event) => setCourse(event.target.value)} value={course}>
            {courses.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>

        <label className="select-field">
          <span>Difficulty</span>
          <select onChange={(event) => setDifficulty(event.target.value)} value={difficulty}>
            {difficulties.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="catalogue__summary" aria-live="polite">
        <span>{summaryLabel}</span>
        <span className="catalogue__summary-rule" aria-hidden="true" />
        <span>Real datasets, practical outcomes</span>
        {browseAllHref && <Link className="catalogue__browse-all" href={browseAllHref}>Browse all projects <ArrowUpRightIcon /></Link>}
      </div>

      {filteredProjects.length > 0 ? (
        <ProjectList projects={visibleProjects} />
      ) : (
        <div className="empty-state">
          <strong>No projects match those filters.</strong>
          <p>Try a broader search or reset one of the filters.</p>
          <button
            onClick={() => {
              setQuery("");
                setCourse(allCourses);
                setDifficulty(allLevels);
            }}
            type="button"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
