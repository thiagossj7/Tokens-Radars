' Lanza el servidor del Radar de Tokens sin ventana de consola.
' Lo usa la tarea programada "RadarDeTokens" para que el arranque sea invisible.
' Si existe un node.exe portable junto a este script (descargado por instalar.ps1),
' lo usa; si no, usa el node del PATH del sistema.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = carpeta
nodeLocal = carpeta & "\node.exe"
If fso.FileExists(nodeLocal) Then
  shell.Run """" & nodeLocal & """ server.js", 0, False
Else
  shell.Run "node server.js", 0, False
End If
