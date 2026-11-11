using System.Text.Json;
using Windows.Media;
using Windows.Media.Control;
using Windows.Storage.Streams;
using Windows.Graphics.Imaging;

// Windows media sessions only. No browser DOM, window titles, keys, focus, URLs or credentials.
if(args.Length==1&&args[0]=="--self-test"){NowPlayingSelection.VerifyFixtures();return;}
var json=new JsonSerializerOptions { PropertyNamingPolicy=JsonNamingPolicy.CamelCase };
GlobalSystemMediaTransportControlsSessionManager? manager=null;
var sessions=new Dictionary<string,GlobalSystemMediaTransportControlsSession>();
GlobalSystemMediaTransportControlsSession? selected=null;string? selectedId=null,art=null;
GlobalSystemMediaTransportControlsSession? observed=null;string? observedArt=null;
(string Title,string Artist,string Album)? artKey=null,observedArtKey=null;
int generation=0,selectedGeneration=-1;bool subscribed=false,manual=false;
string Clean(string? value)=>new((value??"").Where(c=>!char.IsControl(c)).Take(500).ToArray());
string Source(string id){
 var key=id.ToLowerInvariant();var known=key switch{
  "spotify.exe" or "spotifyab.spotifymusic_zpdnekdrzrea0!spotify"=>"Spotify",
  "chrome" or "chrome.exe"=>"Google Chrome",
  "microsoft edge" or "msedge" or "msedge.exe"=>"Microsoft Edge",
  "firefox" or "firefox.exe"=>"Firefox",
  "brave" or "brave.exe"=>"Brave",
  "opera" or "opera.exe"=>"Opera",
  "vivaldi" or "vivaldi.exe"=>"Vivaldi",
  _=>null
 };if(known is not null)return known;
 // Unknown publishers remain eligible. Display only their bounded app identity, without filesystem paths.
 var label=Clean(id.Replace('\\','/').Split('/').Last()).Trim();if(label.EndsWith(".exe",StringComparison.OrdinalIgnoreCase))label=label[..^4];
 return label.Length==0?"Reproductor de Windows":new string(label.Take(120).ToArray());
}
bool Browser(string source)=>source is "Google Chrome" or "Microsoft Edge" or "Firefox" or "Brave" or "Opera" or "Vivaldi";
(string Title,string Artist,string Album) TrackText(GlobalSystemMediaTransportControlsSessionMediaProperties props)
 =>(Clean(props.Title),Clean(props.Artist),Clean(props.AlbumTitle));
