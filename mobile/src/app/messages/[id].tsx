import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtatVide } from "../../composants/EtatVide";
import { lireProduit, lireProduitsBoutique, type Produit } from "../../lib/catalogue";
import { formatGnf } from "../../lib/format";
import {
  MESSAGE_MAX,
  envoyerMessage,
  lireContexteFil,
  lireMessages,
  marquerLu,
  type ContexteFil,
  type Message,
} from "../../lib/messages";
import { useComptes } from "../../lib/profil";
import { supabase } from "../../lib/supabase";
import { couleurs } from "../../theme";

/**
 * Un fil, côté client. Même règles que `ThreadScreen` du site : le premier
 * message cite obligatoirement un produit (trigger `check_message_product`),
 * un fil bloqué ou gelé reste lisible mais n'a plus de champ de saisie.
 * Bloquer et signaler viendront avec leur parcours.
 */
export default function Fil() {
  const { id, produit: produitParam } = useLocalSearchParams<{ id: string; produit?: string }>();
  const { client, pret } = useComptes();
  const [contexte, setContexte] = useState<ContexteFil | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cite, setCite] = useState<Produit | null>(null);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [panne, setPanne] = useState(false);
  const [choixProduit, setChoixProduit] = useState(false);
  const liste = useRef<FlatList<Message>>(null);

  const recharger = useCallback(async () => {
    if (!client) return;
    setMessages(await lireMessages(id, client.id));
  }, [id, client]);

  useEffect(() => {
    if (!pret) return;
    if (!client) {
      setContexte(null);
      return;
    }
    setPanne(false);
    Promise.all([lireContexteFil(id, client.id), lireMessages(id, client.id)])
      .then(([c, m]) => {
        setContexte(c);
        setMessages(m);
        if (c) marquerLu(id, client.id);
      })
      .catch(() => setPanne(true));
  }, [id, client, pret]);

  // Le produit dont on vient (« Contacter le vendeur ») : cité dans le prochain message.
  useEffect(() => {
    if (produitParam) lireProduit(produitParam).then(setCite).catch(() => setCite(null));
  }, [produitParam]);

  /* Les messages qui arrivent pendant que le fil est ouvert (0014). Le
     jeton est posé AVANT l'abonnement : sinon le canal rejoint en `anon`
     et le RLS ne lui transmet rien (constaté sur le site). */
  useEffect(() => {
    if (!client || !contexte) return;
    let arrete = false;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(async ({ data }) => {
      if (arrete) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      canal = supabase
        .channel(`messages:${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${id}` },
          (evenement) => {
            if ((evenement.new as { sender_id?: string }).sender_id === client.id) return;
            recharger();
            marquerLu(id, client.id);
          },
        )
        .subscribe();
    });
    return () => {
      arrete = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [id, client, contexte, recharger]);

  async function envoyer() {
    if (!client || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const refus = await envoyerMessage({ filId: id, monId: client.id, texte: saisie, produitId: cite?.id ?? null });
    if (refus) {
      setErreur(refus);
    } else {
      setSaisie("");
      setCite(null);
      await recharger().catch(() => {});
    }
    setEnvoi(false);
  }

  const retour = () => (router.canGoBack() ? router.back() : router.replace("/messages"));

  if (panne || contexte === null) {
    return (
      <SafeAreaView style={styles.page}>
        <Pressable onPress={retour} style={styles.retourSeul} accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color={couleurs.ink} />
        </Pressable>
        {panne ? (
          <EtatVide icone="cloud-offline-outline" titre="Impossible de charger ce fil" texte="Vérifiez votre connexion internet, puis réessayez." />
        ) : (
          <EtatVide icone="chatbubbles-outline" titre="Conversation introuvable" texte="Elle n'existe pas, ou elle n'est pas à vous." />
        )}
      </SafeAreaView>
    );
  }
  if (contexte === undefined) {
    return (
      <View style={[styles.page, { justifyContent: "center" }]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  const bloqueParMoi = contexte.bloquePar === contexte.monId;
  const bloqueParLui = contexte.bloquePar !== null && !bloqueParMoi;
  const gele = !contexte.ouvert;
  const citerDAbord = messages.length === 0 && !cite && !gele;

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.barre}>
        <Pressable onPress={retour} accessibilityLabel="Retour" hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={couleurs.ink} />
        </Pressable>
        <Pressable style={styles.interlocuteur} onPress={() => router.push(`/boutique/${contexte.boutiqueId}`)}>
          {contexte.photoUrl ? (
            <Image source={contexte.photoUrl} style={styles.avatar} cachePolicy="disk" />
          ) : (
            <View style={[styles.avatar, styles.initiale]}>
              <Text style={styles.initialeTexte}>{contexte.interlocuteur.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.nom} numberOfLines={1}>
            {contexte.interlocuteur}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={liste}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => liste.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <Bulle message={item} />}
        />

        <View style={styles.pied}>
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          {gele ? (
            <Text style={styles.info}>
              {client?.suspendu
                ? "Votre compte ne permet plus d'écrire. Vos conversations restent consultables."
                : "Cette boutique n'est plus joignable sur Filloo. Vous pouvez relire vos échanges, mais plus lui écrire."}
            </Text>
          ) : bloqueParMoi ? (
            <Text style={styles.info}>Vous avez bloqué cette boutique. Le déblocage se fait pour l'instant depuis le site.</Text>
          ) : bloqueParLui ? (
            <Text style={styles.info}>Vous ne pouvez plus écrire dans ce fil.</Text>
          ) : (
            <>
              {cite ? (
                <View style={styles.cite}>
                  <Text style={styles.citeTexte} numberOfLines={1}>
                    Concerne : <Text style={{ fontWeight: "700" }}>{cite.titre}</Text>
                  </Text>
                  <Pressable onPress={() => setCite(null)} hitSlop={8}>
                    <Text style={styles.retirer}>Retirer</Text>
                  </Pressable>
                </View>
              ) : citerDAbord ? (
                <Pressable style={styles.citerDAbord} onPress={() => setChoixProduit(true)}>
                  <Text style={styles.citerTexte}>
                    Commencez par indiquer <Text style={{ fontWeight: "700" }}>de quel produit</Text> vous parlez.
                  </Text>
                  <Text style={styles.choisir}>Choisir</Text>
                </Pressable>
              ) : null}
              <View style={styles.saisieLigne}>
                <TextInput
                  style={styles.saisie}
                  value={saisie}
                  onChangeText={setSaisie}
                  placeholder="Votre message"
                  placeholderTextColor={couleurs.inkSoft}
                  multiline
                  maxLength={MESSAGE_MAX}
                  editable={!citerDAbord}
                />
                <Pressable
                  onPress={envoyer}
                  disabled={envoi || citerDAbord || !saisie.trim()}
                  style={[styles.envoyer, (envoi || citerDAbord || !saisie.trim()) && { opacity: 0.4 }]}
                  accessibilityLabel="Envoyer"
                >
                  {envoi ? <ActivityIndicator color={couleurs.onAccent} /> : <Ionicons name="send" size={18} color={couleurs.onAccent} />}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <ChoixProduit
        visible={choixProduit}
        boutique={contexte}
        onChoisir={(p) => {
          setCite(p);
          setChoixProduit(false);
        }}
        onFermer={() => setChoixProduit(false)}
      />
    </SafeAreaView>
  );
}

function Bulle({ message }: { message: Message }) {
  return (
    <View style={{ gap: 4, alignItems: message.moi ? "flex-end" : "flex-start" }}>
      {message.produit ? (
        <Pressable style={styles.reference} onPress={() => router.push(`/produit/${message.produit!.id}`)}>
          {message.produit.photoUrl ? (
            <Image source={message.produit.photoUrl} style={styles.referencePhoto} cachePolicy="disk" />
          ) : (
            <View style={[styles.referencePhoto, { backgroundColor: couleurs.placeholder }]} />
          )}
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.referenceTitre} numberOfLines={1}>
              {message.produit.titre}
            </Text>
            <Text style={styles.referencePrix}>
              {formatGnf(message.produit.prixGnf)}
              {message.produit.statut === "sold" ? " · Vendu" : ""}
            </Text>
          </View>
        </Pressable>
      ) : null}
      <View style={[styles.bulle, message.moi ? styles.bulleMoi : styles.bulleLui]}>
        <Text style={[styles.bulleTexte, message.moi && { color: couleurs.onAccent }]}>{message.texte}</Text>
        <Text style={[styles.heure, message.moi && { color: "rgba(255, 255, 255, 0.8)" }]}>{message.quand}</Text>
      </View>
    </View>
  );
}

/** Les produits en vente de la boutique, pour citer celui dont on parle (écran « citer » du site). */
function ChoixProduit({
  visible,
  boutique,
  onChoisir,
  onFermer,
}: {
  visible: boolean;
  boutique: ContexteFil;
  onChoisir: (p: Produit) => void;
  onFermer: () => void;
}) {
  const [produits, setProduits] = useState<Produit[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    lireProduitsBoutique({
      id: boutique.boutiqueId,
      nom: boutique.interlocuteur,
      ville: "",
      adresse: null,
      whatsapp: null,
      photoUrl: boutique.photoUrl ?? null,
    })
      .then((p) => setProduits(p.filter((x) => x.statut === "active")))
      .catch(() => setProduits([]));
  }, [visible, boutique]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFermer}>
      <Pressable style={styles.voile} onPress={onFermer} />
      <SafeAreaView style={styles.feuille} edges={["bottom"]}>
        <Text style={styles.feuilleTitre}>De quel produit parlez-vous ?</Text>
        {produits === null ? (
          <ActivityIndicator style={{ margin: 24 }} color={couleurs.accent} />
        ) : produits.length === 0 ? (
          <Text style={[styles.info, { padding: 16 }]}>Cette boutique n'a aucun produit en vente.</Text>
        ) : (
          <FlatList
            data={produits}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => (
              <Pressable style={styles.choix} onPress={() => onChoisir(item)}>
                {item.photos[0] ? (
                  <Image source={item.photos[0]} style={styles.referencePhoto} cachePolicy="disk" />
                ) : (
                  <View style={[styles.referencePhoto, { backgroundColor: couleurs.placeholder }]} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.referenceTitre} numberOfLines={1}>
                    {item.titre}
                  </Text>
                  <Text style={styles.referencePrix}>{formatGnf(item.prixGnf)}</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: couleurs.paper },
  retourSeul: { padding: 16 },
  barre: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.line,
    backgroundColor: couleurs.surface,
  },
  interlocuteur: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: couleurs.placeholder },
  initiale: { alignItems: "center", justifyContent: "center", backgroundColor: couleurs.accentSoft },
  initialeTexte: { fontSize: 16, fontWeight: "700", color: couleurs.accent },
  nom: { flex: 1, fontSize: 16, fontWeight: "700", color: couleurs.ink },
  messages: { padding: 16, gap: 10, flexGrow: 1, justifyContent: "flex-end" },
  bulle: { maxWidth: "80%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bulleMoi: { backgroundColor: couleurs.accent, borderBottomRightRadius: 4 },
  bulleLui: { backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.line, borderBottomLeftRadius: 4 },
  bulleTexte: { fontSize: 15, lineHeight: 21, color: couleurs.ink },
  heure: { fontSize: 11, color: couleurs.inkSoft, alignSelf: "flex-end" },
  reference: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: "80%",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: couleurs.line,
    backgroundColor: couleurs.surface,
  },
  referencePhoto: { width: 40, height: 40, borderRadius: 6 },
  referenceTitre: { fontSize: 13, fontWeight: "600", color: couleurs.ink },
  referencePrix: { fontSize: 12, color: couleurs.inkSoft },
  pied: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: couleurs.line,
    backgroundColor: couleurs.surface,
  },
  erreur: { fontSize: 13, color: couleurs.danger },
  info: { fontSize: 14, color: couleurs.inkSoft, textAlign: "center", paddingVertical: 6 },
  cite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: couleurs.line,
  },
  citeTexte: { flex: 1, fontSize: 12, color: couleurs.ink },
  retirer: { fontSize: 12, fontWeight: "600", color: couleurs.inkSoft },
  citerDAbord: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: couleurs.accent,
    backgroundColor: couleurs.accentSoft,
  },
  citerTexte: { flex: 1, fontSize: 12, color: couleurs.accent },
  choisir: { fontSize: 13, fontWeight: "700", color: couleurs.accent },
  saisieLigne: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  saisie: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: couleurs.line,
    fontSize: 16,
    color: couleurs.ink,
    backgroundColor: couleurs.paper,
  },
  envoyer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: couleurs.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  voile: { flex: 1, backgroundColor: "rgba(39, 31, 24, 0.45)" },
  feuille: { maxHeight: "70%", backgroundColor: couleurs.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16 },
  feuilleTitre: { fontSize: 18, fontWeight: "700", color: couleurs.ink, paddingHorizontal: 16, paddingBottom: 8 },
  choix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: couleurs.line,
  },
});
