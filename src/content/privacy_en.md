# PERRICHENO INC. PRIVACY POLICY

**Effective Date: 30/03/2026**
**Last Updated: 30/03/2026**

This Privacy Policy (hereinafter referred to as the "Policy") explains how **Perricheno Inc.** (hereinafter referred to as the "Company", "We", "Our", or "Us") collects, uses, discloses, stores, and protects your personal information when you use our website, microservices, AI Agents, R-compiler nodes, Telegram bots, and all related software solutions (collectively referred to as the "Platform" or "Services").

We respect your privacy and are committed to protecting your personal data. By accessing or using the Platform, you provide your unconditional consent to the collection and processing of your information in accordance with this Policy. If you do not agree with the terms of this Policy, please do not use our Services.

---

## 1. WHAT INFORMATION WE COLLECT

Perricheno strictly adheres to the principle of Data Minimization. We collect only the absolute minimum amount of information necessary to ensure the functionality of the Platform.

**1.1. Data Provided Directly by You:**

- **Account Credentials (Telegram):** If you authenticate via Telegram, we receive your unique Telegram ID, username, first and last name (if provided in your profile), and your profile picture URL. This is strictly for authentication purposes.
- **Session Data and Content (Inputs):** Text prompts, R source code, scripts, formulas, LaTeX documents, and any data files (e.g., CSV, JSON) that you upload for analysis in the R Sandbox or processing by the AI Agent.
- **Contact Information:** Your email address (if you contact customer support, subscribe to a newsletter, or register via email).

**1.2. Automatically Collected Data (Telemetry and Logs):**

- **Chat Logs and Interaction History:** The history of your dialogues with the AI Agent is temporarily stored to maintain conversational context and generate coherent responses.
- **Technical Information:** Your IP address, browser type and version, operating system type, unique device identifiers, time zone, and language settings.
- **Usage Data:** Information about how you interact with the Platform: login times, frequency of R-compiler usage, number of generated PDF files, and compilation errors (crash logs).

**1.3. Payment Information:**

- If you purchase a paid subscription, your payment is processed by third-party payment gateways (e.g., Stripe or PayPal). Perricheno Inc. **does not collect or store** your full credit card numbers or CVV codes. We only receive transaction tokens, payment status, and the last 4 digits of your card for billing and invoicing purposes.

---

## 2. SPECIFICS OF ARTIFICIAL INTELLIGENCE DATA PROCESSING

Because the Platform's core functionality relies on Generative AI technologies, data processing involves the following critical specifics:

**2.1. Use of Third-Party LLMs:** Your text prompts, document drafts, and code snippets are transmitted via secure APIs to third-party Artificial Intelligence model providers (specifically, **OpenAI** and/or **Anthropic**).
**2.2. Zero Data Retention for Training:** We utilize the Enterprise/API versions of these services. Pursuant to our agreements with these AI providers, the data transmitted through Perricheno's API is **NOT used** by these third-party companies to train their public foundational models (Foundation Models).
**2.3. Warning Regarding Sensitive Data:** Despite our high security standards, **WE STRONGLY ADVISE AGAINST** including the following information in your prompts, source code, or uploaded files (Inputs for the AI or R-compiler):

- Government identification numbers (e.g., Passports, SSNs);
- Financial information (e.g., bank account numbers);
- Protected Health Information (PHI);
- Strictly confidential trade secrets.
  You bear sole responsibility for anonymizing or sanitizing your data before submitting it to the Platform.

---

## 3. R EXECUTION ENVIRONMENT (R-SANDBOX) AND CODE PROCESSING

**3.1. Temporary Processing:** When you execute statistical computations or data visualizations, your R code and uploaded datasets are transmitted to the Platform's compiler nodes.
**3.2. Strict Isolation:** This data is processed in strict isolation (a sandbox). Third parties and other users have absolutely no access to your R execution environment.
**3.3. Node Data Lifecycle:** Working files created during compilation (e.g., temporary `.png` plots, intermediate data tables) exist only in Random Access Memory (RAM) or in the node's temporary storage. They are automatically and permanently destroyed immediately after the compilation session ends or the Outputs are returned to the User.

---

## 4. PURPOSES OF DATA COLLECTION AND USE

We use the collected data exclusively for the following purposes:

