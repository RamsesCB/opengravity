# Estructura de Recuperación de Errores

## Protocolo de Error

### Paso 1: Detección
- La validación técnica devuelve exit code != 0
- Se captura el output completo (stdout + stderr)

### Paso 2: Aislamiento
- Se extrae el traceback/log de error
- Se identifica el archivo y línea problemáticos
- Se crea archivo debug_repro con el error

### Paso 3: Clasificación
- **Error de Sintaxis**: Problema en el código fuente
- **Error de Dependencia**: Falta package o import
- **Error de Lógica**: El código compila pero no funciona
- **Error de Configuración**: Problema en setup/entorno

### Paso 4: Recuperación
1. Intentar corrección automática
2. Si es syntax error -> corregir sintaxis
3. Si es dependency error -> instalar dependencia
4. Si es logic error -> revisar algoritmo
5. Si es config error -> ajustar configuración

### Paso 5: Pivot de Modelo
Si after 3 reintentos el error persiste:
- **Arquitectura/System Design**: MiniMax M2.5
- **Sintaxis/Flutter/JS**: MiMo v2 Flash
- **Deep Code Review**: Big Pickle
- **Tool Calling/APIs**: Nemotron-3 Super

## Notificación de Estado
- Inicio: "🤖 Inicializando entorno..."
- Error: "⚠️ Detectado error en [Archivo], intentando recuperación..."
- Pivot: "⚠️ Error complejo, invocando a [Modelo] para fix..."
- Éxito: "✅ Tarea completada sin errores"
- Recuperación: "✅ Error corregido, continuando..."
- Fracaso: "❌ Múltiples reintentos agotados"
