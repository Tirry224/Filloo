import { ThreadActionsScreen } from "@/components/chat/ThreadActionsScreen";

export default async function ClientThreadActionsPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <ThreadActionsScreen espace="client" {...props} />;
}
