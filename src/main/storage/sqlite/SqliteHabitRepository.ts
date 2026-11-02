import type { HabitObservation } from '@shared/types/domain';
import type { HabitRepository } from '../repositories';
import type { Database } from './Database';
import { mapHabit } from './rows';

const SELECT_HABIT = `
SELECT o.feature_kind, o.feature_value, o.preset_id, p.name AS preset_name,
       o.polarity, o.hits, o.last_seen_at
  FROM habit_observation o
  JOIN preset p ON p.id = o.preset_id
`;

/** 学习次数。同一片段、同一预设、同一极性再记一次，就把 hits 加一。 */
export class SqliteHabitRepository implements HabitRepository {
  constructor(private readonly database: Database) {}

  /** 记一次肯定或否定。 */
  record(input: {
    featureKind: HabitObservation['featureKind'];
    featureValue: string;
    presetId: number;
    polarity: 'positive' | 'negative';
    at: number;
  }): Promise<void> {
    this.database.raw
      .prepare(
        `INSERT INTO habit_observation (
           feature_kind, feature_value, preset_id, polarity, hits, last_seen_at
         ) VALUES (?, ?, ?, ?, 1, ?)
         ON CONFLICT(feature_kind, feature_value, preset_id, polarity)
         DO UPDATE SET hits = hits + 1, last_seen_at = excluded.last_seen_at`
      )
      .run(input.featureKind, input.featureValue, input.presetId, input.polarity, input.at);
    return Promise.resolve();
  }

  /** 全部观测，给学习和设置页用。 */
  listAll(): Promise<HabitObservation[]> {
    return Promise.resolve(this.rows(`${SELECT_HABIT} ORDER BY o.id ASC`));
  }

  /** 肯定次数达到门槛的观测。 */
  listPromotable(threshold: number): Promise<HabitObservation[]> {
    return Promise.resolve(this.rows(`${SELECT_HABIT} WHERE o.polarity = 'positive' AND o.hits >= ?`, [threshold]));
  }

  /** 否定次数达到门槛的观测。 */
  listDemotable(threshold: number): Promise<HabitObservation[]> {
    return Promise.resolve(this.rows(`${SELECT_HABIT} WHERE o.polarity = 'negative' AND o.hits >= ?`, [threshold]));
  }

  private rows(sql: string, params: unknown[] = []): HabitObservation[] {
    const result = this.database.raw.prepare(sql).all(...params) as Array<{
      feature_kind: HabitObservation['featureKind'];
      feature_value: string;
      preset_id: number;
      preset_name: string;
      polarity: HabitObservation['polarity'];
      hits: number;
      last_seen_at: number;
    }>;
    return result.map(mapHabit);
  }
}
