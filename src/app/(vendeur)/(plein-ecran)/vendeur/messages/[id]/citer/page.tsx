import { QuoteProductScreen } from "@/components/chat/QuoteProductScreen";

export default async function MerchantQuoteProductPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <QuoteProductScreen espace="merchant" {...props} />;
}
