import { test } from "node:test";
import assert from "node:assert/strict";
import { coverPath, summarizeThreadRows, type ThreadMessageRow } from "../src/lib/thread-summary.ts";

const MOI = "profil-moi";
const LUI = "profil-lui";

function row(partial: Partial<ThreadMessageRow> & Pick<ThreadMessageRow, "conversation_id" | "created_at">): ThreadMessageRow {
  return { sender_id: LUI, body: "…", read_at: null, products: null, ...partial };
}

test("seuls les messages reçus et sans read_at comptent comme non lus", () => {
  const rows = [
    row({ conversation_id: "a", created_at: "4" }),
    row({ conversation_id: "a", created_at: "3", sender_id: MOI }),
    row({ conversation_id: "a", created_at: "2", read_at: "2026-09-23" }),
    row({ conversation_id: "a", created_at: "1" }),
  ];
  assert.equal(summarizeThreadRows(rows, MOI).get("a")?.unreadCount, 2);
});

test("les non-lus de deux fils ne se mélangent pas", () => {
  const rows = [
    row({ conversation_id: "a", created_at: "3" }),
    row({ conversation_id: "b", created_at: "2", read_at: "lu" }),
    row({ conversation_id: "a", created_at: "1" }),
  ];
  const resumes = summarizeThreadRows(rows, MOI);
  assert.equal(resumes.get("a")?.unreadCount, 2);
  assert.equal(resumes.get("b")?.unreadCount, 0);
});

test("aucun message non lu donne 0, jamais undefined", () => {
  const rows = [row({ conversation_id: "a", created_at: "1", sender_id: MOI })];
  assert.equal(summarizeThreadRows(rows, MOI).get("a")?.unreadCount, 0);
});

test("chaque fil porte la photo de SON dernier produit cité", () => {
  const rows = [
    row({ conversation_id: "a", created_at: "4" }),
    row({
      conversation_id: "b",
      created_at: "3",
      products: { title: "Riz", product_images: [{ storage_path: "m/riz/2.webp", position: 1 }, { storage_path: "m/riz/1.webp", position: 0 }] },
    }),
    row({ conversation_id: "a", created_at: "2", products: { title: "Pagne", product_images: [{ storage_path: "m/pagne/1.webp", position: 0 }] } }),
    row({ conversation_id: "a", created_at: "1", products: { title: "Ancien", product_images: [{ storage_path: "m/ancien/1.webp", position: 0 }] } }),
  ];
  const resumes = summarizeThreadRows(rows, MOI);
  assert.equal(resumes.get("a")?.lastProductTitle, "Pagne");
  assert.equal(resumes.get("a")?.lastProductCoverPath, "m/pagne/1.webp");
  assert.equal(resumes.get("b")?.lastProductCoverPath, "m/riz/1.webp");
});

test("un produit sans photo, masqué ou supprimé ne donne pas de photo", () => {
  const rows = [
    row({ conversation_id: "a", created_at: "2", products: { title: "Sans photo", product_images: [] } }),
    row({ conversation_id: "b", created_at: "1", products: null }),
  ];
  const resumes = summarizeThreadRows(rows, MOI);
  assert.equal(resumes.get("a")?.lastProductCoverPath, undefined);
  assert.equal(resumes.get("b")?.lastProductCoverPath, undefined);
  assert.equal(coverPath(undefined), undefined);
});
