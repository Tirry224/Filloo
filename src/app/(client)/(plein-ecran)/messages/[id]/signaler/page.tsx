import { ReportThreadScreen } from "@/components/chat/ReportThreadScreen";

export default async function ClientReportThreadPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <ReportThreadScreen espace="client" {...props} />;
}
