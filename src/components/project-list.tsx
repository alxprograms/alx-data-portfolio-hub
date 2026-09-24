import Link from "next/link";
import { ArrowUpRightIcon, ClockIcon } from "@/components/icons";
import type { ProjectSummary } from "@/types/project";

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  return (
    <ol className="project-list">
      {projects.map((project, index) => (
        <li key={project.slug}>
          <Link className="project-row" href={`/projects/${project.slug}`}>
            <span className="project-row__number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className="project-row__body">
              <span className="project-row__eyebrow">
                <span>{project.course}</span>
                <span aria-hidden="true">·</span>
                <span>{project.courseName}</span>
                <span aria-hidden="true">·</span>
                <span>{project.domain}</span>
              </span>
              <strong>{project.title}</strong>
              <span className="project-row__summary">{project.summary}</span>
              <span className="project-row__tags">
                {project.skills.slice(0, 4).map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </span>
            </span>

            <span className="project-row__aside">
              <span className={`difficulty difficulty--${project.difficulty.toLowerCase()}`}>
                {project.difficulty}
              </span>
              <span className="project-row__time">
                <ClockIcon />
                {project.estimatedTime}
              </span>
              <span className="project-row__open">
                Open brief
                <ArrowUpRightIcon />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