- **Service Provision:** Authenticating users, executing R code, compiling LaTeX documents, generating AI responses, and managing user sessions.
- **Platform Improvement:** Analyzing compilation errors, optimizing server load, and refining system prompts (strictly using aggregated, anonymized data).
- **Security Enforcement:** Detecting and preventing fraud, DDoS attacks, attempts to breach the R Sandbox, or unauthorized account access.
- **Customer Support:** Responding to your inquiries, troubleshooting technical issues, and informing you about feature updates.
- **Legal Compliance:** Fulfilling tax, accounting, and other statutory legal obligations.

---

## 5. THIRD-PARTY DATA PROCESSORS (SUB-PROCESSORS)

To ensure the reliable operation of the Platform, Perricheno Inc. engages trusted third-party service providers (Sub-processors). We share data with them only to the extent necessary to perform their services:

- **Vercel / AWS / Google Cloud:** Providing cloud infrastructure, website hosting, and server management (US / EU).
- **Railway:** Database hosting, deployment of backend microservices, and R-compiler nodes.
- **OpenAI, LLC / Anthropic, PBC:** Providers of Large Language Models (LLMs) for AI Agent inference (US).
- **Stripe / PayPal:** Payment processing and subscription management.
- **Telegram Messenger Inc.:** Messenger provider enabling Telegram bot functionality and authentication.

All our Sub-processors are bound by strict Data Processing Agreements (DPAs) and comply with international security standards.

---

## 6. DATA STORAGE AND PERMANENT DELETION

**6.1. Retention Period:** The data of your active sessions (including document drafts, AI chat logs, and visualizations) are stored in our encrypted database only for as long as your Account remains active or until you decide to delete them.
**6.2. Self-Deletion:** You maintain full control over your data. You may clear your chat history, delete uploaded files, or reset an R session at any time via the Platform interface (using the sidebar menu in the web version or specific commands in Telegram).
**6.3. Right to be Forgotten (Irreversible Deletion):** Upon initiating the deletion of session data or the complete deletion of your Account, your data undergoes a **hard delete** (permanent destruction) from our active databases. Limited metadata may be retained in encrypted, air-gapped backups for up to 30 days in accordance with our disaster recovery policy, after which it is automatically overwritten and destroyed.

---

## 7. SECURITY OF YOUR DATA

Perricheno Inc. implements advanced technical and organizational measures to safeguard your information:

- **Encryption in Transit:** All data transmission between your device, Telegram, Perricheno's servers, and third-party APIs (e.g., OpenAI) is conducted exclusively over secure protocols (HTTPS/TLS 1.2+).
- **Encryption at Rest:** Our databases (hosted on Railway/AWS) utilize AES-256 encryption algorithms to protect stored chat logs and user profiles.
- **Infrastructure Isolation:** The environment executing R scripts is entirely segregated from core user databases using containerization technologies (Docker/Kubernetes). Compiler nodes have zero access to the password database or billing information.
- **Access Control:** Only authorized Perricheno Inc. engineers have access to production databases, and such access is strictly routed through secure VPNs requiring Multi-Factor Authentication (MFA).

---

## 8. USE OF COOKIES AND TRACKERS

**8.1. Essential Cookies.** We use cookies and browser Local Storage to maintain your sessions, save user preferences (e.g., dark/light theme), and cache LaTeX drafts for rapid access. These cookies are strictly necessary for the web version of the Platform to function.
**8.2. Analytics.** We may use aggregated, anonymized analytics (e.g., Plausible Analytics or similar privacy-first solutions) to count visits and understand how the Platform is used. We do not use invasive third-party trackers for cross-site advertising targeting.
**8.3. Cookie Management.** You can configure your browser to block all cookies; however, doing so will prevent you from logging into the Platform and saving your work progress.

---

## 9. INTERNATIONAL (CROSS-BORDER) DATA TRANSFERS

The Perricheno Platform operates on a global scale. Your data may be transferred, stored, and processed on servers located outside your country of residence (primarily in the United States and the European Union).

**9.1. For EEA and UK Residents:** When transferring data outside the European Economic Area, we rely on Adequacy Decisions issued by the European Commission, or we execute Standard Contractual Clauses (SCCs) in our agreements with our cloud and AI partners.
**9.2. Local Data Localization Laws:** Where required by local laws (e.g., Russian Federal Law 152-FZ, or similar regional regulations), we take reasonable steps to ensure initial data collection compliance via localized servers before legally executing cross-border transfers for cloud computing purposes under appropriate safeguards.

---

## 10. YOUR PRIVACY RIGHTS (GDPR / CCPA)

Depending on your jurisdiction (Europe, California, or elsewhere), you possess a comprehensive set of rights regarding your data:

