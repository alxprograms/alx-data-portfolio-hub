import type { Metadata } from "next";
import { GuidePage } from "@/components/guide-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "GitHub Portfolio Guide",
  description: "A step-by-step guide to publishing a data portfolio project professionally on GitHub.",
};

const sections = [
  { href: "#why-github", label: "Why GitHub?" },
  { href: "#create-an-account", label: "Create an account" },
  { href: "#create-a-repository", label: "Create a repository" },
  { href: "#organise-your-folders", label: "Organise your folders" },
  { href: "#write-your-readme", label: "Write your README" },
  { href: "#upload-your-files", label: "Upload your files" },
  { href: "#add-screenshots", label: "Add screenshots" },
  { href: "#things-to-avoid", label: "Things to avoid" },
];

const repositoryExamples = `healthcare-analytics-capstone
retail-sql-analysis
africa-energy-powerbi-dashboard
crop-yield-sheets-analysis`;

const folderStructure = `your-project-name/
├── data/
│   ├── raw/           ← original downloaded file (if small enough)
│   └── cleaned/       ← your cleaned, analysis-ready file
├── sql/               ← SQL scripts (DA-3 and Capstone projects)
├── scripts/           ← any other scripts
├── dashboard/         ← Power BI .pbix file (DA-4 and Capstone)
├── reports/           ← executive summary and PDF outputs
├── images/
│   └── dashboard.png  ← screenshots of key outputs
└── README.md`;

const readmeExample = `# Project Title

## Business Challenge
[One paragraph describing the problem you were solving]

## Key Findings
- Finding 1 (specific and evidence-based)
- Finding 2
- Finding 3

## Tools Used
- Google Sheets: data cleaning and preparation
- MySQL: relational database analysis
- Power BI: interactive dashboard

## Dataset
Source: [Publisher Name](link)
Note: Download the data from the link above and place it in /data/raw/

## Dashboard Preview
![Dashboard Screenshot](images/dashboard.png)

## How to Use This Repository
[Brief instructions]

## Limitations
[What the data could not tell you]

## Reflections
[What you learned and would do differently]`;

export default function GitHubGuidePage() {
  return (
    <>
      <SiteHeader />
      <GuidePage
        description="Publish your portfolio project professionally, even if you have never used GitHub before."
        next={{
          href: "/guides/linkedin",
          label: "Next guide",
          title: "Share your work on LinkedIn",
        }}
        sections={sections}
        title="GitHub Portfolio Guide"
      >
        <section id="why-github">
          <h2>Why GitHub?</h2>
          <p>
            GitHub is where data professionals showcase their work. A well-organised,
            clearly documented project repository can show how you think, what you built,
            and how carefully you communicate your findings.
          </p>
        </section>

        <section id="create-an-account">
          <p className="guide-content__step">Step 1</p>
          <h2>Create a GitHub account</h2>
          <p>
            Go to <a href="https://github.com" rel="noreferrer" target="_blank">github.com</a> and
            create a free account. Use a professional username, ideally your real name or a close
            variation. It will appear on your portfolio and LinkedIn profile.
          </p>
        </section>

        <section id="create-a-repository">
          <p className="guide-content__step">Step 2</p>
          <h2>Create a repository</h2>
          <p>
            Click the <strong>+</strong> icon and select <strong>New repository</strong>. Give it a
            clear, descriptive name using hyphens:
          </p>
          <pre><code>{repositoryExamples}</code></pre>
          <p>
            Set the repository to <strong>Public</strong>, select <strong>Add a README file</strong>,
            and then create it.
          </p>
        </section>

        <section id="organise-your-folders">
          <p className="guide-content__step">Step 3</p>
          <h2>Organise your folders</h2>
          <p>Use a consistent structure for every project. Here is the recommended layout:</p>
          <pre><code>{folderStructure}</code></pre>
          <p>
            <strong>Do not upload large datasets directly.</strong> For large files, explain in your
            README where the data can be downloaded and include a direct source link.
          </p>
        </section>

        <section id="write-your-readme">
          <p className="guide-content__step">Step 4</p>
          <h2>Write a useful README</h2>
          <p>Your README is the first thing most visitors see. It should answer five questions:</p>
          <ul>
            <li><strong>What is this project?</strong> Describe the business problem in one sentence.</li>
            <li><strong>What did you find?</strong> Share two or three specific findings.</li>
            <li><strong>What tools did you use?</strong> List the tools and how you used them.</li>
            <li><strong>Where is the data from?</strong> Name and link to the source.</li>
            <li><strong>How can someone view it?</strong> Provide brief instructions.</li>
          </ul>
          <p>A useful README structure:</p>
          <pre><code>{readmeExample}</code></pre>
        </section>

        <section id="upload-your-files">
          <p className="guide-content__step">Step 5</p>
          <h2>Upload your files</h2>
          <p>
            Drag files into the repository or use <strong>Add file → Upload files</strong>. Give each
            upload a clear commit message, such as <em>Add cleaned dataset and SQL analysis scripts</em>.
          </p>
        </section>

        <section id="add-screenshots">
          <p className="guide-content__step">Step 6</p>
          <h2>Add screenshots</h2>
          <p>
            Include at least one screenshot of your dashboard or key chart. Put it in the
            <code>images/</code> folder and reference it in your README. A visual preview helps
            people understand the project before opening its files.
          </p>
        </section>

        <section id="things-to-avoid">
          <h2>Things to avoid</h2>
          <ul>
            <li>Do not upload files containing personally identifiable information.</li>
            <li>Do not upload datasets when the licence prohibits redistribution.</li>
            <li>Avoid committing files larger than 50MB.</li>
            <li>Do not leave the README empty or filled with placeholder text.</li>
            <li>Do not use filenames such as <em>final_FINAL_v3_use_this_one.xlsx</em>.</li>
          </ul>
        </section>
      </GuidePage>
      <SiteFooter />
    </>
  );
}
