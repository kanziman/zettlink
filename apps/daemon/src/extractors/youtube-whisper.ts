// 자막이 없는 영상에 한해 OpenAI whisper-1로 음성을 텍스트로 받는다. +whisper 명시 시에만 호출된다.
import { execa } from 'execa';
import { createReadStream } from 'node:fs';
import type OpenAI from 'openai';

export async function whisperTranscribe(url: string, workDir: string, openai: OpenAI, cookiesBrowser?: string): Promise<string> {
  const args = ['-x', '--audio-format', 'mp3', '-o', `${workDir}/audio.%(ext)s`];
  if (cookiesBrowser) args.push('--cookies-from-browser', cookiesBrowser);
  args.push(url);
  await execa('yt-dlp', args);
  const r = await openai.audio.transcriptions.create({
    file: createReadStream(`${workDir}/audio.mp3`) as any,
    model: 'whisper-1',
  });
  return r.text;
}
