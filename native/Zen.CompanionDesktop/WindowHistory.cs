// Assistant surfaces are destinations for review, never return targets. The
// installed OpenAI.Codex package currently runs as ChatGPT.exe on Windows.
static class WindowHistory {
 public static bool IsAssistant(string name) => name.Equals("Codex",StringComparison.OrdinalIgnoreCase)||name.Equals("ChatGPT",StringComparison.OrdinalIgnoreCase);
 public static (WindowId? id,string? name) Observe((WindowId? id,string? name) previous,WindowId id,string name) => IsAssistant(name)?previous:(id,name);
 public static object Verify(){
  var chrome=new WindowId("100",10,"1000");var otherChrome=new WindowId("101",10,"1000");
  var history=Observe((null,null),chrome,"chrome");
  history=Observe(history,new("200",20,"2000"),"ChatGPT");var chatGptKeptChrome=history.id==chrome&&history.name=="chrome";
  history=Observe(history,new("201",20,"2000"),"Codex");var codexKeptChrome=history.id==chrome;
  history=Observe(history,otherChrome,"chrome");var distinctBrowserWindow=history.id==otherChrome;
  return new{chatGptKeptChrome,codexKeptChrome,distinctBrowserWindow,caseInsensitive=IsAssistant("chatgpt")&&IsAssistant("CODEX"),doesNotExcludeWorkApps=!IsAssistant("chrome")&&!IsAssistant("ChatGPTNotes")};
 }
}
