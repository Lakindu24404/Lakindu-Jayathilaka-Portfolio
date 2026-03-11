import Link from "next/link";

export default function WorkspaceNotFound() {
  return (
    <div className="dashPanel">
      <h1 className="dashPanelTitle">Not found</h1>
      <p className="dashPanelNote">
        That item does not exist, or it has been deleted since this link was
        opened.
      </p>
      <Link href="/dashboard/projects" className="dashButton dashButtonPrimary">
        Back to projects
      </Link>
    </div>
  );
}
