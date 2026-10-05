# NIKU Admin para Android

Aplicación Android privada que abre directamente el panel `/admin` de NIKU MD dentro de un WebView.

- URL: `https://web-niku-md-eye-production.up.railway.app/#admin`
- Solo permite navegar dentro del dominio del panel.
- JavaScript, almacenamiento local y cookies están habilitados para el inicio de sesión del panel.
- No contiene contraseñas, tokens ni credenciales.

## Compilación

Desde esta carpeta, con Android SDK configurado:

```bash
gradle wrapper --gradle-version 8.10.2
./gradlew assembleDebug
```

El APK de prueba queda en:

```text
app/build/outputs/apk/debug/app-debug.apk
```
