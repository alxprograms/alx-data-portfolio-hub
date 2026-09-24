import type { Metadata } from "next";
import { GuidePage } from "@/components/guide-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "LinkedIn Showcase Guide",
  description: "A practical guide to communicating a data portfolio project professionally on LinkedIn.",
};

const sections = [
  { href: "#why-linkedin", label: "Why LinkedIn?" },
  { href: "#post-structure", label: "Structure your post" },
  { href: "#featured-section", label: "Use the Featured section" },
  { href: "#things-to-avoid", label: "Things to avoid" },
  { href: "#after-posting", label: "After posting" },
];

const postStructure = `1. HOOK: Start with the business problem, not the tools.
   Avoid: "I just completed a Power BI dashboard!"
   Better: "A hospital network was struggling with rising readmission rates..."

2. WHAT YOU DID: Keep it brief, specific, and tool-agnostic.
   "I analysed three years of patient admission data, identified the
   departments with the highest readmission risk, and built an
   executive dashboard to help leadership act on it."

3. KEY FINDING: Share one specific insight.
   "The cardiology ward had a 30-day readmission rate 2.4 times
   the network average, concentrated in one age group."

4. LINK: Include the GitHub repository.
   "Full project, SQL scripts, and dashboard: [GitHub link]"

5. TAGS: Add five to eight relevant hashtags.
   #DataAnalytics #PowerBI #SQL #HealthcareAnalytics
   #ALXAfrica #PortfolioProject #DataCareer`;

export default function LinkedInGuidePage() {
  return (
    <>
      <SiteHeader />
      <GuidePage
        description="Communicate what you built, what you learned, and why the work matters."
        next={{
          href: "/projects",
          label: "Keep building",
          title: "Find your next project",
        }}
        sections={sections}
        title="LinkedIn Showcase Guide"
      >
        <section id="why-linkedin">
          <h2>Why LinkedIn?</h2>
          <p>
            Sharing a portfolio project publicly shows confidence, communication skills, and
            completed work. It can also help you connect with people working in the industry or
            problem area you analysed.
          </p>
        </section>

        <section id="post-structure">
          <h2>A post structure that works</h2>
          <p>Use this structure when sharing a completed project:</p>
          <pre><code>{postStructure}</code></pre>
        </section>

        <section id="featured-section">
          <h2>Add it to your Featured section</h2>
          <p>
            Do not stop at publishing the post. On your LinkedIn profile, open the
            <strong> Featured</strong> section, select the <strong>+</strong> button, and add a link
            to your GitHub repository. This keeps your strongest work visible on your profile.
          </p>
        </section>

        <section id="things-to-avoid">
          <h2>Things to avoid</h2>
          <ul>
            <li><strong>Do not only say “I built a dashboard.”</strong> Explain the problem and what you found.</li>
            <li><strong>Do not exaggerate.</strong> Describe evidence from the project, not an impact the analysis has not demonstrated.</li>
            <li><strong>Do not post without a visual.</strong> Include a dashboard screenshot or a key chart.</li>
            <li><strong>Do not omit the data source.</strong> Naming it shows professionalism and intellectual honesty.</li>
            <li><strong>Do not wait for perfection.</strong> Completed, documented work is valuable when people can see it.</li>
          </ul>
        </section>

        <section id="after-posting">
          <h2>Engage after posting</h2>
          <p>
            Reply to comments and questions. Join conversations with people working in the domain
            you analysed, whether that is healthcare, agriculture, finance, education, or another field.
          </p>
        </section>
      </GuidePage>
      <SiteFooter />
    </>
  );
}
