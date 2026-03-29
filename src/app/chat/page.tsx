import type { Metadata } from "next";

import { MinervaChatPage } from "@/components/chat/minerva-chat-page";

export const metadata: Metadata = {
  title: "Minerva Chat | Strategic AI Hub",
  description:
    "Asistente corporativo Minerva AI: consultas generales, redacción y soporte.",
};

export default function ChatPage() {
  return <MinervaChatPage />;
}
