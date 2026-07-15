-- ============================================================================
-- Gegner an der Umfrage (Default), wird beim Anlegen des Spieltags übernommen.
-- Einmalig im SQL-Editor ausführen.
-- ============================================================================
alter table public.polls add column default_opponent text;
