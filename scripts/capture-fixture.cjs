// Fixed offline fixture. Never reads user data or injects input.
const {app,BrowserWindow}=require('electron');
const {join}=require('node:path');
app.setPath('userData',join(app.getPath('temp'),'zen-capture-fixture-'+process.pid));
app.whenReady().then(async()=>{
 const window=new BrowserWindow({title:'Referencia de captura',x:120,y:180,width:720,height:460,show:false,alwaysOnTop:true,autoHideMenuBar:true,backgroundColor:'#2d6789',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><title>Referencia de captura</title><style>html,body{margin:0;height:100%;background:#2d6789;color:white;font:24px system-ui}h1{padding:36px;margin:0}</style><h1>Referencia local · 739162</h1>'));
 window.show();window.focus();
 console.log(JSON.stringify({id:window.getNativeWindowHandle().readBigUInt64LE().toString(),pid:process.pid,visible:window.isVisible(),minimized:window.isMinimized(),bounds:window.getBounds()}));
 process.stdin.setEncoding('utf8');process.stdin.on('data',command=>{if(command.includes('quit'))app.quit();if(command.includes('front')){window.show();window.focus();}});
});
app.on('window-all-closed',()=>app.quit());