bool Playing(GlobalSystemMediaTransportControlsSession s){try{return s.GetPlaybackInfo().PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;}catch{return false;}}
bool Live()=>selected is not null&&selectedGeneration==Volatile.Read(ref generation)&&manager!.GetSessions().Any(s=>s.Equals(selected));
void Clear(){selected=null;selectedId=null;selectedGeneration=-1;artKey=null;art=null;manual=false;}
void Select(string token,GlobalSystemMediaTransportControlsSession session,int epoch,bool pinned){
 if(token!=selectedId){artKey=null;art=null;}
 selected=session;selectedId=token;selectedGeneration=epoch;manual=pinned;
}
object[] ListSessions()=>sessions.Select(pair=>{
 var name=Source(pair.Value.SourceAppUserModelId);
 return (object)new{id=pair.Key,name,browser=Browser(name)};
}).ToArray();
GlobalSystemMediaTransportControlsSession[] RefreshSessions(){
 var available=manager!.GetSessions().Take(16).ToArray();
 sessions=available.ToDictionary(session=>sessions.FirstOrDefault(pair=>pair.Value.Equals(session)).Key??Guid.NewGuid().ToString(),session=>session);
 return available;
}
async Task<string?> Artwork(GlobalSystemMediaTransportControlsSessionMediaProperties props){
 try{
  if(props.Thumbnail is null)return null;using var input=await props.Thumbnail.OpenReadAsync();if(input.Size>2097152)return null;
  var decoder=await BitmapDecoder.CreateAsync(input);if(decoder.PixelWidth==0||decoder.PixelHeight==0||decoder.PixelWidth>4096||decoder.PixelHeight>4096)return null;
  var ratio=Math.Min(1,256d/Math.Max(decoder.PixelWidth,decoder.PixelHeight));uint w=(uint)Math.Max(1,decoder.PixelWidth*ratio),h=(uint)Math.Max(1,decoder.PixelHeight*ratio);
  var pixels=await decoder.GetPixelDataAsync(BitmapPixelFormat.Bgra8,BitmapAlphaMode.Premultiplied,new BitmapTransform { ScaledWidth=w,ScaledHeight=h },ExifOrientationMode.IgnoreExifOrientation,ColorManagementMode.DoNotColorManage);
  using var output=new InMemoryRandomAccessStream();var encoder=await BitmapEncoder.CreateAsync(BitmapEncoder.PngEncoderId,output);encoder.SetPixelData(BitmapPixelFormat.Bgra8,BitmapAlphaMode.Premultiplied,w,h,96,96,pixels.DetachPixelData());await encoder.FlushAsync();if(output.Size>350000)return null;output.Seek(0);using var reader=new DataReader(output);await reader.LoadAsync((uint)output.Size);var bytes=new byte[(int)output.Size];reader.ReadBytes(bytes);return "data:image/png;base64,"+Convert.ToBase64String(bytes);
 }catch{return null;}
}
async Task<object> Read(){
 if(!Live()){Clear();throw new InvalidOperationException("stale");}
 var identity=selectedId;var epoch=selectedGeneration;var info=selected!.GetPlaybackInfo();var c=info.Controls;var props=await selected.TryGetMediaPropertiesAsync();var timeline=selected.GetTimelineProperties();
 var text=TrackText(props);if(text!=artKey){artKey=text;art=await Artwork(props);}
 if(!Live()||identity!=selectedId||epoch!=selectedGeneration)throw new InvalidOperationException("stale");
 var source=Source(selected.SourceAppUserModelId);
 return new { session=selectedId,source,browser=Browser(source),title=text.Title,artist=text.Artist,album=text.Album,artwork=art,playing=info.PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,shuffle=info.IsShuffleActive,repeat=info.AutoRepeatMode?.ToString().ToLowerInvariant(),positionMs=Math.Max(0,(timeline.Position-timeline.StartTime).TotalMilliseconds),durationMs=Math.Max(0,timeline.EndTime.TotalMilliseconds-timeline.StartTime.TotalMilliseconds),controls=new { play=c.IsPlayEnabled||c.IsPlayPauseToggleEnabled,pause=c.IsPauseEnabled||c.IsPlayPauseToggleEnabled,previous=c.IsPreviousEnabled,next=c.IsNextEnabled,shuffle=c.IsShuffleEnabled,repeat=c.IsRepeatEnabled } };
}
async Task<object> NowPlaying(){
 var available=manager!.GetSessions().ToArray();
 var candidate=NowPlayingSelection.Pick(available,observed,manager.GetCurrentSession(),Playing,s=>s.SourceAppUserModelId);
 if(candidate is null){observed=null;observedArtKey=null;observedArt=null;return new{track=(object?)null};}
 if(!candidate.Equals(observed)){observed=candidate;observedArtKey=null;observedArt=null;}
 // This read path never writes selected/selectedId/sessions or invokes playback controls.
 var props=await candidate.TryGetMediaPropertiesAsync();
 var text=TrackText(props);
 if(text!=observedArtKey){observedArtKey=text;observedArt=await Artwork(props);}
 if(!manager.GetSessions().Any(s=>s.Equals(candidate))||!Playing(candidate)){
  observed=null;observedArtKey=null;observedArt=null;return new{track=(object?)null};
 }
 var source=Source(candidate.SourceAppUserModelId);
 return new{track=(object)new{source,browser=Browser(source),title=text.Title,artist=text.Artist,album=text.Album,artwork=observedArt,playing=true}};
}
async Task<object> Snapshot(bool followSystem){
 var epoch=Volatile.Read(ref generation);
 var available=RefreshSessions();
 var retained=selectedId is not null&&sessions.TryGetValue(selectedId,out var existing)?existing:null;
 var pinned=manual&&!followSystem&&retained is not null;
 var current=manager!.GetCurrentSession();
 var candidate=pinned?retained:NowPlayingSelection.Pick(available,retained,current,Playing,s=>s.SourceAppUserModelId)
  ?? retained ?? (current is not null&&available.Contains(current)?current:null);
 if(candidate is null){Clear();return new{sessions=ListSessions(),track=(object?)null,manual};}
 var token=sessions.First(pair=>pair.Value.Equals(candidate)).Key;
 Select(token,candidate,epoch,pinned);
 return new{sessions=ListSessions(),track=await Read(),manual};
}
while(await Console.In.ReadLineAsync() is string line){
 int id=0;
 try{
  if(line.Length>2048)break;using var doc=JsonDocument.Parse(line);var req=doc.RootElement;id=req.GetProperty("id").GetInt32();var method=req.GetProperty("method").GetString();
  manager??=await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
  if(!subscribed){manager.SessionsChanged+=(_,__)=>Interlocked.Increment(ref generation);subscribed=true;}
  object result;
  if(method=="list"){
   Clear();sessions.Clear();RefreshSessions();result=new{sessions=ListSessions()};
  }else if(method=="snapshot"){
   result=await Snapshot(req.TryGetProperty("followSystem",out var follow)&&follow.ValueKind==JsonValueKind.True);
  }else if(method=="nowPlaying"){
   result=await NowPlaying();
  }else if(method=="select"){
   var token=req.GetProperty("session").GetString()!;if(!sessions.TryGetValue(token,out var s))throw new InvalidOperationException("stale");Select(token,s,Volatile.Read(ref generation),true);result=await Read();
  }else if(method=="read"||method=="action"){
   if(req.GetProperty("session").GetString()!=selectedId||!Live())throw new InvalidOperationException("stale");
   if(method=="read")result=await Read();else{
    var p=selected!.GetPlaybackInfo();var c=p.Controls;var action=req.GetProperty("action").GetString();var value=req.TryGetProperty("value",out var v)?v.GetString():null;
    bool accepted=action switch{
     "play" when c.IsPlayEnabled=>await selected.TryPlayAsync(),
     "pause" when c.IsPauseEnabled=>await selected.TryPauseAsync(),
     "play" when c.IsPlayPauseToggleEnabled=>p.PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing||await selected.TryTogglePlayPauseAsync(),
     "pause" when c.IsPlayPauseToggleEnabled=>p.PlaybackStatus!=GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing||await selected.TryTogglePlayPauseAsync(),
     "previous" when c.IsPreviousEnabled=>await selected.TrySkipPreviousAsync(),
     "next" when c.IsNextEnabled=>await selected.TrySkipNextAsync(),
     "shuffle" when c.IsShuffleEnabled&&value is "on" or "off"=>await selected.TryChangeShuffleActiveAsync(value=="on"),
     "repeat" when c.IsRepeatEnabled&&value is "off" or "all" or "one"=>await selected.TryChangeAutoRepeatModeAsync(value=="all"?MediaPlaybackAutoRepeatMode.List:value=="one"?MediaPlaybackAutoRepeatMode.Track:MediaPlaybackAutoRepeatMode.None),
     _=>throw new InvalidOperationException("unsupported")
    };result=new{accepted};
   }
  }else throw new InvalidOperationException("invalid");
  Console.WriteLine(JsonSerializer.Serialize(new{id,ok=true,result},json));
 }catch(InvalidOperationException e)when(new[]{"stale","unsupported","invalid"}.Contains(e.Message)){Console.WriteLine(JsonSerializer.Serialize(new{id,ok=false,error=e.Message}));}
 catch{Console.WriteLine(JsonSerializer.Serialize(new{id,ok=false,error="unavailable"}));}
 Console.Out.Flush();
}
