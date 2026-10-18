import { PageHeader, Panel } from "@/components/admin/ui";
import { connection } from "next/server";
import { AlbumForm } from "../album-form";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function NewAlbum() {
  await connection();
  return (
    <>
      <PageHeader title="New album" breadcrumbs={[{ label: "Gallery", href: "/admin/gallery" }, { label: "New album" }]} description="Create the album first, then upload photos into it." />
      <Panel className="max-w-2xl"><AlbumForm album={null} /></Panel>
    </>
  );
}
