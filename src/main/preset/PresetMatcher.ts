/**
 * 预设匹配是纯函数：只看文件名、扩展名、大小，不读磁盘，也不看现在几点。
 *
 * 做法分三步：
 * 1. 硬淘汰：没启用、类型不符、踩了排除词、超过大小，直接出局。
 * 2. 在剩下的预设里分三层，只取最高的那一层：
 *    名字+类型  >  仅名字  >  仅类型。
 *    有名字条件但这次没对上的，不能退回去当「仅类型」。
 * 3. 同一层里：优先级数字小的赢，其次命中片段更长，再其次 id 更小。
 */
import type { HitKind, MatchResult, Preset } from '@shared/types/domain';
import { codePointLength, fileStem } from '../model/naming';

/** 比较用的规范化：NFC、去首尾空白、转小写。不用本机语言的大小写规则。 */
export function norm(value: string): string {
  return value.normalize('NFC').trim().toLowerCase();
}

/** 按中英文逗号切开。去掉空片段和少于 2 个码点的片段，避免单字命中一切。 */
export function splitTerms(raw: string | null): string[] {
  if (raw === null || raw.trim() === '') {
    return [];
  }
  const terms: string[] = [];
  for (const piece of raw.split(/[,，]/)) {
    const term = norm(piece);
    if (codePointLength(term) < 2) {
      continue;
    }
    terms.push(term);
  }
  return terms;
}

interface NameHit {
  token: string;
  kind: 'includes' | 'starts' | 'ends';
}

interface Ranked {
  preset: Preset;
  hitToken: string;
  hitKind: HitKind;
  tokenLength: number;
}

const KIND_RANK: Record<NameHit['kind'], number> = {
  includes: 0,
  starts: 1,
  ends: 2
};

function hasPositiveName(preset: Preset): boolean {
  return (
    splitTerms(preset.nameIncludes).length +
      splitTerms(preset.nameStarts).length +
      splitTerms(preset.nameEnds).length >
    0
  );
}

function passesHard(preset: Preset, fileName: string, extension: string, sizeBytes: number): boolean {
  if (!preset.enabled) {
    return false;
  }
  const extensions = splitTerms(preset.extensions);
  if (extensions.length > 0 && !extensions.includes(norm(extension))) {
    return false;
  }
  const name = norm(fileName);
  for (const term of splitTerms(preset.nameExcludes)) {
    if (name.includes(term)) {
      return false;
    }
  }
  if (preset.maxSizeMb > 0 && sizeBytes > preset.maxSizeMb * 1024 * 1024) {
    return false;
  }
  return true;
}

function betterHit(current: NameHit, next: NameHit): NameHit {
  const lengthGap = codePointLength(next.token) - codePointLength(current.token);
  if (lengthGap !== 0) {
    return lengthGap > 0 ? next : current;
  }
  const kindGap = KIND_RANK[next.kind] - KIND_RANK[current.kind];
  if (kindGap !== 0) {
    return kindGap < 0 ? next : current;
  }
  return next.token < current.token ? next : current;
}

function matchName(fileName: string, preset: Preset): NameHit | null {
  const name = norm(fileName);
  const stem = norm(fileStem(fileName));
  let best: NameHit | null = null;
  const consider = (hit: NameHit | null): void => {
    if (hit === null) {
      return;
    }
    best = best === null ? hit : betterHit(best, hit);
  };
  for (const token of splitTerms(preset.nameIncludes)) {
    if (name.includes(token)) {
      consider({ token, kind: 'includes' });
    }
  }
  for (const token of splitTerms(preset.nameStarts)) {
    if (stem.startsWith(token)) {
      consider({ token, kind: 'starts' });
    }
  }
  for (const token of splitTerms(preset.nameEnds)) {
    if (stem.endsWith(token)) {
      consider({ token, kind: 'ends' });
    }
  }
  return best;
}

function byRank(left: Ranked, right: Ranked): number {
  if (left.preset.priority !== right.preset.priority) {
    return left.preset.priority - right.preset.priority;
  }
  if (left.tokenLength !== right.tokenLength) {
    return right.tokenLength - left.tokenLength;
  }
  return left.preset.id - right.preset.id;
}

