import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRightIcon, ClockIcon } from "@/components/icons";
import { MarkdownContent } from "@/components/markdown-content";
import { ProjectCommitment } from "@/components/project-commitment";
import { SaveProjectPdf } from "@/components/save-project-pdf";
import { ShowcaseVisual } from "@/components/showcase-visual";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedProjectBySlug } from "@/lib/data/projects";
import { getApprovedShowcasesForProject } from "@/lib/data/showcase";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProjectBySlug(slug);

  if (!project) {
    return {};
  }

  return {
    title: project.title,
    description: project.summary,
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const [project, showcaseEntries] = await Promise.all([
    getPublishedProjectBySlug(slug),
    getApprovedShowcasesForProject(slug),
  ]);

  if (!project) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main>
        <header className="project-hero">
          <div className="project-hero__inner">
            <Link className="breadcrumb" href="/projects">
              <span aria-hidden="true">←</span>
              All projects
            </Link>

            <div className="project-hero__grid">
              <div>
                <p className="project-hero__kicker">
                  {project.course} · {project.courseName} · {project.domain}
                </p>
                <h1>{project.title}</h1>
                <p className="project-hero__summary">{project.summary}</p>
              </div>

              <div className="project-hero__aside">
                <dl className="project-facts">
                  <div>
                    <dt>Level</dt>
                    <dd>{project.difficulty}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd><ClockIcon />{project.estimatedTime}</dd>
                  </div>
                  <div>
                    <dt>Tools</dt>
                    <dd>{project.tools.join(", ")}</dd>
                  </div>
                </dl>
                <ProjectCommitment projectSlug={project.slug} projectTitle={project.title} />
              </div>
            </div>
          </div>
        </header>

        <div className="project-layout">
          <aside className="project-aside">
            <p>Skills you will practise</p>
            <ul>
              {project.skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
            {project.datasetUrl && (
              <a href={project.datasetUrl} rel="noreferrer" target="_blank">
                View source dataset
                <ArrowUpRightIcon />
              </a>
            )}
            <SaveProjectPdf />
          </aside>

          <article>
            <MarkdownContent>{project.contentMarkdown}</MarkdownContent>
          </article>
        </div>

        <section className="project-showcase">
          {showcaseEntries.length > 0 ? (
            <>
              <div className="project-showcase__heading">
                <div>
                  <p>Built from this brief</p>
                  <h2>See how learners approached it.</h2>
                </div>
                <p>Explore completed work shaped by the same starting point, with different questions, decisions, and outcomes.</p>
              </div>
              <div className="project-showcase__list">
                {showcaseEntries.map((entry) => (
                  <Link className="project-showcase__entry" href={`/showcase/${entry.slug}`} key={entry.slug}>
                    <ShowcaseVisual alt={entry.title} compact src={entry.coverImageUrl} />
                    <span className="project-showcase__entry-copy">
                      <small>{entry.learnerName} · {entry.tools.join(" · ")}</small>
                      <strong>{entry.title}</strong>
                      <span>{entry.summary}</span>
                      <b>View the work <ArrowUpRightIcon /></b>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="project-showcase__empty">
              <div>
                <p>Built from this brief</p>
                <h2>Be the first to share your work.</h2>
              </div>
              <div>
                <p>Completed this project? Add your result to the learner showcase so others can see where the brief can lead.</p>
                <Link href="/showcase/submit">Submit your work <ArrowUpRightIcon /></Link>
              </div>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
