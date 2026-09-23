import { ReportThreadScreen } from "@/components/chat/ReportThreadScreen";

export default async function MerchantReportThreadPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <ReportThreadScreen espace="merchant" {...props} />;
}
