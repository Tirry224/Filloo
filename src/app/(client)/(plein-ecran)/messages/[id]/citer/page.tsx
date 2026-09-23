import { QuoteProductScreen } from "@/components/chat/QuoteProductScreen";

export default async function ClientQuoteProductPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <QuoteProductScreen espace="client" {...props} />;
}
