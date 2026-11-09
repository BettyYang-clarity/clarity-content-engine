const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const targetBat = path.join(__dirname, 'start-app.bat');
const workingDir = __dirname;

// VBScript uses WScript.Shell SpecialFolders("Desktop") which directly resolves the localized path (e.g. OneDrive\桌面)
// Note: We use UTF-16LE / ANSI safe VBScript, keeping string literals in ASCII where possible.
const vbsScript = [
  'Set oWS = CreateObject("WScript.Shell")',
  'strDesktop = oWS.SpecialFolders("Desktop")',
  'sLinkFile = strDesktop & "\\Clarity Content Engine.lnk"',
  'Set oLink = oWS.CreateShortcut(sLinkFile)',
  'oLink.TargetPath = "' + targetBat.replace(/\\/g, '\\') + '"',
  'oLink.WorkingDirectory = "' + workingDir.replace(/\\/g, '\\') + '"',
  'oLink.WindowStyle = 1',
  'oLink.Description = "Clarity Content Engine"',
  'oLink.IconLocation = "shell32.dll, 43"',
  'oLink.Save',
  'WScript.Echo "SUCCESS:" & sLinkFile'
].join('\r\n');

const tempVbs = path.join(__dirname, 'create_lnk.vbs');
// Write as UTF-8 or ANSI
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
