// 공개 사이트 클라이언트 사이드 실시간 조회 훅 — 재빌드 없이 최신 published 데이터 반영
'use client'

import { useEffect, useState } from 'react'
import {
  getPublishedCards,
  getAllTags,
  getCardBySlug,
  type CardListItem,
  type CardDetail,
  type TagItem,
} from './cards'

type AsyncState<T> = { data: T; loading: boolean; error: Error | null }

/**
 * published 카드 목록. tag 지정 시 해당 태그로 필터.
 * `initial`(SSG 데이터)이 있으면 즉시 표시 후 재조회로 최신화한다.
 */
export function usePublishedCards(
  tag?: string,
  initial: CardListItem[] = [],
): AsyncState<CardListItem[]> {
  const [state, setState] = useState<AsyncState<CardListItem[]>>({
    data: initial,
    loading: initial.length === 0,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    getPublishedCards(tag)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: toError(error) }))
      })
    return () => {
      cancelled = true
    }
  }, [tag])

  return state
}

/** published 카드에 달린 태그 목록. */
export function useAllTags(): AsyncState<TagItem[]> {
  const [state, setState] = useState<AsyncState<TagItem[]>>({
    data: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    getAllTags()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: [], loading: false, error: toError(error) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}

/**
 * 단일 카드 상세. `initial`(SSG 데이터)이 있으면 즉시 표시 후 마운트 시 재조회해
 * 최신 내용으로 교체한다 (기존 카드 수정분 즉시 반영). null이면 미발견 상태.
 */
export function useCardDetail(
  platform: string,
  slug: string,
  initial: CardDetail | null = null,
): AsyncState<CardDetail | null> {
  const [state, setState] = useState<AsyncState<CardDetail | null>>({
    data: initial,
    loading: initial === null,
    error: null,
  })

  useEffect(() => {
    let cancelled = false
    getCardBySlug(platform, slug)
      .then((data) => {
        // 재조회 결과가 null(비공개 전환 등)이면 초기값을 유지한다
        if (!cancelled) setState((s) => ({ data: data ?? s.data, loading: false, error: null }))
      })
      .catch((error: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, loading: false, error: toError(error) }))
      })
    return () => {
      cancelled = true
    }
  }, [platform, slug])

  return state
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
