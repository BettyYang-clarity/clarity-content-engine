const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetBat = path.join(__dirname, 'start-app.bat');
const workingDir = __dirname;

const vbsScript = [
  'Set oWS = CreateObject("WScript.Shell")',
  'strDesktop = oWS.SpecialFolders("Desktop")',
  'Sub MakeLnk(dirPath)',
  '  On Error Resume Next',
  '  If dirPath <> "" Then',
  '    sLinkFile = dirPath & "\\Clarity Content Engine.lnk"',
  '    Set oLink = oWS.CreateShortcut(sLinkFile)',
  '    oLink.TargetPath = "' + targetBat.replace(/\\/g, '\\\\') + '"',
  '    oLink.WorkingDirectory = "' + workingDir.replace(/\\/g, '\\\\') + '"',
  '    oLink.WindowStyle = 1',
  '    oLink.Description = "Clarity Content Engine"',
  '    oLink.IconLocation = "shell32.dll, 43"',
  '    oLink.Save',
  '    WScript.Echo "SAVED:" & sLinkFile',
  '  End If',
  'End Sub',
  'MakeLnk strDesktop',
  'userProfile = oWS.ExpandEnvironmentStrings("%USERPROFILE%")',
  'MakeLnk userProfile & "\\Desktop"',
  'MakeLnk userProfile & "\\OneDrive\\Desktop"',
  'MakeLnk userProfile & "\\OneDrive\\桌面"'
].join('\r\n');

const tempVbs = path.join(__dirname, 'create_lnk.vbs');
fs.writeFileSync(tempVbs, vbsScript, 'utf8');

try {
  const result = execSync(`cscript //nologo "${tempVbs}"`).toString();
  console.log(result.trim());
} catch (err) {
  console.error('Failed to create shortcut:', err.message);
  process.exit(1);
} finally {
  if (fs.existsSync(tempVbs)) fs.unlinkSync(tempVbs);
}
