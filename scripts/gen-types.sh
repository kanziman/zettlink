#!/usr/bin/env bash
supabase gen types typescript --local > packages/db/src/types.gen.ts
echo "types.gen.ts regenerated"
