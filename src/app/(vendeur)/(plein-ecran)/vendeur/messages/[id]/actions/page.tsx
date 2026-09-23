import { ThreadActionsScreen } from "@/components/chat/ThreadActionsScreen";

export default async function MerchantThreadActionsPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <ThreadActionsScreen espace="merchant" {...props} />;
}
