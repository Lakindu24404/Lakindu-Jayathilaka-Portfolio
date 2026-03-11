import type { ProjectInput, StackTechInput } from "@/lib/data/schemas";
import type {
  OrbitRing,
  OverviewStats,
  ProjectRecord,
  StackTechRecord,
} from "@/lib/data/types";

/**
 * The contract the dashboard is written against.
 *
 * The UI and the Server Actions only ever see this interface, so swapping the
 * storage backend means adding one more implementation, not touching pages.
 */
export interface PortfolioRepository {
  listStack(): Promise<StackTechRecord[]>;
  createStackTech(input: StackTechInput): Promise<StackTechRecord>;
  updateStackTech(
    id: string,
    input: StackTechInput,
  ): Promise<StackTechRecord>;
  deleteStackTech(id: string): Promise<void>;
  /** Persist a new order for one ring; `ids` is the full ring, in order. */
  reorderStack(ring: OrbitRing, ids: string[]): Promise<void>;

  listProjects(): Promise<ProjectRecord[]>;
  getProject(id: string): Promise<ProjectRecord | null>;
  getProjectBySlug(slug: string): Promise<ProjectRecord | null>;
  createProject(input: ProjectInput): Promise<ProjectRecord>;
  updateProject(id: string, input: ProjectInput): Promise<ProjectRecord>;
  deleteProject(id: string): Promise<void>;
  reorderProjects(ids: string[]): Promise<void>;
  /** True when `slug` is free, ignoring the project being edited. */
  isSlugAvailable(slug: string, exceptId?: string): Promise<boolean>;

  overview(): Promise<OverviewStats>;
}

export class RepositoryError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "RepositoryError";
    this.field = field;
  }
}