function describe(
  tier: 'name-and-type' | 'name' | 'type',
  chosen: Ranked,
  extension: string,
  layerCount: number
): string {
  const name = chosen.preset.name;
  const token = chosen.hitToken;
  let text: string;
  if (tier === 'type') {
    text = `类型 .${extension} 由预设「${name}」接收`;
  } else if (tier === 'name-and-type' && chosen.hitKind === 'starts') {
    text = `文件名以「${token}」开头且类型 .${extension} → 预设「${name}」`;
  } else if (tier === 'name-and-type' && chosen.hitKind === 'ends') {
    text = `文件名以「${token}」结尾且类型 .${extension} → 预设「${name}」`;
  } else if (tier === 'name-and-type') {
    text = `文件名含「${token}」且类型 .${extension} → 预设「${name}」`;
  } else if (chosen.hitKind === 'starts') {
    text = `文件名以「${token}」开头 → 预设「${name}」`;
  } else if (chosen.hitKind === 'ends') {
    text = `文件名以「${token}」结尾 → 预设「${name}」`;
  } else {
    text = `文件名含「${token}」→ 预设「${name}」`;
  }
  if (layerCount > 1) {
    text += `（同层 ${layerCount} 个候选，按优先级/命中长度/id 选定）`;
  }
  return text;
}

function traceOf(candidateCount: number, tier: string, chosen: Ranked): string {
  const token = tier === 'type' ? '' : chosen.hitToken;
  const length = tier === 'type' ? 0 : chosen.tokenLength;
  return `候选 ${candidateCount} 个 | 命中层 ${tier} | 选中 preset#${chosen.preset.id}「${chosen.preset.name}」 | 命中「${token}」(${length} 字) | 优先级 ${chosen.preset.priority}`;
}

function miss(candidateCount: number): MatchResult {
  return {
    presetId: null,
    tier: 'none',
    hitToken: null,
    hitKind: 'none',
    reason: '无预设命中',
    trace: `候选 ${candidateCount} 个 | 无预设命中`,
    candidateCount
  };
}

/** 在已给定的预设列表里决定命中哪一条。列表之外的预设不会被看见。 */
export function matchPreset(
  input: { fileName: string; sizeBytes: number; extension: string },
  presets: Preset[]
): MatchResult {
  const extension = norm(input.extension);
  const survivors: Preset[] = [];
  for (const preset of presets) {
    if (passesHard(preset, input.fileName, extension, input.sizeBytes)) {
      survivors.push(preset);
    }
  }
  const candidateCount = survivors.length;
  const layers: Record<'name-and-type' | 'name' | 'type', Ranked[]> = {
    'name-and-type': [],
    name: [],
    type: []
  };
  for (const preset of survivors) {
    const named = hasPositiveName(preset);
    const typed = splitTerms(preset.extensions).length > 0;
    const hit = matchName(input.fileName, preset);
    if (named && typed && hit) {
      layers['name-and-type'].push({
        preset,
        hitToken: hit.token,
        hitKind: hit.kind,
        tokenLength: codePointLength(hit.token)
      });
    } else if (named && !typed && hit) {
      layers.name.push({
        preset,
        hitToken: hit.token,
        hitKind: hit.kind,
        tokenLength: codePointLength(hit.token)
      });
    } else if (!named && typed) {
      layers.type.push({
        preset,
        hitToken: '',
        hitKind: 'type',
        tokenLength: 0
      });
    }
  }
  const order: Array<'name-and-type' | 'name' | 'type'> = ['name-and-type', 'name', 'type'];
  for (const tier of order) {
    const layer = layers[tier];
    if (layer.length === 0) {
      continue;
    }
    const sorted = [...layer].sort(byRank);
    const chosen = sorted[0];
    if (!chosen) {
      continue;
    }
    return {
      presetId: chosen.preset.id,
      tier,
      hitToken: tier === 'type' ? null : chosen.hitToken,
      hitKind: chosen.hitKind,
      reason: describe(tier, chosen, extension, layer.length),
      trace: traceOf(candidateCount, tier, chosen),
      candidateCount
    };
  }
  return miss(candidateCount);
}
