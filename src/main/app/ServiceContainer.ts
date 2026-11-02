/**
 * 组装主进程里的对象。
 * 数据库、仓储、整理进程、IPC 分发都在这里 new 出来，其它地方只接收构造好的依赖。
 */
import { DEFAULT_PREFERENCES } from '@shared/types/preferences';
import { AgentService } from '../agent/AgentService';
import { AppEvents } from '../core/events';
import { isPathInside } from '../core/paths';
import { MaterialQuery } from '../material/MaterialQuery';
import { PresetAdmin } from '../preset/PresetAdmin';
import { PresetTransfer } from '../preset/PresetTransfer';
import { Database } from '../storage/sqlite/Database';
import { SqliteAgentLogRepository } from '../storage/sqlite/SqliteAgentLogRepository';
import { SqliteAgentRoundRepository } from '../storage/sqlite/SqliteAgentRoundRepository';
import { SqliteHabitRepository } from '../storage/sqlite/SqliteHabitRepository';
import { SqliteMaterialRepository } from '../storage/sqlite/SqliteMaterialRepository';
import { SqliteOutcomeWriter } from '../storage/sqlite/SqliteOutcomeWriter';
import { SqlitePreferenceRepository } from '../storage/sqlite/SqlitePreferenceRepository';
import { SqlitePresetRepository } from '../storage/sqlite/SqlitePresetRepository';
import { InitializationService } from '../system/InitializationService';
import { HabitLearner } from '../userpref/HabitLearner';
import { UserHabitSet } from '../userpref/UserHabitSet';
import { AppActions } from './AppActions';
import { IpcDispatcher } from '../ipc/dispatcher';

/** 进程级对象图。整个应用只创建一次。 */
export class ServiceContainer {
  readonly events = new AppEvents();
  readonly database: Database;
  readonly agent: AgentService;
  readonly dispatcher: IpcDispatcher;
  private readonly habitSet: UserHabitSet;
  private readonly preferences: SqlitePreferenceRepository;
  private readonly presets: SqlitePresetRepository;

  constructor(version: string, dbPath: string, habitPath: string) {
    this.database = new Database(dbPath);
    this.preferences = new SqlitePreferenceRepository(this.database);
    this.presets = new SqlitePresetRepository(this.database);
    const materials = new SqliteMaterialRepository(this.database);
    const logs = new SqliteAgentLogRepository(this.database);
    const rounds = new SqliteAgentRoundRepository(this.database);
    const habits = new SqliteHabitRepository(this.database);
    const outcomes = new SqliteOutcomeWriter(this.database);
    this.habitSet = new UserHabitSet(habitPath);
    this.habitSet.start(() => this.presets.listSync());
    const learner = new HabitLearner(habits, this.presets, habitPath, this.habitSet);
    this.agent = new AgentService(
      this.events,
      this.presets,
      rounds,
      logs,
      materials,
      outcomes,
      this.habitSet,
      learner,
      { ...DEFAULT_PREFERENCES }
    );
    const query = new MaterialQuery(materials, this.presets, logs, rounds, this.preferences, this.events);
    const admin = new PresetAdmin(this.presets, materials, this.preferences, this.habitSet, this.events, this.agent);
    const transfer = new PresetTransfer(this.presets);
    const initialization = new InitializationService(
      this.database,
      this.preferences,
      this.presets,
      this.events,
      this.agent
    );
    const actions = new AppActions(
      version,
      this.preferences,
      this.presets,
      habits,
      this.habitSet,
      this.events,
      this.agent
    );
    this.dispatcher = new IpcDispatcher(
      actions,
      initialization,
      this.presets,
      admin,
      transfer,
      query,
      logs,
      rounds,
      this.agent
    );
  }

  /** 读出设置。数据目录若落在整理目录里面，拒绝启动。已初始化且允许开机整理时才 start。 */
  async boot(dataDir: string): Promise<void> {
    const prefs = await this.preferences.load();
    const targets = this.presets.listSync().map((preset) => preset.targetDir);
    const watched = [...prefs.watchFolders, prefs.unclassifiedDir, ...targets];
    for (const dir of watched) {
      if (dir.trim() !== '' && isPathInside(dataDir, dir)) {
        throw new Error('数据目录与整理目录重叠，请更换监视目录或归档位置');
      }
    }
    await this.agent.applyPreferences(prefs);
    if (prefs.initialized && prefs.agentEnabled) {
      await this.agent.start();
    }
  }

  /** 退出前停监听并关掉数据库。 */
  async shutdown(): Promise<void> {
    await this.agent.stopAndWait();
    this.habitSet.stop();
    this.database.close();
  }
}
