import { redirect } from "next/navigation";

export default function AdminIngestRedirectPage() {
  redirect("/settings?tab=ingest");
}
