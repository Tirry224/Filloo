-- Une boutique est en ligne dès sa création : plus de validation ni de
-- refus. La suspension (`profiles.is_suspended`) reste le seul moyen de
-- retirer une boutique de la vitrine.

-- Les triggers et fonctions d'abord : l'update plus bas réveillerait sinon
-- `queue_merchant_decision` et remplirait la file d'emails.
drop trigger if exists merchants_queue_decision on public.merchants;
drop function if exists public.queue_merchant_decision();
drop trigger if exists merchants_sync_approval on public.merchants;
drop function if exists public.sync_merchant_approval();
drop function if exists public.resubmit_my_merchant();
drop function if exists public.approve_merchant(text);
drop function if exists public.reject_merchant(text, text);

update public.notifications
   set sent_at = now(), last_error = 'validation des boutiques supprimée'
 where sent_at is null
   and kind in ('merchant_approved', 'merchant_rejected');

update public.merchants
   set status = 'approved', approved_at = coalesce(approved_at, now())
 where status <> 'approved';

alter table public.merchants drop constraint if exists merchants_rejection_needs_reason;
alter table public.merchants drop column if exists valider;
alter table public.merchants drop column if exists rejection_reason;

alter table public.merchants alter column status set default 'approved';
alter table public.merchants alter column approved_at set default now();

-- `status` n'est plus qu'un vestige lu par les policies RLS
-- (`merchant_is_public`, catalogue public) : cette contrainte garantit qu'il
-- ne peut plus sortir une boutique de la vitrine en silence.
alter table public.merchants
  add constraint merchants_always_approved check (status = 'approved');
