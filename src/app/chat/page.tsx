import type { Metadata } from "next";

import { MinervaChatPage } from "@/components/chat/minerva-chat-page";
import { getCurrentProfileRole } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Minerva Chat | Strategic AI Hub",
  description:
    "Asistente corporativo Minerva AI: consultas generales, redacción y soporte.",
};

export default async function ChatPage() {
  const role = await getCurrentProfileRole();
  const showAdminIngestLink = role === "admin";

  return <MinervaChatPage showAdminIngestLink={showAdminIngestLink} />;
}
