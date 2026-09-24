"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import type { MarkdownSection } from "@/lib/markdown-sections";

type ProjectBriefNavigationProps = {
  sections: MarkdownSection[];
};

export function ProjectBriefNavigation({ sections }: ProjectBriefNavigationProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const headings = sections
      .map(({ id }) => document.getElementById(id))
      .filter((heading): heading is HTMLElement => Boolean(heading));

    if (headings.length === 0) {
      return;
    }

    let frame = 0;

    const updateActiveSection = () => {
      const marker = Math.min(180, window.innerHeight * 0.24);
      let currentId = headings[0].id;

      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > marker) {
          break;
        }

        currentId = heading.id;
      }

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        currentId = headings.at(-1)?.id ?? currentId;
      }

      setActiveId((previousId) => previousId === currentId ? previousId : currentId);
    };

    const handleScroll = () => {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        updateActiveSection();
        frame = 0;
      });
    };

    const hashId = decodeURIComponent(window.location.hash.slice(1));
    if (hashId && headings.some(({ id }) => id === hashId)) {
      setActiveId(hashId);
    } else {
      updateActiveSection();
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [sections]);

  if (sections.length === 0) {
    return null;
  }

  const handleSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    const heading = document.getElementById(id);

    if (!heading) {
      return;
    }

    setActiveId(id);
    heading.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <nav aria-label="Project brief sections" className="project-navigation">
      <p className="project-navigation__title">On this page</p>

      <ol className="project-navigation__list">
        {sections.map((section, index) => (
          <li key={section.id}>
            <a
              aria-current={activeId === section.id ? "location" : undefined}
              href={`#${section.id}`}
              onClick={() => setActiveId(section.id)}
            >
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              {section.title}
            </a>
          </li>
        ))}
      </ol>

      <div className="project-navigation__mobile">
        <label className="sr-only" htmlFor="project-section-jump">Jump to a section</label>
        <div className="project-navigation__select">
          <select id="project-section-jump" onChange={handleSelect} value={activeId}>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>{section.title}</option>
            ))}
          </select>
          <span aria-hidden="true">↓</span>
        </div>
      </div>
    </nav>
  );
}
