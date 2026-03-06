' ============================================
' Criar atalhos no Desktop para iniciar o servidor
' Executa como Administrador para ambas as contas
' ============================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

batPath = "c:\Users\Administrador\Desktop\prospeccao\projeto\iniciar-servidor.bat"
iconPath = "c:\Windows\System32\shell32.dll"

' Lista de desktops onde colocar o atalho
Dim desktops(1)
desktops(0) = "C:\Users\Administrador\Desktop"
desktops(1) = "C:\Users\manel\Desktop"

For Each desktop In desktops
    If fso.FolderExists(desktop) Then
        shortcutPath = desktop & "\Prospeccao WhatsApp.lnk"
        Set shortcut = WshShell.CreateShortcut(shortcutPath)
        shortcut.TargetPath = batPath
        shortcut.WorkingDirectory = "c:\Users\Administrador\Desktop\prospeccao\projeto"
        shortcut.WindowStyle = 1
        shortcut.IconLocation = iconPath & ",13"
        shortcut.Description = "Iniciar servidor Prospeccao WhatsApp (Docker + WPPConnect + Tunnel)"
        shortcut.Save
        WScript.Echo "✅ Atalho criado em: " & shortcutPath
    Else
        WScript.Echo "⚠️ Pasta nao encontrada: " & desktop
    End If
Next

WScript.Echo ""
WScript.Echo "Pronto! Atalhos criados com sucesso."
