import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  children: string;
  headingIds?: string[];
};

export function MarkdownContent({ children, headingIds = [] }: MarkdownContentProps) {
  let headingIndex = 0;

  return (
    <div className="project-content">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children: headingChildren }) => {
            const id = headingIds[headingIndex];
            headingIndex += 1;

            return <h2 id={id}>{headingChildren}</h2>;
          },
          a: ({ children: linkChildren, href }) => {
            if (href?.startsWith("/") || href?.startsWith("#")) {
              return <Link href={href}>{linkChildren}</Link>;
            }

            return (
              <a href={href} rel="noreferrer" target="_blank">
                {linkChildren}
              </a>
            );
          },
          table: ({ children: tableChildren }) => (
            <div className="table-scroll">
              <table>{tableChildren}</table>
            </div>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
