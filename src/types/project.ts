export type ProjectStatus = "draft" | "published";

export type ProjectSummary = {
  slug: string;
  title: string;
  course: string;
  courseName: string;
  domain: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  estimatedTime: string;
  skills: string[];
  tools: string[];
  summary: string;
};

export type Project = ProjectSummary & {
  datasetUrl: string;
  contentMarkdown: string;
};

export type StaffProject = Project & {
  id: string;
  status: ProjectStatus;
  updatedAt: string;
};
