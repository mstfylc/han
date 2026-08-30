import { redirect } from "next/navigation";

/** A han's floor plan, addressable down to the floor: /han/yildiz/2. */
export default async function HanRoute({ params }: { params: Promise<{ id: string; floor?: string[] }> }) {
  const { id, floor } = await params;
  const n = Number(floor?.[0]) || 0;
  redirect("/ara?p=han:" + encodeURIComponent(id) + (n ? "&kt=" + n : ""));
}
