import { redirect } from "next/navigation";

/** Step-by-step directions to a shop, as a shareable address. */
export default async function DirectionsRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect("/ara?p=route:" + encodeURIComponent(id));
}
