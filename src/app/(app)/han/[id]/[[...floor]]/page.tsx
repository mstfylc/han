import { redirect } from "next/navigation";

/** A han's floor plan, addressable down to the floor & door: /han/santral/B or /han/yildiz/2. */
export default async function HanRoute({ params }: { params: Promise<{ id: string; floor?: string[] }> }) {
  const { id, floor } = await params;
  const normalizedId = id === "santral-han" ? "santral" : id;
  const fl = floor?.[0] || "";
  const door = floor?.[1] || "";
  const qs = new URLSearchParams();
  if (fl) qs.set("kat", fl);
  if (door) qs.set("kapi", door);
  const query = qs.toString();
  redirect("/yer/" + encodeURIComponent(normalizedId) + (query ? "?" + query : ""));
}
