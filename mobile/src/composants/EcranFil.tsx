import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
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
import { EtatVide } from "./EtatVide";
import { FeuilleSignalement } from "./FeuilleSignalement";
import { lireProduit, lireProduitsBoutique, type Produit } from "../lib/catalogue";
import { formatGnf } from "../lib/format";
import {
  MESSAGE_MAX,
  envoyerMessage,
  lireContexteFil,
  lireMessages,
  marquerLu,
  type ContexteFil,
  type Message,
} from "../lib/messages";
import { MOTIFS_FIL, bloquer, debloquer, signalerFil } from "../lib/moderation";
import { supabase } from "../lib/supabase";
import { couleurs } from "../theme";

/**
 * Un fil, depuis l'espace client OU commerçant (`ThreadScreen` du site).
 * Mêmes règles des deux côtés : le premier message cite obligatoirement
 * un produit (trigger `check_message_product`), un fil bloqué ou gelé
 * reste lisible mais n'a plus de champ de saisie. Bloquer et signaler
 * passent par la feuille d'actions (le drapeau en haut à droite).
 */
export function EcranFil({
  id,
  produitParam,
  moi,
  pret,
  espace,
}: {
  id: string;
  produitParam?: string;
  /** Mon profil du côté de cet espace ; `null` si je n'en ai pas. */
  moi: { id: string; suspendu: boolean } | null;
  pret: boolean;
  espace: "client" | "merchant";
}) {
  const [contexte, setContexte] = useState<ContexteFil | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cite, setCite] = useState<Produit | null>(null);
  const [saisie, setSaisie] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [panne, setPanne] = useState(false);
  const [choixProduit, setChoixProduit] = useState(false);
  const [actions, setActions] = useState(false);
  const [signalement, setSignalement] = useState(false);
  const [avis, setAvis] = useState<{ texte: string; ok: boolean } | null>(null);
  const liste = useRef<FlatList<Message>>(null);

  const recharger = useCallback(async () => {
    if (!moi) return;
    setMessages(await lireMessages(id, moi.id));
  }, [id, moi]);

  useEffect(() => {
    if (!pret) return;
    if (!moi) {
      setContexte(null);
      return;
    }
    setPanne(false);
    const cote =
      espace === "client"
        ? { espace: "client" as const, clientId: moi.id }
        : { espace: "merchant" as const, profilCommercantId: moi.id };
    Promise.all([lireContexteFil(id, cote), lireMessages(id, moi.id)])
      .then(([c, m]) => {
        setContexte(c);
        setMessages(m);
        if (c) marquerLu(id, moi.id);
      })
      .catch(() => setPanne(true));
  }, [id, moi, pret, espace]);

  // Le produit dont on vient (« Contacter le vendeur ») : cité dans le prochain message.
  useEffect(() => {
    if (produitParam) lireProduit(produitParam).then(setCite).catch(() => setCite(null));
  }, [produitParam]);

  /* Les messages qui arrivent pendant que le fil est ouvert (0014). Le
     jeton est posé AVANT l'abonnement : sinon le canal rejoint en `anon`
     et le RLS ne lui transmet rien (constaté sur le site). */
  useEffect(() => {
    if (!moi || !contexte) return;
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
            if ((evenement.new as { sender_id?: string }).sender_id === moi.id) return;
            recharger();
            marquerLu(id, moi.id);
          },
        )
        .subscribe();
    });
    return () => {
      arrete = true;
      if (canal) supabase.removeChannel(canal);
    };
  }, [id, moi, contexte, recharger]);

  async function envoyer() {
    if (!moi || envoi) return;
    setEnvoi(true);
    setErreur(null);
    const refus = await envoyerMessage({ filId: id, monId: moi.id, texte: saisie, produitId: cite?.id ?? null });
    if (refus) {
      setErreur(refus);
    } else {
      setSaisie("");
      setCite(null);
      await recharger().catch(() => {});
    }
    setEnvoi(false);
  }

  async function changerBlocage(bloque: boolean) {
    if (!moi || !contexte) return;
    setActions(false);
    const refus = bloque ? await bloquer(id, moi.id) : await debloquer(id);
    if (refus) {
      setAvis({ texte: refus, ok: false });
      return;
    }
    setContexte({ ...contexte, bloquePar: bloque ? moi.id : null });
    setAvis(bloque ? null : { texte: "Personne débloquée. Vous pouvez de nouveau vous écrire.", ok: true });
  }

  const ecranListe = espace === "client" ? "/messages" : "/vendeur/messages";
  const retour = () => (router.canGoBack() ? router.back() : router.replace(ecranListe));

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
        <Pressable
          style={styles.interlocuteur}
          onPress={() => (contexte.jeSuisCommercant ? undefined : router.push(`/boutique/${contexte.boutiqueId}`))}
        >
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
        <Pressable onPress={() => setActions(true)} accessibilityLabel="Actions" hitSlop={8}>
          <Ionicons name="flag-outline" size={21} color={couleurs.inkSoft} />
        </Pressable>
      </View>
      {avis ? (
        <Pressable onPress={() => setAvis(null)} style={[styles.avis, { backgroundColor: avis.ok ? "#e3f5e9" : couleurs.dangerSoft }]}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: avis.ok ? couleurs.success : couleurs.danger }}>{avis.texte}</Text>
        </Pressable>
      ) : null}

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
              {/* La sanction d'en face ne se publie pas : on dit seulement qu'elle n'est plus joignable. */}
              {moi?.suspendu
                ? "Votre compte ne permet plus d'écrire. Vos conversations restent consultables."
                : contexte.jeSuisCommercant
                  ? "Cette personne n'est plus joignable sur Filloo. Vous pouvez relire vos échanges, mais plus lui écrire."
                  : "Cette boutique n'est plus joignable sur Filloo. Vous pouvez relire vos échanges, mais plus lui écrire."}
            </Text>
          ) : bloqueParMoi ? (
            <Text style={styles.info}>
              Vous avez bloqué {contexte.jeSuisCommercant ? "cette personne" : "cette boutique"}.{" "}
              <Text style={styles.choisir} onPress={() => changerBlocage(false)}>
                Débloquer
              </Text>
            </Text>
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

      <Modal visible={actions} animationType="slide" transparent onRequestClose={() => setActions(false)}>
        <Pressable style={styles.voile} onPress={() => setActions(false)} />
        <SafeAreaView style={styles.feuille} edges={["bottom"]}>
          <Text style={styles.feuilleTitre}>{contexte.interlocuteur}</Text>
          {!contexte.jeSuisCommercant ? (
            <LigneAction
              icone="storefront-outline"
              libelle="Voir la boutique"
              texte="Ville, adresse, tous ses produits."
              onPress={() => {
                setActions(false);
                router.push(`/boutique/${contexte.boutiqueId}`);
              }}
            />
          ) : null}
          {contexte.bloquePar === null ? (
            <LigneAction
              icone="flag-outline"
              libelle="Signaler cette conversation"
              texte="Insultes, arnaque, spam. Notre équipe la lira."
              danger
              onPress={() => {
                setActions(false);
                setSignalement(true);
              }}
            />
          ) : null}
          {/* Bloqué PAR L'AUTRE : aucune action. Seul le bloqueur débloque (0032). */}
          {bloqueParMoi ? (
            <LigneAction
              icone="lock-open-outline"
              libelle="Débloquer cette personne"
              texte="Vous pourrez de nouveau vous écrire, dans les deux sens."
              onPress={() => changerBlocage(false)}
            />
          ) : contexte.bloquePar === null ? (
            <LigneAction
              icone="ban-outline"
              libelle="Bloquer cette personne"
              texte="Plus aucun message dans ce fil, ni d'elle ni de vous. Le fil reste consultable, et vous pourrez débloquer."
              danger
              onPress={() => changerBlocage(true)}
            />
          ) : (
            <Text style={[styles.info, { padding: 16 }]}>Cette personne vous a bloqué : aucune action possible.</Text>
          )}
        </SafeAreaView>
      </Modal>

      <FeuilleSignalement
        visible={signalement}
        titre="Signaler cette conversation"
        motifs={MOTIFS_FIL}
        onEnvoyer={(motif, precisions) =>
          moi ? signalerFil(id, moi.id, motif, precisions) : Promise.resolve({ ok: false, message: "Reconnectez-vous." })
        }
        onFermer={() => setSignalement(false)}
      />

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

function LigneAction({
  icone,
  libelle,
  texte,
  danger = false,
  onPress,
}: {
  icone: React.ComponentProps<typeof Ionicons>["name"];
  libelle: string;
  texte: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const couleur = danger ? couleurs.danger : couleurs.ink;
  return (
    <Pressable style={styles.choix} onPress={onPress}>
      <Ionicons name={icone} size={22} color={couleur} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: couleur }}>{libelle}</Text>
        <Text style={{ fontSize: 13, color: couleurs.inkSoft, marginTop: 2 }}>{texte}</Text>
      </View>
    </Pressable>
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
  avis: { marginHorizontal: 12, marginTop: 8, padding: 12, borderRadius: 10 },
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
