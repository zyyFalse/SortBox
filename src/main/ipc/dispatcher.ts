/**
 * 唯一的 IPC 入口。
 * 渲染进程不能按方法名各开一条通道，全部走 sortbox:invoke，这里再分发。
 * 这样权限边界只有一处：校验参数，然后调用已经写好的服务。
 */
import type { AgentService } from '../agent/AgentService';
import type { AppActions } from '../app/AppActions';
import type { MaterialQuery } from '../material/MaterialQuery';
import type { PresetAdmin } from '../preset/PresetAdmin';
import type { PresetTransfer } from '../preset/PresetTransfer';
import type { PresetRepository, AgentLogRepository, AgentRoundRepository } from '../storage/repositories';
import type { InitializationService } from '../system/InitializationService';
import { openPath, pickDirectory, revealPath } from '../system/shellActions';
import { parseArgs } from './schemas';

/** 分发 invoke 调用。 */
export class IpcDispatcher {
  constructor(
    private readonly appActions: AppActions,
    private readonly initialization: InitializationService,
    private readonly presets: PresetRepository,
    private readonly presetAdmin: PresetAdmin,
    private readonly transfer: PresetTransfer,
    private readonly materials: MaterialQuery,
    private readonly logs: AgentLogRepository,
    private readonly rounds: AgentRoundRepository,
    private readonly agent: AgentService
  ) {}

  /** 执行一个已经校验过名字的方法。 */
  async invoke(payload: unknown): Promise<unknown> {
    if (!payload || typeof payload !== 'object') {
      throw new Error('参数非法：invoke');
    }
    const body = payload as { method?: unknown; args?: unknown };
    if (typeof body.method !== 'string') {
      throw new Error('参数非法：invoke');
    }
    const args = parseArgs(body.method, body.args);
    return this.dispatch(body.method, args);
  }

  private async dispatch(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case 'getAppInfo':
        return this.appActions.getAppInfo();
      case 'pickDirectory':
        return pickDirectory(String(args[0]));
      case 'openPath':
        return openPath(String(args[0]));
      case 'revealPath':
        revealPath(String(args[0]));
        return null;
      case 'getPreferences':
        return this.appActions.getPreferences();
      case 'savePreferences':
        return this.appActions.savePreferences(args[0] as never);
      case 'completeInitialization':
        return this.initialization.complete(args[0] as never);
      case 'resetInitialization':
        return this.initialization.reset();
      case 'listPresets':
        return this.presets.list();
      case 'getPreset':
        return this.presets.getById(args[0] as number);
      case 'savePreset':
        return this.presetAdmin.save(args[0] as never);
      case 'deletePreset':
        return this.presetAdmin.remove(args[0] as number);
      case 'setPresetEnabled':
        return this.presetAdmin.setEnabled(args[0] as number, args[1] as boolean);
      case 'listPresetTemplates':
        return this.presetAdmin.listTemplates();
      case 'exportPreset':
        return this.transfer.exportPreset(args[0] as number);
      case 'importPreset':
        return this.transfer.importPreset();
      case 'previewMatch':
        return this.presetAdmin.preview(String(args[0]), args[1] as never);
      case 'suggestPresetFromMaterial':
        return this.presetAdmin.suggestFromMaterial(args[0] as number);
      case 'listUnclassified':
        return this.materials.listUnclassified();
      case 'unclassifiedSummary':
        return this.materials.unclassifiedSummary();
      case 'releaseHeld':
        return this.agent.releaseHeld(args[0] as number);
      case 'queryMaterials':
        return this.materials.query(args[0] as never);
      case 'getMaterialDetail':
        return this.materials.detail(args[0] as number);
      case 'listMaterialLogs':
        return this.logs.listByMaterial(args[0] as number);
      case 'setFavorite':
        return this.materials.setFavorite(args[0] as number, args[1] as boolean);
      case 'computeSha256':
        return this.materials.computeSha256(args[0] as number);
      case 'getAgentSnapshot':
        return this.agent.snapshot();
      case 'getAgentStats':
        return this.materials.stats();
      case 'getLatestRound':
        return this.rounds.latest();
      case 'listRecentRounds':
        return this.rounds.listRecent(args[0] as number);
      case 'listRoundLogs':
        return this.logs.listByRound(args[0] as number);
      case 'startAgent':
        return this.agent.start();
      case 'stopAgent':
        return this.agent.stop();
      case 'pauseAgent':
        return this.agent.pause();
      case 'resumeAgent':
        return this.agent.resume();
      case 'setDryRun':
        return this.appActions.setDryRun(args[0] as boolean);
      case 'runNow':
        return this.agent.runNow();
      case 'queryLogs':
        return this.logs.query(args[0] as never);
      case 'listRecentLogs':
        return this.logs.listRecent(args[0] as number);
      case 'undoLog':
        return this.agent.undo.undoLog(args[0] as number);
      case 'undoLatest':
        return this.agent.undo.undoLatest();
      case 'getHabitDiagnostics':
        return this.appActions.getHabitDiagnostics();
      case 'reloadHabits':
        return this.appActions.reloadHabits();
      case 'openUserMd':
        return this.appActions.openUserMd();
      case 'revealUserMd':
        return this.appActions.revealUserMd();
      case 'listHabitObservations':
        return this.appActions.listHabitObservations();
      default:
        throw new Error(`参数非法：${method}`);
    }
  }
}
