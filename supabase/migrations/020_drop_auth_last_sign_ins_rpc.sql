-- Migration 020: rimuove la RPC legacy non piu` usata dopo la denormalizzazione di last_login_at

drop function if exists public.get_auth_last_sign_ins(uuid[]);
