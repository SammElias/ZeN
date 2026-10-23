using System.IO.Pipes;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.Encodings.Web;

// Fixed, local relay inspired by Coucou's hook transport. Never executes commands.
// An unavailable/expired request returns no decision, leaving Codex's own prompt.
string stage="not-run",shape="none";string? eventName=null;
try {
 if (!args.Contains("--zen-companion")) return;
 using var readBudget = new CancellationTokenSource(1500);
 var raw = new StringBuilder();var buffer = new char[4096];int count;
 while ((count = await Console.In.ReadAsync(buffer.AsMemory(), readBudget.Token)) > 0) {raw.Append(buffer,0,count);if(raw.Length>1_000_000){Console.WriteLine("{}");return;}}
 var input=JsonNode.Parse(raw.ToString())!.AsObject();
 stage="parsed";shape=input["tool_input"] is JsonObject?"object":input["tool_input"] is JsonArray?"array":input["tool_input"] is JsonValue?"value":"none";
 string Str(string key)=>input[key]?.GetValue<string>()??"";
 var name=Str("hook_event_name");var session=Str("session_id");
 var events=new[]{"SessionStart","UserPromptSubmit","PreToolUse","PermissionRequest","PostToolUse","Stop","SubagentStart","SubagentStop","Interrupt","SessionEnd"};
 if(!events.Contains(name)||session.Length==0||session.Length>160){Console.WriteLine("{}");return;}
 eventName=name;
 var request=Guid.NewGuid().ToString();var e=new JsonObject { ["id"]=request,["event"]=name,["session"]=session,["cwd"]=Str("cwd") };
 if(Str("turn_id")!="")e["turn"]=Str("turn_id");if(Str("tool_name")!="")e["tool"]=Str("tool_name");
 // Never forward prompt, transcript, model output, credentials or file contents.
 // Only the requested operation is retained when needed for an explicit review.
 if(name=="PermissionRequest"&&input["tool_input"] is JsonNode tool){var preview=tool.ToJsonString(new(){WriteIndented=true,Encoder=JavaScriptEncoder.UnsafeRelaxedJsonEscaping});if(tool is JsonObject fields&&fields["command"] is JsonValue commandValue&&commandValue.TryGetValue<string>(out var commandText)){var remaining=fields.DeepClone().AsObject();remaining.Remove("command");preview=commandText+(remaining.Count>0?"\n\nParámetros adicionales:\n"+remaining.ToJsonString(new(){WriteIndented=true,Encoder=JavaScriptEncoder.UnsafeRelaxedJsonEscaping}):"");}e["truncated"]=preview.Length>64000;e["preview"]=preview.Length>64000?"Propuesta demasiado grande: revísala íntegra en Codex.":preview;}
 else if(name is "PreToolUse" or "PostToolUse"){
   // Local function and code-mode hooks can pass any JSON value, including a string.
   // Preserve the event even when there is no command object; never forward that raw input.
   string? command=null;
   if(input["tool_input"] is JsonObject toolFields&&toolFields["command"] is JsonValue value&&value.TryGetValue<string>(out var commandString))command=commandString;
   if(command is not null)e["preview"]=command.Length>12000?command[..12000]+"\n… Vista recortada; abre Codex para el detalle completo.":command;
 }
 if(name=="PostToolUse") {var response=input["tool_response"];e["failed"]=response is JsonObject o && (o["is_error"]?.ToString()=="true"||int.TryParse(o["exit_code"]?.ToString(),out var code)&&code!=0);}
 var config=JsonNode.Parse(await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory,"bridge.json")))!;
 var pipeName=config["pipe"]!.GetValue<string>();var token=config["token"]!.GetValue<string>();
 using var pipe=new NamedPipeClientStream(".",pipeName,PipeDirection.InOut,PipeOptions.Asynchronous);
 using var connect=new CancellationTokenSource(300);await pipe.ConnectAsync(connect.Token);
 using var budget=new CancellationTokenSource(name=="PermissionRequest"?110000:1500);
 using var writer=new StreamWriter(pipe,new UTF8Encoding(false),4096,true){AutoFlush=true};using var reader=new StreamReader(pipe,Encoding.UTF8,false,4096,true);
 await writer.WriteLineAsync(new JsonObject{["token"]=token,["event"]=e}.ToJsonString().AsMemory(),budget.Token);
 var reply=await reader.ReadLineAsync(budget.Token);var result=reply is null?null:JsonNode.Parse(reply);
 var decision=result?["decision"]?.ToString();
 stage=result?["id"]?.ToString()==request?"delivered":"not-acknowledged";
 if(name=="PermissionRequest"&&result?["id"]?.ToString()==request&&decision is "allow" or "deny")Console.WriteLine(new JsonObject{["hookSpecificOutput"]=new JsonObject{["hookEventName"]="PermissionRequest",["decision"]=new JsonObject{["behavior"]=decision}}}.ToJsonString());
 else Console.WriteLine("{}");
} catch (Exception error) { stage="failed:"+error.GetType().Name;Console.WriteLine("{}"); }
finally {
 // One bounded diagnostic record, without input, tool output, commands, tokens or remote messages.
 if(args.Contains("--zen-companion"))try{
  var path=Path.Combine(AppContext.BaseDirectory,"relay-status.json");var temporary=path+"."+Environment.ProcessId+".tmp";
  try{File.WriteAllText(temporary,new JsonObject{["at"]=DateTimeOffset.UtcNow.ToString("O"),["event"]=eventName,["shape"]=shape,["stage"]=stage}.ToJsonString());File.Move(temporary,path,true);}
  finally{if(File.Exists(temporary))File.Delete(temporary);}
 }catch{/* Diagnostics never block a hook or change its decision. */}
}
