type Registry={register:(key:string,callback:()=>void)=>boolean;unregister:(key:string)=>void};
/** Register all new bindings before releasing old ones; failed updates keep working shortcuts. */
export class ShortcutSet {
  private keys=new Map<string,string>();
  constructor(private registry:Registry,private callbacks:Record<string,()=>void>){}
  has(name:string){return this.keys.has(name);}
  apply(next:Record<string,string>){
    const canonical=(key:string)=>key.toLowerCase().replace(/ctrl/g,'control').replace(/commandorcontrol/g,'control').split('+').sort().join('+');
    if(new Set(Object.values(next).map(canonical)).size!==Object.keys(next).length)return false;
    const added:string[]=[];
    try{
      for(const [name,key] of Object.entries(next)){
        if(this.keys.get(name)===key)continue;
        // Swapping active shortcuts is rejected rather than leaving a window without controls.
        if([...this.keys.values()].some(old=>canonical(old)===canonical(key)))throw Error();
        if(!this.registry.register(key,this.callbacks[name]))throw Error();
        added.push(key);
      }
    }catch{added.forEach(key=>this.registry.unregister(key));return false;}
    for(const [name,key] of this.keys)if(next[name]!==key)this.registry.unregister(key);
    this.keys=new Map(Object.entries(next));return true;
  }
}
