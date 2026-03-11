import type { Metadata } from "next";
import { StackManager } from "@/app/dashboard/(workspace)/stack/StackManager";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Stack Orbit" };

export default async function StackPage() {
  const { repository } = await requireAdmin();
  const technologies = await repository.listStack();

  return (
    <>
      <div className="dashHeader">
        <div>
          <h1 className="dashTitle">Stack Orbit</h1>
          <p className="dashSubtitle">
            The rings that circle the portrait in the Stack section. Drag to
            reorder within a ring, or move a node between rings — angles are
            redistributed evenly unless a node is placed by hand.
          </p>
        </div>
      </div>

      <StackManager initial={technologies} />
    </>
  );
}
