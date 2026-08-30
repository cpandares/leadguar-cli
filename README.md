# 🛡️ LeadGuard

> **Agente PM Técnico y Supervisor de Arquitectura CLI**

**LeadGuard** es una herramienta de línea de comandos (CLI) impulsada por IA diseñada para actuar como un **Project Manager Técnico y Lead Architect**. Escanea automáticamente el contexto de tu repositorio de código (lenguajes, ORMs, esquemas de BD, archivos Docker, manifiestos y variables de entorno) y realiza un proceso de **Discovery interactivo** para prevenir suposiciones, aclarar ambiguëdades y generar especificaciones técnicas (SPECs) extremadamente detalladas y atómicas.

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación Granular](#-instalación-granular)
  - [Opción 1: Uso directo con npx (Sin instalación)](#opción-1-uso-directo-con-npx-sin-instalación)
  - [Opción 2: Instalación Global](#opción-2-instalación-global)
  - [Opción 3: Instalación Local en un Proyecto](#opción-3-instalación-local-en-un-proyecto)
  - [Opción 4: Desarrollo Local desde el Código Fuente](#opción-4-desarrollo-local-desde-el-código-fuente)
- [Configuración de Variables de Entorno](#-configuración-de-variables-de-entorno)
- [Guía de Uso](#-guía-de-uso)
  - [Comando `task`](#comando-task)
  - [Flujo del Discovery Interactivo](#flujo-del-discovery-interactivo)
- [Estructura del Archivo Generado](#-estructura-del-archivo-generado)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Comandos de Desarrollo](#-comandos-de-desarrollo)
- [Licencia](#-licencia)

---

## ✨ Características Principales

* **🔍 Escaneo Automático de Repositorio:**
  Detecta automáticamente las tecnologías y capas del proyecto sin configuración manual:
  * **Manifiestos de dependencias:** `package.json`, `requirements.txt`, `composer.json`, `go.mod`, `Cargo.toml`, `pom.xml`, etc.
  * **Artefactos de Base de Datos / ORM:** Esquemas de Prisma, archivos `.sql`, migraciones, modelos.
  * **Infraestructura:** `Dockerfile`, `docker-compose.yml`, Kubernetes, Serverless, Terraform.
  * **Variables de Entorno:** Claves declaradas en `.env.example`, `.env.template`, etc.
* **❓ Bucle de Discovery Interactivo (Sin Suposiciones):**
  Si LeadGuard detecta que falta contexto crítico (tablas involucradas, versiones de servicios, estructura de inputs/outputs, o criterios de aceptación), se bloquea temporalmente (`BLOCKED`) y te formula preguntas puntuales antes de generar la solución.
* **📝 Generación de SPEC Técnico Atómico:**
  Produce especificaciones técnicas estandarizadas y listas para ser ejecutadas por desarrolladores o agentes de código, guardadas en `.leadguard/tasks/TASK-<timestamp>.md`.
* **⚡ Compatibilidad con OpenCode Go:**
  Soporta modelos de lenguaje como `deepseek-v4-pro`, `claude-3-7-sonnet`, `gpt-4o`, etc., integrándose a través de endpoints OpenAI-compatible.

---

## 📌 Requisitos Previos

* **Node.js**: Versión `18.0.0` o superior.
* **NPM**: Versión `9.0.0` o superior.
* **API Key de OpenCode Go** (o endpoint OpenAI-compatible equivalente).

---

## 🚀 Instalación Granular

Elige la opción que mejor se adapte a tu flujo de trabajo:

### Opción 1: Uso directo con `npx` (Sin instalación)
Ideal si quieres ejecutar tareas esporádicas en cualquier repositorio sin instalar paquetes globales.

```bash
npx @cpandares/leadguard task "Crear módulo de autenticación con OAuth2"
```

### Opción 2: Instalación Global
Ideal si usas LeadGuard frecuentemente en múltiples proyectos locales.

```bash
npm install -g @cpandares/leadguard
```

Una vez instalado globalmente, puedes invocar directamente:
```bash
leadguard task "Crear rol de manager general"
```

### Opción 3: Instalación Local en un Proyecto
Ideal para integrar LeadGuard en las dependencias de desarrollo (`devDependencies`) de un proyecto específico del equipo.

```bash
npm install --save-dev @cpandares/leadguard
```

Y añade un script en tu `package.json`:
```json
{
  "scripts": {
    "leadguard": "leadguard"
  }
}
```

Luego puedes ejecutar:
```bash
npm run leadguard -- task "Descripción de la tarea"
```

### Opción 4: Desarrollo Local desde el Código Fuente
Ideal si deseas contribuir al desarrollo de LeadGuard o modificar su comportamiento.

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/cpandares/leadguard.git
   cd leadguard
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Compilar el proyecto:**
   ```bash
   npm run build
   ```

4. **Vincular el comando globalmente en tu máquina:**
   ```bash
   npm link
   ```

---

## ⚙️ Configuración de Variables de Entorno

LeadGuard requiere la clave de API de **OpenCode Go** para realizar los análisis técnicos. Crea un archivo `.env` en la raíz de tu proyecto o exporta las variables en tu entorno de terminal:

### Ejemplo de `.env`

```env
# Clave de API obligatoria de OpenCode Go
OPENCODE_API_KEY=sk-tu-api-key-aqui

# Modelo a utilizar (Opcional, valor por defecto: deepseek-v4-pro)
# Opciones comunes: deepseek-v4-pro, claude-3-7-sonnet, gpt-4o
OPENCODE_MODEL=deepseek-v4-pro

# Base URL de la API (Opcional, valor por defecto: https://opencode.ai/zen/go/v1)
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
```

---

## 📖 Guía de Uso

### Comando `task`

Inicia el análisis de contexto del repositorio y el proceso interactivo para definir una tarea.

```bash
leadguard task "[descripción inicial opcional]"
```

#### Ejemplos:

```bash
# Pasando la descripción directamente como argumento
leadguard task "Crear endpoint de facturación masiva en PDF"

# O simplemente ejecutándolo en modo interactivo (te pedirá la descripción)
leadguard
```

---

### Flujo del Discovery Interactivo

1. **Escaneo de Contexto:** LeadGuard lee los manifiestos, estructura de base de datos, servicios e infraestructura del directorio actual.
2. **Evaluación de Requerimientos:**
   * **Caso A (`BLOCKED`):** Si la tarea requiere aclaraciones (ej. ¿qué tabla de BD actualizar?, ¿qué roles tienen acceso?), LeadGuard te hará una serie de preguntas obligatorias. Tras responderlas, reevaluará el alcance.
   * **Caso B (`READY`):** Cuando todo el contexto técnico esté claro y no haya suposiciones, generará la especificación técnica.
3. **Persistencia:** Guarda el documento final en `.leadguard/tasks/TASK-YYYYMMDDHHMMSS.md`.

---

## 📄 Estructura del Archivo Generado

Los archivos `.md` generados en `.leadguard/tasks/` contienen:

```markdown
# 🛡️ SPEC TÉCNICO: [Nombre de la Tarea]

## 1. Contexto y Alcance
Descripción clara del problema a resolver e impacto en el sistema.

## 2. Archivos Afectados y Cambios Propuestos
- `src/controllers/user.controller.ts` (Modificación)
- `src/models/user.model.ts` (Nuevos campos)

## 3. Requerimientos Técnicos e Interfaces
Detalle de funciones, endpoints, DTOs, cambios en base de datos/migraciones y variables de entorno necesarias.

## 4. Criterios de Aceptación (Definition of Done)
- [ ] Pruebas unitarias/integración aprobadas.
- [ ] Migración de base de datos ejecutada.
- [ ] Documentación / Swagger actualizado.
```

---

## 📁 Estructura del Proyecto

```
leadguard/
├── bin/               # Puntos de entrada ejecutables CLI
├── src/
│   ├── bin/           # CLI Entrypoint (cli.ts)
│   ├── commands/      # Lógica de comandos de la CLI (task.ts, init.ts, audit.ts)
│   ├── core/          # Motor interno
│   │   ├── config.ts  # Carga de variables de entorno (.env)
│   │   ├── llm.ts     # Integración con cliente OpenAI / OpenCode Go
│   │   ├── scanner.ts # Escáner de repositorio y contexto
│   │   ├── state.ts   # Manejo de estado
│   │   └── types.ts   # Definiciones de tipos TypeScript
│   └── prompts/       # System Prompts para el agente de IA
├── .env.example       # Plantilla de variables de entorno
├── package.json       # Configuración del paquete NPM y scripts
├── tsconfig.json      # Configuración del compilador TypeScript
└── README.md          # Documentación del proyecto
```

---

## 🛠️ Comandos de Desarrollo

Si estás modificando el código fuente de LeadGuard:

* **Modo desarrollo (ejecución directa con tsx):**
  ```bash
  npm run dev -- task "Prueba de desarrollo"
  ```
* **Compilar TypeScript a JavaScript (`dist/`):**
  ```bash
  npm run build
  ```
* **Validación previa a publicación en NPM:**
  ```bash
  npm run prepublishOnly
  ```

---

## 📜 Licencia

Distribuido bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para obtener más información.
