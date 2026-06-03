-- Migration: Add responsavel_protocolar column to profiles table
ALTER TABLE profiles ADD COLUMN responsavel_protocolar BOOLEAN DEFAULT FALSE;