- **Right to Access (Data Portability):** You have the right to request a copy of all your personal data held by us in a structured, machine-readable format.
- **Right to Rectification:** You may request the correction of any inaccurate or incomplete data concerning you.
- **Right to Erasure (Right to be Forgotten):** As outlined in Section 6, you may delete your sessions or request the complete deletion of your Account.
- **Right to Restrict Processing:** You have the right to suspend the processing of your data under specific circumstances.
- **Opt-out of Data Sale (CCPA):** Perricheno Inc. **DOES NOT SELL** your personal data, chat logs, or uploaded files to third-party data brokers or advertisers.

To exercise any of these rights, please submit a request to **privacy@perricheno.com**. We will process your request within 30 calendar days free of charge. To protect your data, we may require you to verify your identity (e.g., by sending the request from an authenticated Telegram account).

---

## 11. TELEGRAM INTEGRATION AND PRIVACY

If you utilize our Telegram bots to access AI Agents or the R-compiler:
**11.1. Transit via Telegram.** All messages sent and received by the bot pass through the servers of Telegram Messenger Inc. We do not control their infrastructure. Telegram’s own Privacy Policy applies to your data while it is in transit on their network.
**11.2. Data Visibility.** The Perricheno Telegram bot only "sees" messages sent directly to it via Direct Message (DM), messages in groups where the bot is explicitly mentioned (via @), or all messages in a group _only if_ the bot is granted administrator privileges with the "Read All Messages" permission (which is necessary for certain AI-context scenarios). We strongly advise you to audit bot permissions in your private groups.

---

## 12. CHILDREN'S PRIVACY

Due to the complex nature of the tools provided (LaTeX, R, LLMs), the Perricheno Platform is intended for students, researchers, and professionals.
**12.1. Age Restrictions.** Our Services are not directed at, nor intended for, individuals under the age of 13 (or under 16 in certain EU jurisdictions).
**12.2. No Intentional Collection.** We do not knowingly collect personal information from children. If we become aware that we have inadvertently collected personal data from a child without verifiable parental consent, we will take immediate steps to purge that information from our servers. If you believe we might possess such data, please contact us immediately.

---

## 13. LINKS TO THIRD-PARTY SITES

The Platform, as well as the responses generated by the AI Agent, may contain links to third-party websites, scientific articles, repositories (e.g., GitHub, CRAN), or external resources. This Privacy Policy **does not apply** to such third-party platforms. We are not responsible for their privacy practices. We encourage you to review the privacy policy of any site you visit.

---

## 14. DATA BREACH PROTOCOL

Despite our best efforts to protect your data, no system on the Internet is 100% secure.
In the event of an identified unauthorized access to our databases that poses a high risk to your rights and freedoms (a data breach), Perricheno Inc. commits to:

1. Immediately isolate and contain the vulnerability;
2. Notify the relevant Data Protection Authorities (DPAs) within the timeframes mandated by law (e.g., within 72 hours under the GDPR);
3. Notify the affected users via email or the Telegram bot, providing actionable instructions to mitigate risks (e.g., recommending password changes or revoking API keys).

---

## 15. DATA DISCLOSURE TO LAW ENFORCEMENT

We may disclose your information to government agencies, courts, or law enforcement bodies **only** when strictly required by law (e.g., pursuant to a valid subpoena, court order, or Mutual Legal Assistance Treaty request).
We reserve the right to challenge data disclosure requests if we determine them to be overly broad, vague, or lacking proper legal foundation. We do not provide governments with direct, "backdoor" access to our infrastructure.

---

## 16. CHANGES TO THE PRIVACY POLICY

AI technologies and data privacy laws are evolving rapidly. We may periodically update this Privacy Policy to reflect those changes.
In the event of material changes (e.g., updating our list of AI Sub-processors or altering how data is used), we will notify you via a system message on the Platform, a broadcast from our Telegram bot, or via email before the changes become effective. The current version of the Policy is always accessible at `https://perricheno.ru/privacy`. Your continued use of the Services following the publication of changes constitutes your acceptance of the updated Policy.

---

## 17. CONTACT INFORMATION AND DPO

If you have any questions, concerns, or complaints regarding our Privacy Policy or our data processing practices, you may contact our Data Protection Officer (DPO):

**Perricheno Inc.**
**Headquarters Address: Astana IT University EXPO**
**Privacy Inquiries (GDPR/CCPA Requests):** admin@perricheno.com
**Legal Department:** admin@perricheno.com

We are committed to addressing all your inquiries related to the privacy and security of your data promptly and confidentially.
