import Link from "next/link";
import { ArrowUpRightIcon } from "@/components/icons";

type GuideSection = {
  href: string;
  label: string;
};

type GuidePageProps = {
  children: React.ReactNode;
  description: string;
  sections: GuideSection[];
  title: string;
  next: {
    href: string;
    label: string;
    title: string;
  };
};

export function GuidePage({ children, description, next, sections, title }: GuidePageProps) {
  return (
    <main>
      <header className="guide-hero">
        <div className="guide-hero__inner">
          <Link className="breadcrumb" href="/projects">
            <span aria-hidden="true">←</span>
            All projects
          </Link>
          <p>Portfolio guide</p>
          <h1>{title}</h1>
          <span>{description}</span>
        </div>
      </header>

      <div className="guide-layout">
        <aside className="guide-aside" aria-label="Guide contents">
          <p>On this page</p>
          <nav>
            {sections.map((section, index) => (
              <a href={section.href} key={section.href}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="guide-content">
          {children}

          <Link className="guide-next" href={next.href}>
            <span>{next.label}</span>
            <strong>{next.title}</strong>
            <ArrowUpRightIcon />
          </Link>
        </article>
      </div>
    </main>
  );
}
