import { redirect } from "next/navigation";

/**
 * A street has its own shareable address, but it renders as the search screen's
 * right-hand panel — so the link resolves there rather than duplicating the
 * panel as a second page that would then drift from it.
 */
export default async function StreetRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect("/ara?p=street:" + encodeURIComponent(id));
}
