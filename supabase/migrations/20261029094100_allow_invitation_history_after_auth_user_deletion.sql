-- Preserve invitations when an Auth account is removed.
-- Historical invitations may outlive the inviter account. The tenant ID is still
-- protected by the composite FK, while only the optional inviter reference is nulled.
-- This matches the migration already applied to production.

begin;

alter table public.organization_invitations
  alter column invited_by drop not null;

alter table public.organization_invitations
  drop constraint if exists organization_invitations_same_org_inviter_fk;

alter table public.organization_invitations
  add constraint organization_invitations_same_org_inviter_fk
  foreign key (organization_id, invited_by)
  references public.organization_members (organization_id, user_id)
  on delete set null (invited_by);

comment on column public.organization_invitations.invited_by is
  'Inviter membership UUID; becomes NULL if the inviter account is removed, while invitation history and tenant association remain intact.';

commit;
