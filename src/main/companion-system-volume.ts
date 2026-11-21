import {SystemVolumeAction, SystemVolumeState} from '../shared/companion-media';
import type {MediaRpc} from './companion-media';

export class CompanionSystemVolume {
  private rpc?: MediaRpc;
  private pending = false;

  constructor(private readonly factory: () => MediaRpc, private readonly visible: () => boolean,
    private readonly focused: () => boolean) {}

  async request(input: SystemVolumeAction) {
    const action = SystemVolumeAction.parse(input);
    if (!this.visible()) throw Error('Abre Sonido para consultar el volumen de Windows.');
    if (action.type === 'set' && !this.focused()) throw Error('Activa ZEN para ajustar el volumen.');
    if (this.pending) throw Error('El volumen se está actualizando.');
    const rpc = this.rpc ??= this.factory();
    this.pending = true;
    try {
      const value = action.type === 'read' ? await rpc.request('systemVolumeRead')
        : await rpc.request('systemVolumeSet', {level:action.level,endpoint:action.endpoint});
      if (this.rpc !== rpc || !this.visible()) throw Error('La vista de Sonido se cerró.');
      const result = SystemVolumeState.parse(value);
      if (action.type === 'set' && action.endpoint !== result.endpoint) throw Error('La salida de audio cambió.');
      return result;
    } catch (error) {
      if (this.rpc === rpc) this.close();
      throw error;
    } finally {
      if (this.rpc === rpc) this.pending = false;
    }
  }

  close() {
    this.rpc?.close();
    this.rpc = undefined;
    this.pending = false;
  }
}
