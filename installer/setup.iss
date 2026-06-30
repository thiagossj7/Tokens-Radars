; Instalador grafico de Radar de Tokens (Vegeta).
; Reemplaza instalar.bat/instalar.ps1: sin ventanas de consola en ningun momento.
; Compilar con: ISCC installer\setup.iss  (genera ..\RadarDeTokens-Setup.exe)

[Setup]
AppId={{7E2B9F3A-4C6D-4E18-9A2F-6B1D8C5E3F09}
AppName=Radar de Tokens
AppVersion=1.0
AppPublisher=thiagossj7
DefaultDirName={localappdata}\RadarDeTokens
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
WizardStyle=classic
OutputDir=..
OutputBaseFilename=RadarDeTokens-Setup
Compression=lzma
SolidCompression=yes
WizardImageFile=assets\wizard-image.bmp
WizardSmallImageFile=assets\wizard-small.bmp
WizardImageStretch=no
LicenseFile=..\LICENSE
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=Radar de Tokens

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
Source: "..\server\*"; DestDir: "{app}\server"; Excludes: "node.exe"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\extension\*"; DestDir: "{app}\extension"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "scripts\detener-servidor.ps1"; DestDir: "{app}\instalador"; Flags: ignoreversion
Source: "scripts\buscar-node.ps1"; DestDir: "{tmp}"; Flags: dontcopy
Source: "scripts\descargar-node.ps1"; DestDir: "{tmp}"; Flags: dontcopy
Source: "scripts\preparar-claude.ps1"; DestDir: "{tmp}"; Flags: dontcopy
Source: "scripts\registrar-tarea.ps1"; DestDir: "{tmp}"; Flags: dontcopy
Source: "scripts\verificar-servidor.ps1"; DestDir: "{tmp}"; Flags: dontcopy

[Run]
Filename: "{app}\extension"; Description: "Abrir la carpeta de la extension"; Flags: postinstall shellexec skipifsilent nowait

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
const
  NodeDownloadUrl = 'https://nodejs.org/dist/latest-v22.x/win-x64/node.exe';

var
  PorcentajeSesion: String;
  PorcentajeSemana: String;
  EstadoServidor: String;

{ ---------- Utilidades ---------- }

function NombreParametro(Nombre, ValorPorDefecto: String): String;
begin
  Result := ExpandConstant('{param:' + Nombre + '|' + ValorPorDefecto + '}');
end;

function NombreTarea(): String;
begin
  Result := NombreParametro('TaskName', 'RadarDeTokens');
end;

function RutaArchivoLog(): String;
begin
  Result := ExpandConstant('{app}\instalador.log');
end;

procedure Log(Mensaje: String);
begin
  SaveStringToFile(RutaArchivoLog(),
    GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':') + '  ' + Mensaje + #13#10, True);
  if Assigned(WizardForm) then
    WizardForm.StatusLabel.Caption := Mensaje;
end;

procedure AvanzarProgreso(Valor: Integer);
begin
  if Assigned(WizardForm) then
  begin
    WizardForm.ProgressGauge.Style := npbstNormal;
    WizardForm.ProgressGauge.Position := Valor;
  end;
end;

procedure ProgresoIndeterminado(Activo: Boolean);
begin
  if Assigned(WizardForm) then
  begin
    if Activo then
      WizardForm.ProgressGauge.Style := npbstMarquee
    else
      WizardForm.ProgressGauge.Style := npbstNormal;
  end;
end;

function LeerArchivo(Ruta: String): String;
var
  Contenido: AnsiString;
begin
  Result := '';
  if FileExists(Ruta) then
  begin
    LoadStringFromFile(Ruta, Contenido);
    Result := Trim(String(Contenido));
  end;
end;

function ExtraerCampo(Linea: String; Indice: Integer): String;
var
  Pos1, Pos2, i: Integer;
  Resto: String;
begin
  Resto := Linea;
  for i := 1 to Indice do
  begin
    Pos1 := Pos('|', Resto);
    if Pos1 = 0 then
    begin
      Result := '';
      exit;
    end;
    Resto := Copy(Resto, Pos1 + 1, Length(Resto));
  end;
  Pos2 := Pos('|', Resto);
  if Pos2 = 0 then
    Result := Resto
  else
    Result := Copy(Resto, 1, Pos2 - 1);
end;

function EjecutarOculto(Comando: String): Integer;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'), Comando, '',
    SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := ResultCode;
end;

function EjecutarScriptOculto(RutaScript, Argumentos: String): Integer;
begin
  Result := EjecutarOculto('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' +
    RutaScript + '" ' + Argumentos);
end;

{ ---------- Credenciales ---------- }

function ObtenerCredencialesPath(): String;
var
  RutaForzada, RutaPrincipal, RutaAlterna: String;
begin
  RutaForzada := NombreParametro('CredsPathOverride', '');
  if RutaForzada <> '' then
  begin
    Result := RutaForzada;
    exit;
  end;
  RutaPrincipal := ExpandConstant('{%USERPROFILE}\.claude\.credentials.json');
  RutaAlterna := ExpandConstant('{%USERPROFILE}\.config\claude\.credentials.json');
  if FileExists(RutaPrincipal) then
    Result := RutaPrincipal
  else
    Result := RutaAlterna;
end;

function HayCredenciales(): Boolean;
begin
  Result := FileExists(ObtenerCredencialesPath());
end;

{ ---------- Node.js ---------- }

function ResolverNode(): String;
var
  ScriptBuscar, ScriptDescargar, ArchivoSalida, RutaPortable: String;
begin
  Log('Buscando Node.js en el sistema...');
  ExtractTemporaryFile('buscar-node.ps1');
  ScriptBuscar := ExpandConstant('{tmp}\buscar-node.ps1');
  ArchivoSalida := ExpandConstant('{tmp}\node-path.txt');
  DeleteFile(ArchivoSalida);

  EjecutarScriptOculto(ScriptBuscar, '-ArchivoSalida "' + ArchivoSalida + '"');

  Result := LeerArchivo(ArchivoSalida);
  if (Result <> '') and FileExists(Result) then
  begin
    Log('Node.js encontrado: ' + Result);
    exit;
  end;

  Log('Node.js no encontrado. Descargando version portable...');
  RutaPortable := ExpandConstant('{app}\server\node.exe');
  ExtractTemporaryFile('descargar-node.ps1');
  ScriptDescargar := ExpandConstant('{tmp}\descargar-node.ps1');
  DeleteFile(RutaPortable + '.ok');

  ProgresoIndeterminado(True);
  EjecutarScriptOculto(ScriptDescargar,
    '-Destino "' + RutaPortable + '" -Url "' + NodeDownloadUrl + '"');
  ProgresoIndeterminado(False);

  if LeerArchivo(RutaPortable + '.ok') = '1' then
  begin
    Log('Node.js portable descargado en ' + RutaPortable);
    Result := RutaPortable;
  end
  else
  begin
    Log('ERROR: no se pudo descargar Node.js portable.');
    Result := '';
  end;
end;

{ ---------- Login de Claude ---------- }

function EsperarCredenciales(): Boolean;
var
  ScriptPreparar, ArchivoSalida, EstadoLogin: String;
  IntentosMax, Intentos: Integer;
  SigueEsperando: Boolean;
begin
  if HayCredenciales() then
  begin
    Log('Credenciales de Claude encontradas.');
    Result := True;
    exit;
  end;

  Log('No hay credenciales de Claude. Preparando login...');
  ExtractTemporaryFile('preparar-claude.ps1');
  ScriptPreparar := ExpandConstant('{tmp}\preparar-claude.ps1');
  ArchivoSalida := ExpandConstant('{tmp}\claude-login.txt');
  DeleteFile(ArchivoSalida);

  EjecutarScriptOculto(ScriptPreparar, '-ArchivoSalida "' + ArchivoSalida + '"');

  EstadoLogin := LeerArchivo(ArchivoSalida);
  if Pos('ERROR', EstadoLogin) = 1 then
  begin
    Log(EstadoLogin);
    Result := False;
    exit;
  end;

  Log('Se abrio tu navegador para iniciar sesion en Claude. Completa el login...');

  SigueEsperando := True;
  Result := False;
  while SigueEsperando do
  begin
    ProgresoIndeterminado(True);
    IntentosMax := 150; { 150 x 2s = 5 minutos }
    Intentos := 0;
    while (Intentos < IntentosMax) and (not HayCredenciales()) do
    begin
      Sleep(2000);
      Intentos := Intentos + 1;
    end;
    ProgresoIndeterminado(False);

    if HayCredenciales() then
    begin
      Log('Login de Claude detectado.');
      Result := True;
      SigueEsperando := False;
    end
    else
    begin
      if MsgBox('No detectamos el login de Claude despues de 5 minutos.' + #13#10 +
                'Completa el inicio de sesion en el navegador y presiona Reintentar,' + #13#10 +
                'o Cancelar para seguir luego corriendo "claude" desde una terminal.',
                mbConfirmation, MB_RETRYCANCEL) = IDCANCEL then
      begin
        Log('El usuario cancelo la espera del login.');
        SigueEsperando := False;
      end;
    end;
  end;
end;

{ ---------- Tarea programada y arranque ---------- }

procedure RegistrarTareaProgramada();
var
  ScriptTarea, ArchivoSalida, RutaVbs, CarpetaServidor: String;
begin
  Log('Registrando la tarea programada ' + NombreTarea() + '...');
  RutaVbs := ExpandConstant('{app}\server\start-hidden.vbs');
  CarpetaServidor := ExpandConstant('{app}\server');
  ExtractTemporaryFile('registrar-tarea.ps1');
  ScriptTarea := ExpandConstant('{tmp}\registrar-tarea.ps1');
  ArchivoSalida := ExpandConstant('{tmp}\tarea-resultado.txt');
  DeleteFile(ArchivoSalida);

  EjecutarScriptOculto(ScriptTarea,
    '-NombreTarea "' + NombreTarea() + '" -RutaVbs "' + RutaVbs +
    '" -CarpetaServidor "' + CarpetaServidor + '" -ArchivoSalida "' + ArchivoSalida + '"');

  if LeerArchivo(ArchivoSalida) = '1' then
    Log('Tarea programada registrada.')
  else
    Log('ERROR: no se pudo registrar la tarea programada.');
end;

procedure ArrancarServidor();
begin
  Log('Arrancando el servidor...');
  EjecutarOculto('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ' +
    '"Start-ScheduledTask -TaskName ''' + NombreTarea() + ''' -ErrorAction SilentlyContinue"');
end;

function VerificarServidor(): Boolean;
var
  ScriptVerificar, ArchivoSalida, Linea: String;
  Intentos: Integer;
begin
  Log('Verificando que el servidor responda...');
  ExtractTemporaryFile('verificar-servidor.ps1');
  ScriptVerificar := ExpandConstant('{tmp}\verificar-servidor.ps1');
  ArchivoSalida := ExpandConstant('{tmp}\verificar-resultado.txt');

  Result := False;
  Intentos := 0;
  while (Intentos < 10) and (not Result) do
  begin
    Sleep(1000);
    DeleteFile(ArchivoSalida);
    EjecutarScriptOculto(ScriptVerificar, '-ArchivoSalida "' + ArchivoSalida + '"');

    Linea := LeerArchivo(ArchivoSalida);
    if Pos('OK|', Linea) = 1 then
    begin
      PorcentajeSesion := ExtraerCampo(Linea, 1);
      PorcentajeSemana := ExtraerCampo(Linea, 2);
      Result := True;
    end;
    Intentos := Intentos + 1;
  end;

  if Result then
    Log('Servidor respondiendo. Sesion: ' + PorcentajeSesion + '% - Semana: ' + PorcentajeSemana + '%')
  else
    Log('ERROR: el servidor no respondio a tiempo.');
end;

{ ---------- Eventos del wizard ---------- }

procedure InitializeWizard();
begin
  WizardForm.WelcomeLabel1.Caption := 'Bienvenido al instalador de Radar de Tokens';
  WizardForm.WelcomeLabel2.Caption :=
    'Este asistente va a configurar el monitor de uso de Claude en tu equipo.' + #13#10#13#10 +
    'Vas a necesitar iniciar sesion con tu cuenta de Claude si todavia no lo hiciste.';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  RutaNode: String;
begin
  if CurStep = ssPostInstall then
  begin
    Log('=== Instalacion de Radar de Tokens iniciada ===');

    AvanzarProgreso(10);
    RutaNode := ResolverNode();

    AvanzarProgreso(35);
    if RutaNode = '' then
    begin
      Log('ERROR: no se pudo continuar sin Node.js.');
      MsgBox('No se pudo descargar Node.js. Revisa tu conexion a internet y volve a correr el instalador.',
        mbError, MB_OK);
      exit;
    end;

    EsperarCredenciales();

    AvanzarProgreso(60);
    RegistrarTareaProgramada();

    AvanzarProgreso(80);
    ArrancarServidor();

    AvanzarProgreso(95);
    if VerificarServidor() then
      EstadoServidor := 'ok'
    else
      EstadoServidor := 'error';

    AvanzarProgreso(100);
    Log('=== Instalacion finalizada ===');
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    if EstadoServidor = 'ok' then
      WizardForm.FinishedLabel.Caption :=
        'Listo. Uso actual - Sesion: ' + PorcentajeSesion + '% | Semana: ' + PorcentajeSemana + '%' + #13#10#13#10 +
        'Ultimo paso (manual): abri chrome://extensions, activa "Modo de desarrollador" y' + #13#10 +
        'carga sin empaquetar la carpeta: ' + ExpandConstant('{app}\extension')
    else
      WizardForm.FinishedLabel.Caption :=
        'La instalacion termino pero el servidor todavia no respondio.' + #13#10 +
        'Revisa ' + ExpandConstant('{app}\instalador.log') + ' para mas detalles.' + #13#10#13#10 +
        'Carpeta de la extension: ' + ExpandConstant('{app}\extension');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  ScriptDetener: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    EjecutarOculto('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ' +
      '"Unregister-ScheduledTask -TaskName ''' + NombreTarea() + ''' -Confirm:$false -ErrorAction SilentlyContinue"');

    ScriptDetener := ExpandConstant('{app}\instalador\detener-servidor.ps1');
    if FileExists(ScriptDetener) then
      EjecutarScriptOculto(ScriptDetener, '');
  end;
end;
