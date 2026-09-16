import { ThreadActionsScreen } from "@/components/chat/ThreadActionsScreen";

/**
 * Montage CLIENT de cet écran. Le fichier ne contient rien d'autre
 * que ce montage, et c'est voulu : la logique est partagée (un fil se
 * dessine pareil des deux côtés), la ROUTE ne l'est pas. C'est ce
 * découpage qui rend l'espace vérifiable — il se lit dans l'arborescence,
 * pas dans une condition enfouie.
 */
export default async function ClientThreadActionsPage(props: {
  params: Promise<{ id: string }>;
}) {
  return <ThreadActionsScreen espace="client" {...props} />;
}
