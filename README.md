# 🛡️ LeadGuard CLI

> **Agente PM Técnico y Supervisor de Arquitectura Multi-Proveedor**

**LeadGuard** es un CLI impulsado por IA diseñado para actuar como un **Project Manager Técnico y Lead Architect**. Escanea automáticamente el contexto de tu repositorio de código (lenguajes, ORMs, esquemas de BD, archivos Docker, manifiestos y variables de entorno) y realiza un proceso de **Discovery interactivo** con perfiles técnicos especializados para prevenir suposiciones, aclarar ambiguëdades y generar especificaciones técnicas (SPECs) atómicas e implacables.

---

## 📋 Tabla de Contenidos

- [Características Principales](#-características-principales)
- [Perfiles Técnicos Especializados](#-perfiles-técnicos-especializados)
- [Inicio Rápido](#-inicio-rápido)
- [Configuración Multi-Proveedor (.env)](#-configuración-multi-proveedor-env)
- [Estructura del Directorio Local `.leadguard/`](#-estructura-del-directorio-local-leadguard)
- [Comandos y Flujo de Trabajo](#-comandos-y-flujo-de-trabajo)
- [Comandos de Desarrollo](#-comandos-de-desarrollo)
- [Licencia](#-licencia)

---

## ✨ Características Principales

* **🔌 Arquitectura Multi-Proveedor (Strategy Pattern):** Soporta **OpenCode Go**, **OpenAI**, **Anthropic (Claude)**, **Google (Gemini)** y servidores compatibles con OpenAI (**Ollama**, **vLLM**, **LocalAI**).
* **🎯 Perfiles Técnicos Especializados:** Selección interactiva de rol técnico con directivas de auditoría inyectadas al System Prompt.
* **💾 Persistencia de Configuración Local:** Guarda el rol seleccionado del proyecto en `.leadguard/config.json`.
* **🔍 Escaneo Automático de Repositorio:** Detecta manifiestos (`package.json`, `composer.json`, `go.mod`, `Cargo.toml`, etc.), artefatos de BD (Prisma, SQL, migraciones) e infraestructura (Docker, Kubernetes, Terraform).
* **❓ Discovery Interactivo (Sin Suposiciones):** Se bloquea (`BLOCKED`) si detecta falta de contexto explícito y solicita aclaratorias antes de generar el SPEC.

---

## 🎭 Perfiles Técnicos Especializados

Al ejecutar LeadGuard por primera vez en un proyecto, seleccionarás uno de los siguientes perfiles técnicos:

| Rol Key | Perfil Técnico | Enfoque de Auditoría |
| :--- | :--- | :--- |
| `SAP_B1_SPECIALIST` | **SAP Business One & Enterprise Data** | Tablas OITM/OCRD/OOCR, consistencia ERP, inventarios, transacciones ACID y Service Layer / DI API |
| `SQL_DB_ARCHITECT` | **SQL & Database Performance Architect** | Normalización 3NF, índices compuestos, prevención de deadlocks/N+1, planes de ejecución y migraciones |
| `FRONTEND_REACT` | **Frontend & React Ecosystem** | Modularidad de componentes, Custom Hooks, optimización de renderizado, accesibilidad y estado |
| `BACKEND_DISTRIBUTED` | **Backend & Distributed Systems** | Contratos de API REST/GraphQL, idempotencia, resiliencia, colas de mensajería (RabbitMQ/Kafka) |
| `GENERAL_TECH_LEAD` | **Full-Stack General Tech Lead** | Principios SOLID, Clean Architecture, gobierno técnico y trazabilidad integral del alcance |

---

## 🚀 Inicio Rápido

### Ejecución directa con `npx` (Sin instalación)
```bash
npx @cpandares/leadguard task "Crear módulo de autenticación OAuth2"
```

### Instalación Global
```bash
npm install -g @cpandares/leadguard

# Ejecutar en cualquier proyecto
leadguard task "Crear endpoint de conciliación contable"
```

---

## ⚙️ Configuración Multi-Proveedor (`.env`)

Configura tus credenciales en el archivo `.env` en la raíz de tu proyecto:

### Tabla de Variables de Entorno

| Variable | Requerida | Valores Soportados | Descripción |
| :--- | :---: | :--- | :--- |
| `AI_PROVIDER` | No | `opencode` (default), `openai`, `anthropic`, `google`, `custom` | Selecciona el adaptador de IA a utilizar |
| `AI_MANAGER_KEY` | **Sí** | Cadena de API Key | API Key del proveedor configurado |
| `AI_MODEL` | No | Nombre del modelo (ej: `deepseek-v4-pro`, `gpt-4o`, `claude-3-7-sonnet-20250219`, `gemini-1.5-pro`) | Modelo de lenguaje |
| `AI_BASE_URL` | Según proveedor | URL Endpoint (Obligatorio en `custom`, ej: `http://localhost:11434/v1`) | Endpoint base de la API |
| `AI_TEMPERATURE` | No | Número flotante (default: `0.1`) | Temperatura de generación |

> **Nota de Compatibilidad:** LeadGuard también reconoce automáticamente las variables legadas `OPENCODE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` y `GEMINI_API_KEY` si `AI_MANAGER_KEY` no está definida.

---

## 📁 Estructura del Directorio Local `.leadguard/`

LeadGuard administra sus artefactos locales dentro de la carpeta `.leadguard/` en la raíz de tu repositorio:

```
.leadguard/
├── config.json               # Configuración local del proyecto (rol técnico activo e inicio)
└── tasks/
    ├── TASK-20260830120000.md # Spec técnico atómico guardado tras el Discovery
    └── TASK-20260830153000.md
```

Ejemplo de `.leadguard/config.json`:
```json
{
  "selectedRole": "SQL_DB_ARCHITECT",
  "initializedAt": "2026-08-30T12:40:00.000Z"
}
```

---

## 🛠️ Comandos de Desarrollo

Si estás modificando el paquete localmente:

```bash
# Modo desarrollo con tsx
npm run dev -- task "Prueba de tarea"

# Compilar TypeScript (dist/)
npm run build

# Validar previa a publicación
npm run prepublishOnly
```

---

## 📜 Licencia

Distribuido bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más información.
