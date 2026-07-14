-- ============================================================================
-- Ablehnen von Vereins-Anträgen (Gegenstück zu approve_club_request).
-- Einmalig im SQL-Editor ausführen.
-- ============================================================================
create or replace function public.reject_club_request(p_request uuid)
returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_platform_admin() then raise exception 'not authorized'; end if;
  update public.club_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request and status = 'pending';
end $$;

revoke all on function public.reject_club_request(uuid) from public;
grant execute on function public.reject_club_request(uuid) to authenticated;
