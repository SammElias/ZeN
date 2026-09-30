import { spawn } from 'node:child_process';
const child = spawn('dotnet', ['publish', 'native/Zen.Windows/Zen.Windows.csproj', '--configuration', 'Release', '--output', 'dist/native', '--nologo', '--self-contained', 'false'], { stdio: 'inherit', windowsHide: true });
child.on('error', () => { console.error('Hace falta .NET SDK 10 para compilar el auxiliar Windows.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
