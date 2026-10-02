using System.Windows.Automation;
internal static partial class Program {
  private static object SelectedText(){
    CheckDesktop();stage="selected-text";var target=GetForegroundWindow();GetWindowThreadProcessId(target,out var pid);
    var name=System.Diagnostics.Process.GetProcessById((int)pid).ProcessName;
    if(new[]{"CredentialUIBroker","consent","LockApp","KeePass","1Password","Bitwarden"}.Contains(name,StringComparer.OrdinalIgnoreCase))throw new InvalidOperationException("Aplicación protegida.");
    var focused=AutomationElement.FocusedElement;if(focused==null||focused.Current.ProcessId!=pid||focused.Current.IsPassword)return new{text="",source="",pid,id=target.ToInt64().ToString()};
    var title=new System.Text.StringBuilder(256);GetWindowText(target,title,title.Capacity);
    // Only selected ranges of the focused control. No document scrape or Ctrl+C.
    var parts=new List<string>();var node=focused;
    for(var depth=0;node!=null&&depth<5&&node.Current.ProcessId==pid;depth++,node=TreeWalker.ControlViewWalker.GetParent(node)){
      if(node.Current.IsPassword)break;
      if(node.TryGetCurrentPattern(TextPattern.Pattern,out var value)){
        foreach(var range in ((TextPattern)value).GetSelection().Take(4)){var text=range.GetText(4000);if(!string.IsNullOrWhiteSpace(text))parts.Add(text);}
        if(parts.Count>0)break;
      }
    }
    var selected=string.Join("\n",parts);return new{text=selected[..Math.Min(4000,selected.Length)],source=title.ToString(),pid,id=target.ToInt64().ToString()};
  }
}
