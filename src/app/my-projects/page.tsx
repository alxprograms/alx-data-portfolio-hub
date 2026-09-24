import { MyProjectsList } from "@/components/my-projects-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublishedProjects } from "@/lib/data/projects";

export const metadata = {
  title: "My projects",
  description: "Return to the portfolio projects you chose to build.",
};

export default async function MyProjectsPage() {
  const projects = await getPublishedProjects();

  return (
    <>
      <SiteHeader />
      <main>
        <header className="projects-index-hero my-projects-hero">
          <div>
            <p>My projects</p>
            <h1>Pick up where you left off.</h1>
            <span>The project briefs you chose to build, ready when you are.</span>
          </div>
        </header>
        <section className="projects-section projects-section--index my-projects-section">
          <MyProjectsList projects={projects} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
