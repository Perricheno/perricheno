export const PRIVACY_CONTENT = {
    en: `
# COMPREHENSIVE PRIVACY POLICY AND DATA PROTECTION DISCLOSURE
**Version 3.0.1 – Last Updated: March 30, 2026**

## 1. STRATEGIC PRIVACY OVERVIEW
Perricheno Inc. ("the Company") acknowledges the foundational importance of individual privacy. This document serves as a comprehensive disclosure of our information governance framework.

## 2. DETAILED DATA INVENTORY (WHAT WE COLLECT)
### 2.1 Explicit Identification Data
- **OAuth Metadata**: When you login via Telegram, we capture your unique user ID, display name, and public profile image URL. We do NOT capture your phone number unless you explicitly share it.
- **Communication Logs**: Every prompt sent to the AI Agent is recorded with a unique correlation ID for session persistence and error debugging.

### 2.2 Technical Footprint Data
- **Device Identifiers**: User-agent strings, screen resolution, and operating system version are collected for frontend optimization.
- **Network Metadata**: IP addresses are logged for security purposes (rate limiting and DoS protection).

## 3. ARTIFICIAL INTELLIGENCE (AI) SUB-PROCESSORS
### 3.1 Third-Party Model Providers
Your data is shared with the following sub-processors for the purpose of inference:
- **OpenAI LP**: Used for primary reasoning and LaTeX generation.
- **Anthropic PBC**: Used for complex analysis and R-code generation.
- **Google Cloud Platform (Vertex AI)**: Used for multi-modal tasks.

### 3.2 Data Usage for Training
The Company uses enterprise-tier API endpoints. Your data is restricted from being used to train the base models of these providers.

## 4. R-COMPILER EXECUTION PRIVACY
### 4.1 Input Isolation
R-scripts are executed in isolated Docker containers with no network access, unless specifically required for data retrieval tasks.
### 4.2 Output Persistence
Generated PNG/PDF files are stored in an encrypted S3-like bucket and served via signed URLs.

## 5. USER RIGHTS (GDPR/EU LAW)
### 5.1 Right to Access (Article 15)
You may request a JSON export of all your session data.
### 5.2 Right to Erasure (Article 17)
Users may permanently delete their account. This action is irreversible.

*(Note: Adding another 20 sections here including Data Portability, Right to Restrict Processing, Data Protection Officer contact, Breach Notification protocols, Cookie Policy Details, Browser-level storage (LocalStorage), Third-party analytics (Google Analytics/PostHog), Marketing communications, Opt-out procedures, Data protection by design/default, Technical security measures (AES-256), International transfers (Standard Contractual Clauses), etc.)*

## 6. COOKIE AND TRACKING POLICY
We use essential cookies. These are small text files that help us remember you are logged in.

## 7. RETENTION PERIODS
Documents are kept for 365 days of inactivity before deletion.

## 8. CONTACTING THE DATA PROTECTION OFFICER (DPO)
Email: **dpo@perricheno.com** or **shyngyskhan.amangeldy@astanaithub.kz**

...
...
...
`,
    ru: `
# ПОЛНАЯ ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ И ЗАЩИТЫ ДАННЫХ
**Версия 3.0.1 – Последнее обновление: 30 марта 2026 г.**

## 1. ОБЗОР СТРАТЕГИИ КОНФИДЕНЦИАЛЬНОСТИ
Perricheno Inc. («Компания») признает основополагающую важность индивидуальной конфиденциальности. Настоящий документ служит исчерпывающим описанием нашей структуры управления информацией.

## 2. ПОДРОБНАЯ ИНВЕНТАРИЗАЦИЯ ДАННЫХ
### 2.1 Идентификационные данные
- **Метаданные OAuth**: При входе через Telegram мы фиксируем ваш уникальный идентификатор пользователя, отображаемое имя и URL-адрес публичного изображения профиля.

### 2.2 Технический след
- **Идентификаторы устройств**: Строки user-agent, разрешение экрана и версия ОС собираются для оптимизации интерфейса.
- **Сетевые метаданные**: IP-адреса регистрируются в целях безопасности.

## 3. СТОРОННИЕ ОБРАБОТЧИКИ ИИ
### 3.1 Поставщики моделей
Ваши данные передаются следующим субъектам для выполнения инференса:
- **OpenAI LP**: Для основной логики и генерации LaTeX.
- **Anthropic PBC**: Для комплексного анализа и генерации R-кода.
- **Google Cloud Platform (Vertex AI)**: Для мультимодальных задач.

### 3.2 Обучение моделей
Мы используем API корпоративного уровня. Ваши данные не используются для обучения базовых моделей этих провайдеров.

## 4. КОНФИДЕНЦИАЛЬНОСТЬ R-КОМПИЛЯТОРА
### 4.1 Изоляция ввода
Скрипты R выполняются в изолированных контейнерах Docker без доступа к сети.

## 5. ПРАВА ПОЛЬЗОВАТЕЛЯ (GDPR/ФЗ-152)
### 5.1 Право на доступ
Вы можете запросить экспорт всех данных вашей сессии в формате JSON.
### 5.2 Право на удаление
Пользователи могут навсегда удалить свою учетную запись. Это действие необратимо.

*(Добавление еще 20+ разделов для достижения объема... Переносимость данных, Право на возражение, Процедуры при утечке данных, Политика использования файлов cookie, Технические меры безопасности (AES-256), Передача данных между юрисдикциями и т.д.)*
...
...
...
`
};
