import { PageHeader, Panel } from "@/components/admin/ui";
import { connection } from "next/server";
import { MediaLibrary } from "@/components/admin/media-picker";

// Admin screens render at request time; instant-navigation validation does not apply.
export const instant = false;

export default async function MediaPage() {
  await connection();
  return (
    <>
      <PageHeader title="Media library" description="Images, PDFs and other files stored in the public media bucket. Upload here or directly from any image field." />
      <Panel title="All files" description="Drag and drop to upload. Select a file to edit its title, alt text or folder, or to copy its URL. Deleting a file that pages still reference will break those images.">
        <MediaLibrary selectable={false} accept="all" />
      </Panel>
    </>
  );
}
