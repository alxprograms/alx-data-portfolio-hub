import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShowcaseEntry, ShowcaseStatus } from "@/types/showcase";

type ShowcaseRow = {
  id: string;
  slug: string;
  title: string;
  learner_name: string;
  learner_email?: string;
  project_title: string;
  projects: { slug: string; course: string; domain: string } | { slug: string; course: string; domain: string }[] | null;
  tools: string[];
  summary: string;
  github_url: string;
  live_url: string | null;
  cover_image_path: string;
  public_cover_image_path: string | null;
  status: ShowcaseStatus;
  submitted_at: string;
};

const publicColumns = "id,slug,title,learner_name,project_title,tools,summary,github_url,live_url,cover_image_path,public_cover_image_path,status,submitted_at,projects(slug,course,domain)";
const publicColumnsWithProject = "id,slug,title,learner_name,project_title,tools,summary,github_url,live_url,cover_image_path,public_cover_image_path,status,submitted_at,projects!inner(slug,course,domain)";

function projectDetails(row: ShowcaseRow) {
  return Array.isArray(row.projects) ? row.projects[0] : row.projects;
}

function publicImageUrl(supabase: Awaited<ReturnType<typeof createClient>>, path: string | null) {
  if (!path) return "";
  return supabase.storage.from("showcase-public").getPublicUrl(path).data.publicUrl;
}

function toEntry(row: ShowcaseRow, coverImageUrl: string): ShowcaseEntry {
  const project = projectDetails(row);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    projectTitle: row.project_title,
    projectSlug: project?.slug,
    course: project?.course,
    domain: project?.domain,
    tools: row.tools,
    summary: row.summary,
    githubUrl: row.github_url,
    liveUrl: row.live_url ?? undefined,
    coverImagePath: row.cover_image_path,
    coverImageUrl,
    status: row.status,
    submittedAt: row.submitted_at,
  };
}

export async function getApprovedShowcases(limit?: number): Promise<ShowcaseEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("showcase_submissions")
    .select(publicColumns)
    .eq("status", "approved")
    .order("decided_at", { ascending: false });

  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load showcase: ${error.message}`);

  return ((data ?? []) as unknown as ShowcaseRow[]).map((row) =>
    toEntry(row, publicImageUrl(supabase, row.public_cover_image_path)),
  );
}

export async function getApprovedShowcaseBySlug(slug: string): Promise<ShowcaseEntry | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("showcase_submissions")
    .select(publicColumns)
    .eq("status", "approved")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`Unable to load showcase entry: ${error.message}`);
  if (!data) return undefined;
  const row = data as unknown as ShowcaseRow;
  return toEntry(row, publicImageUrl(supabase, row.public_cover_image_path));
}

export async function getApprovedShowcasesForProject(projectSlug: string, limit = 3): Promise<ShowcaseEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("showcase_submissions")
    .select(publicColumnsWithProject)
    .eq("status", "approved")
    .eq("projects.slug", projectSlug)
    .order("decided_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Unable to load project showcase: ${error.message}`);

  return ((data ?? []) as unknown as ShowcaseRow[]).map((row) =>
    toEntry(row, publicImageUrl(supabase, row.public_cover_image_path)),
  );
}

export async function getStaffShowcaseSubmissions(): Promise<ShowcaseEntry[]> {
  const { supabase } = await requireStaff();
  // Keep project embedding on the staff session, which has project permissions.
  const { data, error } = await supabase
    .from("showcase_submissions")
    .select(publicColumns)
    .order("submitted_at", { ascending: false });

  if (error) throw new Error(`Unable to load showcase submissions: ${error.message}`);

  const rows = (data ?? []) as unknown as ShowcaseRow[];
  if (!rows.length) return [];
  // Only private contacts use the secret client, after staff authorization.
  // Fetch in small batches so the ID filter doesn't exceed URL-size limits.
  const admin = createAdminClient();
  const contacts = await Promise.all(Array.from({ length: Math.ceil(rows.length / 100) }, async (_, index) => {
    const { data: emails, error: emailError } = await admin
      .from("showcase_submissions")
      .select("id,learner_email")
      .in("id", rows.slice(index * 100, (index + 1) * 100).map((row) => row.id));
    if (emailError) throw new Error(`Unable to load staff contact details: ${emailError.message}`);
    return emails ?? [];
  }));
  const emailById = new Map(contacts.flat().map((contact) => [contact.id, contact.learner_email]));

  return Promise.all(rows.map(async (row) => {
    let imageUrl = publicImageUrl(supabase, row.public_cover_image_path);
    if (!imageUrl) {
      const { data: signed } = await supabase.storage
        .from("showcase-submissions")
        .createSignedUrl(row.cover_image_path, 3600);
      imageUrl = signed?.signedUrl ?? "";
    }
    return toEntry({ ...row, learner_email: emailById.get(row.id) }, imageUrl);
  }));
}

export async function getStaffShowcaseBySlug(slug: string): Promise<ShowcaseEntry | undefined> {
  const entries = await getStaffShowcaseSubmissions();
  return entries.find((entry) => entry.slug === slug);
}
