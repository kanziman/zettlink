// LLM 제안 태그를 canonical 태그로 정규화하고 card_tags에 연결하는 모듈
import { createServiceClient } from '@zettlink/db'

export interface NormalizedTag {
  id: number
  canonicalName: string
}

interface DbTag {
  id: number
  canonical_name: string
  aliases: string[]
  usage_count: number
}

function findMatch(input: string, tags: DbTag[]): DbTag | null {
  const exact = tags.find(t => t.canonical_name === input)
  if (exact) return exact

  const aliasMatch = tags.find(t => Array.isArray(t.aliases) && t.aliases.includes(input))
  if (aliasMatch) return aliasMatch

  return null
}

// LLM이 제안한 태그 문자열 배열을 canonical tag ID 배열로 변환
// 새 canonical이 필요하면 INSERT, 기존이면 alias 추가
export async function normalizeTags(
  rawTags: string[],
  cardId: string,
): Promise<NormalizedTag[]> {
  const db = createServiceClient()

  const normalizedInputs = rawTags.map(t => t.toLowerCase().trim()).filter(Boolean)
  if (normalizedInputs.length === 0) return []

  const { data: allTags, error } = await db
    .from('tags')
    .select('id, canonical_name, aliases, usage_count')

  if (error) throw new Error(`failed to fetch tags: ${error.message}`)

  const tags: DbTag[] = (allTags ?? []) as DbTag[]
  const resolved: NormalizedTag[] = []

  for (const input of normalizedInputs) {
    const matched = findMatch(input, tags)

    if (matched) {
      // alias 추가 (canonical과 다른 표기이고 아직 aliases에 없는 경우)
      if (matched.canonical_name !== input && !matched.aliases.includes(input)) {
        const updatedAliases = [...matched.aliases, input]
        await db
          .from('tags')
          .update({ aliases: updatedAliases })
          .eq('id', matched.id)
        matched.aliases = updatedAliases
      }

      await db
        .from('tags')
        .update({ usage_count: matched.usage_count + 1 })
        .eq('id', matched.id)
      matched.usage_count += 1

      resolved.push({ id: matched.id, canonicalName: matched.canonical_name })
    } else {
      const { data: newTag, error: insertError } = await db
        .from('tags')
        .insert({ canonical_name: input, aliases: [], usage_count: 1 })
        .select('id, canonical_name, aliases, usage_count')
        .single()

      if (insertError || !newTag) {
        throw new Error(`failed to insert tag "${input}": ${insertError?.message ?? 'no data'}`)
      }

      const inserted = newTag as DbTag
      tags.push(inserted)
      resolved.push({ id: inserted.id, canonicalName: inserted.canonical_name })
    }
  }

  if (resolved.length > 0) {
    await db
      .from('card_tags')
      .upsert(
        resolved.map(t => ({ card_id: cardId, tag_id: t.id })),
        { onConflict: 'card_id,tag_id', ignoreDuplicates: true },
      )
  }

  return resolved
}
