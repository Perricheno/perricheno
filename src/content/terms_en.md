# PERRICHENO PLATFORM TERMS OF SERVICE

**Last Updated: 30/03/2026**
**Effective Date: 30/03/2026**

PLEASE READ THESE TERMS OF SERVICE (HEREINAFTER REFERRED TO AS THE "AGREEMENT" OR "TERMS") CAREFULLY BEFORE USING THE PERRICHENO PLATFORM. THIS DOCUMENT CONSTITUTES A LEGALLY BINDING CONTRACT BETWEEN YOU (AS AN INDIVIDUAL OR A LEGAL ENTITY) AND PERRICHENO INC. (HEREINAFTER REFERRED TO AS THE "COMPANY", "WE", "US", OR "OUR").

BY ACCESSING OR USING THE WEBSITE, MICROSERVICES, AI AGENTS, R-COMPILER NODES, TELEGRAM ASSISTANTS, OR ANY OTHER RELATED SOFTWARE PRODUCTS (COLLECTIVELY REFERRED TO AS THE "PLATFORM"), YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND UNCONDITIONALLY AGREE TO BE BOUND BY ALL PROVISIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE WITH ANY PROVISION HEREOF, YOU MUST IMMEDIATELY CEASE ALL USE OF THE PLATFORM.

**PLEASE NOTE: THESE TERMS CONTAIN A MANDATORY BINDING ARBITRATION PROVISION AND A CLASS ACTION WAIVER (SECTION 18), WHICH SIGNIFICANTLY AFFECT YOUR LEGAL RIGHTS AND HOW DISPUTES WITH THE COMPANY ARE RESOLVED.**

---

## 1. DEFINITIONS AND TERMINOLOGY

For the purposes of this Agreement, the following capitalized terms shall have the meanings ascribed to them below:

**1.1. "Platform"** means all software and hardware solutions provided by Perricheno Inc., including, but not limited to: web interfaces, cloud infrastructure, Application Programming Interfaces (APIs), AI models, LaTeX rendering servers, R code execution nodes (compilers), and integrations with third-party messengers (e.g., Telegram).
**1.2. "AI Agent"** means an autonomous or semi-autonomous system based on machine learning algorithms and Large Language Models (LLMs), utilized on the Platform for natural language processing, text generation, and code writing/analysis (including R and LaTeX), as well as for interacting with the User.
**1.3. "R Sandbox"** means an isolated, secure virtual execution environment provided by the Platform to the User, designed strictly for compiling, interpreting, and executing statistical code and scripts written in the R programming language.
**1.4. "User", "You", or "Your"** means any individual or legal entity that accesses the Platform, creates an account, or utilizes Perricheno services in any manner.
**1.5. "Inputs"** means any text prompts, datasets, source code, parameters, files, images, or other information that the User uploads, types, or transmits to the Platform for processing.
**1.6. "Outputs"** means any text, code, visualizations, charts, compiled PDF documents (including those generated via LaTeX), AI Agent responses, and other materials returned by the Platform to the User as a result of processing the Inputs.
**1.7. "Content"** means Inputs and Outputs collectively.
**1.8. "Account"** means a unique profile created by the User to access restricted Platform features, store history, and manage subscriptions.

---

## 2. ACCEPTANCE AND ELIGIBILITY

**2.1. Legal Capacity.** Access to the Platform is permitted only to individuals who have reached the age of majority in their jurisdiction of residence (typically 18 years old). If you are between 13 and 18 years of age, you may use the Platform only under the direct supervision of a parent or legal guardian who agrees to be bound by these Terms. Use of the Platform by individuals under the age of 13 is strictly prohibited.
**2.2. Corporate Users.** If you are accepting these Terms on behalf of a company, organization, educational institution, or other legal entity, you represent and warrant that you have the full legal authority to bind such entity to these Terms. In such cases, the terms "You" and "User" shall refer to such entity.
**2.3. Electronic Agreement.** Your use of the Platform is equivalent to signing a written contract. You expressly consent to the use of electronic means to enter into contracts, place orders, and receive notices.

---

## 3. MODIFICATION OF TERMS

**3.1. Right to Modify.** Perricheno Inc. reserves the inherent right, at its sole discretion, to update, modify, add, or remove any portion of this Agreement at any time.
**3.2. Notification of Changes.** In the event of material changes, we will notify you by sending an email to the address associated with your Account or by posting a conspicuous notice on the Platform's website before the changes take effect. Non-material changes shall become effective immediately upon posting.
**3.3. Continued Use.** Your continued use of the Platform following the effective date of any changes constitutes your unconditional acceptance of the updated Terms. If you do not agree to the new version, your sole remedy is to discontinue using the Platform and delete your Account.

---

## 4. ACCOUNT REGISTRATION AND SECURITY

**4.1. Accuracy of Information.** When creating an Account, you agree to provide accurate, current, and complete information. You are responsible for keeping your registration data up to date.
**4.2. Confidentiality.** You are solely responsible for maintaining the confidentiality of your credentials (login, password, API tokens) and for all activities that occur under your Account.
**4.3. Prohibition on Sharing.** Your Account is provided exclusively for personal use (or use within a single organization if an Enterprise license is purchased). You may not sell, rent, transfer, or share access to your Account with third parties.
**4.4. Unauthorized Access.** You agree to immediately notify Perricheno Inc. at [insert support email] of any known or suspected unauthorized use of your Account or any other breach of security. The Company shall not be liable for any loss or damage arising from your failure to comply with this obligation.

---

## 5. AI DISCLAIMER

**5.1. Probabilistic Nature of Technology.** The Perricheno Platform is deeply integrated with artificial intelligence technologies. The User explicitly acknowledges and agrees that AI systems, including LLMs, are probabilistic (stochastic) systems. They do not perform logical reasoning in the human sense and generate responses based on statistical patterns.
**5.2. No Guarantee of Accuracy (Hallucinations).** We do not guarantee the absolute accuracy, veracity, logical consistency, or completeness of AI-generated Content. The AI Agent may produce information that appears plausible but is factually incorrect, outdated, or nonsensical (commonly known as "AI hallucinations").
**5.3. Responsibility for Verification.** All Outputs, including generated LaTeX documents, formulas, R scripts, and data visualizations, are provided solely as **"PROBABILISTIC DRAFTS."** The User bears the absolute and sole responsibility for manually reviewing, testing, debugging, and validating all Outputs prior to using them in any professional, academic, commercial, or production environments.
**5.4. No Professional Advice.** The Outputs generated by the Platform do not constitute, and should not be construed as, professional technical, legal, medical, financial, or statistical advice. The Platform is not a substitute for the expertise of a qualified professional. If you use the Platform to analyze critical data, you do so entirely at your own risk.
**5.5. Bias and Offensive Content.** Despite built-in safety filters, the AI may generate content that could be perceived as biased, stereotypical, or offensive. Perricheno Inc. does not endorse the opinions expressed by the AI Agent and bears no liability for any moral damages resulting from exposure to such content.

---

## 6. R-COMPILER USAGE RULES AND NODE SECURITY

The Platform provides access to execute user-provided code (R language) in a cloud environment. Therefore, strict technical operational rules apply.

**6.1. Isolated Environment (Sandbox).** The R compiler environment is a strictly isolated sandbox on our servers. It is designed solely for executing statistical analysis, plotting graphs, and manipulating data provided by the User.
**6.2. Strict Prohibition on Break-outs.** Any attempt to gain unauthorized access, escalate privileges, escape the sandbox, access the Node's system files, or retrieve information about the underlying host operating system is strictly prohibited. Such actions will be classified as a cyberattack.
**6.3. Monitoring.** We reserve the right to automatically scan, monitor, and terminate any execution process within the R Sandbox if it exhibits suspicious activity, signs of malicious behavior, or threatens the integrity of our infrastructure.
**6.4. Resource Limitations (Rate Limits & Quotas).** To prevent server overload (including unintentional infinite loops), the Company enforces strict limits on:

- Maximum execution time per script (Timeouts);
- Amount of RAM consumed;
- CPU time utilization;
- Size of uploaded and generated files;
- Number of compiler requests per minute/hour.
  Attempts to bypass these limits will result in immediate Account suspension.
  **6.5. Network Restrictions.** The R Sandbox has limited or entirely blocked access to the external Internet. You may not use the Platform's R-nodes to scan external ports, launch DDoS attacks, send spam, scrape third-party websites, or establish unauthorized network connections.

---

## 7. ACCEPTABLE USE POLICY (AUP)

When using the Perricheno Platform, you agree to comply with all applicable laws and refrain from engaging in (or facilitating third parties to engage in) the following activities:

**7.1. Malicious Activity:**

- Creating, uploading, or distributing viruses, trojans, worms, logic bombs, or any other malicious software code.
- Using the Platform to generate malware, exploits, or phishing materials via the AI Agent.
- Interfering with the operation of the Platform, its servers, or networks, breaching their security, or attempting to overload the infrastructure (including DoS/DDoS attacks).

**7.2. Intellectual Property Infringement:**

- Uploading, using, or generating Content that infringes upon the copyrights, patents, trademarks, trade secrets, or other IP rights of third parties.
- Decompiling, reverse engineering, disassembling, or attempting to extract the Platform’s source code, AI Agent algorithms, system prompts, or R Sandbox architecture.

**7.3. Automated Access and Scraping:**

- Using spiders, robots, crawlers, scrapers, or other automated means to access the Platform, extract data, or interact with AI Agents outside of the official APIs provided by Perricheno Inc.

**7.4. Illegal and Unethical Content:**

- Generating or distributing Content that is illegal, defamatory, obscene, pornographic, threatening, or incites hatred based on race, ethnicity, religion, or any other characteristic.
- Using the Platform to create materials that facilitate criminal offenses, terrorist activities, or physical harm.
- Collecting or publishing personal data of third parties without their explicit consent (doxxing).

**7.5. Fraud and Deception:**

- Impersonating another person or entity, including Perricheno Inc. employees.
- Using Platform Outputs for mass spamming, generating fake news, or manipulating public opinion in political campaigns.

**7.6. Sanctions.** Upon detecting any of the aforementioned violations, Perricheno Inc. reserves the right to suspend or delete your Account without prior notice, cancel active subscriptions without a refund, and report your activities to law enforcement agencies.

---

## 8. INTELLECTUAL PROPERTY

Intellectual property matters are strictly divided between the rights to the Platform itself and the rights to User Content.

**8.1. Company Rights.** The Perricheno Platform, including but not limited to all source code, object code, databases, functionality, design systems, logos, trademarks, node architecture, proprietary algorithms, LaTeX templates, and interfaces, is the exclusive property of Perricheno Inc. All rights are protected by copyright, patent, and trade secret laws of applicable jurisdictions and international conventions. You are granted a limited, revocable, non-exclusive license to access and use the Platform in accordance with these Terms. You acquire no ownership rights in the Platform.

**8.2. User Rights to Inputs.** You retain all ownership rights, titles, and interests in and to any Inputs (text, code, data) that you upload to the Platform.
**8.3. License to Inputs.** By submitting Inputs to the Platform, you grant Perricheno Inc. a worldwide, non-exclusive, royalty-free license to use, store, copy, process, and display your Inputs solely for the purposes of:
(a) Providing the Platform's services to you (including operating the AI Agent and R compiler);
(b) Ensuring security and preventing abuse;
(c) Complying with legal requirements.
We do _not_ use your private Inputs to train our foundational AI models without your separate, explicit consent (Opt-in), unless otherwise specified in dedicated Enterprise tier agreements.

**8.4. Ownership of Outputs.** To the extent permitted by applicable law, Perricheno Inc. disclaims any ownership rights over the Outputs (generated code, text, compiled LaTeX PDFs) created by you using the Platform. We assign to you all our rights, titles, and interests (if any) in and to the Outputs.
**8.5. Specifics of AI Content Copyright.** The User acknowledges that due to the nature of machine learning, Outputs may not be unique. Other users of the Platform or third-party AI systems may submit similar prompts and receive identical or similar results. Furthermore, the User acknowledges that in certain jurisdictions, content generated entirely by AI may not be eligible for copyright protection. Perricheno Inc. makes no guarantees regarding the patentability or copyrightability of Outputs.
**8.6. Copyright Infringement Claims (DMCA).** If you believe that content on the Platform infringes your copyrights, you must send a notice to our Copyright Agent at [Insert email]. The notice must include a description of the copyrighted work, the URL of the infringing material, your contact details, and a statement of good faith belief regarding the infringement.

---

## 9. ACADEMIC INTEGRITY AND ETHICS

The Perricheno Platform is frequently utilized in academic and scientific environments (e.g., for LaTeX typesetting and R data analysis). Hereby, we establish the following principles of academic ethics.

**9.1. User Responsibility.** Perricheno Inc. provides a tool. We do not control how or where you use the Outputs.
**9.2. Compliance with Institutional Policies.** Users (students, researchers, professors) bear sole responsibility for complying with the codes of academic integrity, rules, and guidelines of their respective universities, schools, research institutions, or scientific journals regarding the use of artificial intelligence.
**9.3. Prohibition of Plagiarism.** You may not use the Platform to pass off AI-generated Content as your own original work if doing so violates the policies of the institution to which the work is submitted.
**9.4. Disclaimer of Academic Sanctions.** PERRICHENO INC. BEARS ABSOLUTELY NO LIABILITY FOR ANY CONSEQUENCES ARISING FROM THE SUBMISSION OF AI-GENERATED CONTENT TO EDUCATIONAL OR SCIENTIFIC INSTITUTIONS. This includes, but is not limited to: receiving failing grades, expulsion from a university, revocation of academic degrees, retraction of scientific papers, disciplinary actions, or damage to academic reputation.
**9.5. Disclosure of AI Use.** We strongly recommend that Users transparently disclose the use of Perricheno AI Agents in the methodology sections of their research or in the acknowledgments, if the Platform was used to write text, generate R code, or format LaTeX.

---

## 10. TELEGRAM INTEGRATION (BOTS AND ASSISTANTS)

Certain Platform functionalities may be accessible via bots and assistants in the Telegram messenger app.

**10.1. Use of Third-Party Platform.** The use of our Telegram bots is subject not only to these Terms but also to the Terms of Service of Telegram itself. Perricheno Inc. is not responsible for Telegram outages, the suspension of your Telegram account by Telegram, or changes to their API.
**10.2. Data Transmission.** By interacting with the Platform via Telegram, you understand that your messages (Inputs) are transmitted through Telegram's servers before reaching Perricheno's servers. We cannot guarantee End-to-End Encryption (E2EE) between your device and Telegram's servers when using standard bots.
**10.3. Message Limits.** We may impose specific limits on the number of messages, prompt length, and the complexity of executed R scripts or LaTeX documents via the Telegram interface, which may differ from the limits of the Platform's web version.

---

## 11. PAYMENTS, SUBSCRIPTIONS, AND REFUNDS

Certain Platform features (including expanded R Sandbox limits and priority AI Agent access) are provided on a paid basis.

**11.1. Pricing.** Descriptions of available subscription plans, pricing, and included quotas are published on the Platform's official website. The Company reserves the right to change prices at any time. Price changes will not affect your already paid subscription period.
**11.2. Billing.** By purchasing a paid subscription, you authorize Perricheno Inc. (and our third-party payment processors, such as Stripe, PayPal, etc.) to charge the payment method (credit/debit card) you provide.
**11.3. Auto-Renewal.** Unless explicitly stated otherwise, all subscriptions renew automatically at the end of the billing cycle (monthly/annually). You may cancel auto-renewal at any time in your Account settings. Cancellation must be performed before the start of the next billing cycle to avoid charges.
**11.4. Taxes.** You are responsible for paying all applicable taxes (including VAT, Sales Tax) associated with the purchase of Platform services in your jurisdiction. If the Company is legally obligated to collect such taxes, they will be added to the subscription cost.
**11.5. Refund Policy.** DUE TO THE NATURE OF DIGITAL SERVICES AND AI COMPUTATIONAL COSTS, ALL SALES ARE FINAL AND NON-REFUNDABLE. We do not provide refunds or credits for partially used subscription periods, nor in the event of your Account being suspended for violating these Terms (Sections 6 and 7). Exceptions may only be made at the Company's sole discretion in the event of a proven technical failure on our end that prevented the use of the Platform.
**11.6. Chargebacks.** In the event of an unjustified chargeback dispute through your bank without prior contact with our support team, we reserve the right to immediately and permanently ban your Account and prohibit you from further use of the Platform.

---

## 12. PRIVACY AND DATA PROTECTION

**12.1. Privacy Policy.** Your access to and use of the Platform is also governed by our **Privacy Policy**, which describes how we collect, use, store, and protect your personal data. By accepting these Terms, you also agree to the terms of the Privacy Policy.
**12.2. Legal Compliance (GDPR / CCPA).** If you are located in the European Economic Area (EEA) or the State of California (USA), you possess specific rights regarding your data, as detailed in the Privacy Policy.
**12.3. Handling of Sensitive Information.** You explicitly agree not to submit strictly sensitive information (e.g., trade secrets, unpublished financial reports), Protected Health Information (PHI), credit card numbers, or full government ID details to the Platform (via text prompts, uploaded files, or R scripts) unless you possess the legal right to do so AND have purchased a specialized Enterprise tier of the Platform accompanied by a signed Data Processing Agreement (DPA).

---

## 13. DISCLAIMER OF WARRANTIES

THIS SECTION IS CRITICAL AND ESTABLISHES THE ABSENCE OF ANY WARRANTIES FROM THE COMPANY.

**13.1. "AS IS" Services.** THE PERRICHENO PLATFORM, WEBSITE, MICROSERVICES, AI AGENTS, R-COMPILER, AND ALL ASSOCIATED MATERIALS ARE PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT ANY WARRANTIES, EXPRESS OR IMPLIED.
**13.2. Disclaimer of Implied Warranties.** TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PERRICHENO INC. EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING, BUT NOT LIMITED TO:

- IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE;
- WARRANTIES OF NON-INFRINGEMENT;
- WARRANTIES THAT THE PLATFORM WILL OPERATE UNINTERRUPTED, ERROR-FREE, TIMELY, OR IN A COMPLETELY SECURE MANNER;
- WARRANTIES THAT ANY DEFECTS OR ERRORS IN THE SOFTWARE WILL BE CORRECTED;
- WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR QUALITY OF ANY INFORMATION OR CODE (INCLUDING LATEX AND R) GENERATED BY THE PLATFORM.

**13.3. Risk of Data Loss.** You acknowledge that you use the Platform at your own risk. You are responsible for backing up your data. We do not guarantee the preservation of your prompts, uploaded files, or generated PDF documents.

---

## 14. LIMITATION OF LIABILITY

THIS SECTION SIGNIFICANTLY LIMITS THE FINANCIAL LIABILITY OF THE COMPANY TOWARDS YOU.

**14.1. Exclusion of Indirect Damages.** TO THE MAXIMUM EXTENT PERMITTED BY LAW, UNDER NO CIRCUMSTANCES SHALL PERRICHENO INC., ITS DIRECTORS, EMPLOYEES, PARTNERS, SUPPLIERS, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY:

- INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES;
- LOSS OF PROFITS, REVENUE, OR POTENTIAL BUSINESS OPPORTUNITIES;
- LOSS, CORRUPTION, OR BREACH OF DATA;
- LOSS OF REPUTATION OR INTANGIBLE DAMAGES;
- ACADEMIC SANCTIONS OR PROFESSIONAL DISCIPLINARY ACTIONS;

ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO, USE OF, OR INABILITY TO USE THE PLATFORM, EVEN IF THE COMPANY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
This includes, but is not limited to, damages resulting from: (a) errors or inaccuracies in AI outputs; (b) incorrect compilation of R code leading to faulty financial or scientific calculations; (c) formatting errors in LaTeX; (d) unauthorized third-party access to your account.

**14.2. Cap on Liability.** IN NO EVENT (WHETHER BASED IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE) SHALL THE AGGREGATE LIABILITY OF PERRICHENO INC. FOR ALL CLAIMS RELATING TO THE PLATFORM OR THESE TERMS EXCEED THE GREATER OF: (I) THE AMOUNT ACTUALLY PAID BY YOU TO THE COMPANY FOR USING THE PLATFORM DURING THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR (II) FIFTY US DOLLARS ($50 USD) (OR THE EQUIVALENT IN LOCAL CURRENCY).

**14.3. Applicability in Different Jurisdictions.** Some jurisdictions do not allow the exclusion of certain implied warranties or the limitation of liability for incidental or consequential damages. In such jurisdictions, the Company's liability shall be limited to the maximum extent permitted by law.

---

## 15. INDEMNIFICATION

You agree to defend, indemnify, and hold harmless Perricheno Inc., its subsidiaries, affiliates, officers, agents, partners, and employees from and against any claims, demands, losses, liabilities, costs, or expenses (including reasonable attorneys' fees) brought by any third party arising out of or relating to:
(a) Your use of the Platform;
(b) Your Inputs (including claims that your data infringes the intellectual property rights of third parties);
(c) Any use by you of the Outputs (including any decisions made by you based on AI-generated content or R visualizations);
(d) Your breach of this Agreement;
(e) Your violation of any rights of another party (including privacy rights);
(f) Your violation of any applicable law, rule, or regulation;
(g) Your willful misconduct, fraud, or academic dishonesty.

The Company reserves the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate with our defense of these claims.

---

## 16. TERM AND TERMINATION

**16.1. Term.** This Agreement is effective from the moment of your acceptance and continues until your Account is active or as long as you continue to use the Platform.
**16.2. Termination by You.** You may terminate this Agreement at any time by ceasing your use of the Platform and deleting your Account via your profile settings or by contacting customer support. Canceling a subscription does not automatically delete your Account.
**16.3. Termination by the Company.** Perricheno Inc. reserves the right, without prior notice and at its sole discretion, to suspend or terminate your access to the Platform (or any part thereof) at any time and for any reason, including but not limited to:
(a) Your violation of any provision of these Terms (especially Sections 6 and 7);
(b) A request by law enforcement or government agencies;
(c) Discontinuation or material modification of the Platform;
(d) Unexpected technical or security issues;
(e) Your failure to pay any amounts owed for a subscription.
**16.4. Effect of Termination.** Upon termination of this Agreement:
(a) All licenses and rights granted to you hereunder shall immediately terminate;
(b) You must immediately cease all use of the Platform;
(c) Your access to your data, prompt history, saved R scripts, and LaTeX documents will be revoked. We are not obligated to retain or provide you with copies of your Content after Account termination.
**16.5. Survival of Provisions.** Provisions of this Agreement that by their nature should survive termination (including, but not limited to: AI Disclaimer, Intellectual Property, Disclaimer of Warranties, Limitation of Liability, Indemnification, and Dispute Resolution) shall survive perpetually.

---

## 17. THIRD-PARTY SERVICES AND LINKS

**17.1. Integrations.** The Platform may integrate with third-party websites, APIs, R packages, servers, and services (e.g., CRAN libraries, databases, external LaTeX plugins).
**17.2. No Control.** The Company does not control such third-party services and bears no responsibility for their availability, security, content, privacy policies, or performance quality. You use any third-party services at your own risk and are subject to their respective terms of use.
**17.3. Links.** The inclusion of links to third-party resources within generated text (Outputs) or on the Platform itself does not imply our endorsement of those resources.

---

## 18. DISPUTE RESOLUTION AND MANDATORY ARBITRATION

PLEASE READ THIS SECTION CAREFULLY. IT SIGNIFICANTLY AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT AND PARTICIPATE IN A CLASS ACTION.

**18.1. Governing Law.** These Terms and any disputes arising out of or related to the Platform shall be governed by and construed in accordance with the laws of the State of Delaware (USA) [Or specify your jurisdiction/country], without regard to its conflict of law principles. The application of the United Nations Convention on Contracts for the International Sale of Goods is expressly excluded.
**18.2. Informal Dispute Resolution.** We prefer to resolve disputes amicably. Before filing a formal claim, you agree to attempt to resolve the dispute informally by contacting us at [Insert email]. We will attempt to resolve the dispute within thirty (30) days. If the dispute is not resolved within this timeframe, either party may initiate arbitration.
**18.3. Binding Arbitration.** ANY DISPUTE, CLAIM, OR CONTROVERSY ARISING OUT OF OR RELATING TO THESE TERMS, THE USE OF THE PLATFORM, OR ITS SERVICES SHALL BE RESOLVED EXCLUSIVELY THROUGH BINDING ARBITRATION, AND NOT IN A COURT OF GENERAL JURISDICTION.
**18.4. Arbitration Procedure.** The arbitration shall be administered by the American Arbitration Association (AAA) in accordance with its Commercial Arbitration Rules [Or specify another body, e.g., LCIA, ICC]. The arbitrator's award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction. The seat of arbitration shall be [Insert City/Country], unless the parties agree otherwise. The proceedings shall be conducted in the English language.
**18.5. CLASS ACTION WAIVER.** YOU AND PERRICHENO INC. AGREE THAT ANY PROCEEDINGS WILL BE CONDUCTED ONLY ON AN INDIVIDUAL BASIS AND NOT IN A CLASS, CONSOLIDATED, OR REPRESENTATIVE ACTION. The arbitrator may not consolidate more than one person's claims. If this specific class action waiver is found to be unenforceable, then the entirety of this arbitration section shall be deemed null and void.
**18.6. Exceptions to Arbitration.** Notwithstanding the foregoing, either party retains the right to bring an individual action in small claims court and to seek injunctive or other equitable relief in a court of competent jurisdiction to prevent the actual or threatened infringement of intellectual property rights, unauthorized access to servers, or data theft (e.g., hacking the R-compiler).

---

## 19. FORCE MAJEURE

**19.1. Exemption from Liability.** Perricheno Inc. shall not be liable for any delay or failure to perform its obligations under this Agreement if such delay or failure is caused by circumstances beyond our reasonable control (Force Majeure).
**19.2. Examples of Force Majeure.** Such circumstances include, but are not limited to: natural disasters (earthquakes, hurricanes, floods), acts of war, terrorism, riots, embargoes, strikes, acts of governmental or regulatory authorities (including internet blockages or sanctions), widespread power outages, global backbone internet provider failures, data center outages (e.g., AWS, Google Cloud), and critical hardware failures.
**19.3. Resumption of Services.** In the event of a Force Majeure event, we commit to making all reasonable efforts to restore the Platform's operability as soon as possible; however, we do not guarantee recovery times (SLAs do not apply in these cases).

---

## 20. EXPORT CONTROL AND SANCTIONS

**20.1. Compliance with Export Laws.** The Platform and its software, including AI models and cryptographic algorithms, may be subject to the export control laws and regulations of the United States, the European Union, and other jurisdictions.
**20.2. User Warranties.** By using the Platform, you represent and warrant that:
(a) You are not located in a country or territory subject to a comprehensive embargo by the US government or other nations (e.g., Cuba, Iran, North Korea, Syria, specific regions of Ukraine);
(b) You are not listed on any restricted parties lists (e.g., the US Treasury Department's Specially Designated Nationals (SDN) list or the EU Consolidated list of sanctions);
(c) You will not use the Platform (and Outputs) for any purposes prohibited by export control laws, including the development, design, manufacture, or distribution of nuclear, chemical, or biological weapons, missile technology, or mass surveillance technology in violation of human rights.
**20.3. Account Ban.** If the Company determines that your use of the Platform violates sanctions restrictions, your Account will be immediately terminated without the right to a refund and without prior notice, and relevant information may be reported to regulatory authorities.

---

## 21. FEEDBACK AND SUGGESTIONS

**21.1. Voluntary Submission.** If you send Perricheno Inc. any ideas, suggestions, feedback, bug reports, or concepts for improving the Platform ("Feedback"), you do so on your own initiative and voluntarily.
**21.2. Transfer of Rights.** You agree that Perricheno Inc. obtains full, perpetual, irrevocable, royalty-free, and global rights to use your Feedback for any purpose, including the development, modification, production, and marketing of products and services, without any obligation to compensate you or attribute authorship to you. You waive any moral rights in relation to such Feedback.

---

## 22. SEVERABILITY AND NON-WAIVER

**22.1. Severability.** If any provision of this Agreement is held by a court of competent jurisdiction or an arbitrator to be invalid, illegal, or unenforceable, it shall not affect the validity of the remaining provisions. The invalid provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable, preserving the original intent of the parties.
**22.2. Non-Waiver.** The failure or delay of Perricheno Inc. to exercise any right, power, or remedy under this Agreement shall not constitute a waiver thereof. A single or partial waiver of any right does not preclude its future exercise. Any waiver of rights by the Company must be in writing and signed by an authorized representative of Perricheno Inc.

---

## 23. ASSIGNMENT

**23.1. Restrictions on the User.** You may not assign, delegate, or otherwise transfer your rights or obligations under this Agreement (by operation of law or otherwise) without the prior written consent of Perricheno Inc. Any attempt to assign without such consent shall be void.
**23.2. Company Rights.** Perricheno Inc. may freely and without your consent assign, delegate, or transfer its rights and obligations under this Agreement, in whole or in part, to any third party, including in connection with a merger, acquisition, corporate reorganization, or sale of all or substantially all of its assets.

---

## 24. NOTICES AND ELECTRONIC COMMUNICATIONS

**24.1. Official Channels.** By creating an Account, you consent to receive electronic communications from us, including emails, in-app system notifications, or messages via the integrated Telegram bot.
**24.2. Legal Validity.** You agree that all agreements, notices, disclosures, and other communications that we provide to you electronically satisfy any legal requirement that such communications be in writing.
**24.3. Opting Out.** You may opt out of receiving marketing or promotional emails by following the unsubscribe instructions contained in those emails. However, you may not opt out of receiving critical transactional, service, or legal notices (e.g., password resets, changes to Terms, or billing notices) while your Account remains active.

---

## 25. GOVERNING LANGUAGE AND TRANSLATIONS

**25.1. Primary Language.** This Agreement was originally drafted in the English language.
**25.2. Controlling Version.** If the Company provides a translation of these Terms into other languages for your convenience, you agree that such translation is for informational purposes only. In the event of any discrepancies, conflicts, or ambiguities between the original version and any translation, the original English version of the Agreement shall strictly prevail.

---

## 26. ENTIRE AGREEMENT

These Terms of Service, together with our Privacy Policy and any other legal notices or policies published by Perricheno Inc. on the Platform, constitute the entire and exclusive agreement between you and the Company regarding your use of the Platform.
This Agreement supersedes and replaces all prior or contemporaneous understandings, negotiations, representations, warranties, commitments, or agreements, whether oral or written (including any previous versions of these Terms), between you and the Company.
In interpreting this Agreement, no rule of strict construction shall be applied against the drafting party (contra proferentem). The section headings herein are for convenience only and have no independent legal significance.

---

## 27. SPECIAL PROVISIONS FOR APPLE AND GOOGLE PLATFORMS (IF APPLICABLE)

If you access the Platform via a mobile application downloaded from the Apple App Store or Google Play Store, the following additional terms apply:
**27.1. Parties to the Agreement.** You acknowledge that these Terms are concluded solely between you and Perricheno Inc., and not with Apple Inc. or Google LLC. Perricheno Inc. is solely responsible for the Platform.
**27.2. Maintenance and Support.** Apple and Google have no obligation whatsoever to furnish any maintenance and support services with respect to the Platform.
**27.3. Third-Party Claims.** You acknowledge that Apple or Google are not responsible for addressing any claims by you or any third party relating to the Platform or your possession and/or use of the application (including product liability claims, failure to conform to legal requirements, or intellectual property infringement claims).
**27.4. Third-Party Beneficiaries.** Apple and Google (and their subsidiaries) are third-party beneficiaries of these Terms and will have the right (and will be deemed to have accepted the right) to enforce these Terms against you as a third-party beneficiary.

---

## 28. CONTACT INFORMATION AND CORPORATE DETAILS

If you have any questions, comments, complaints, or need to serve formal legal notice regarding these Terms, please contact us:

**Company Name:** Perricheno Inc.
**Registered Address:** [Insert full legal address, e.g.: 1209 Orange Street, Wilmington, DE 19801, USA]
**General Inquiries Email:** support@perricheno.com
**Legal Department Email:** legal@perricheno.com
**Privacy Department Email:** privacy@perricheno.com

All formal legal notices must be sent in writing by registered mail to the registered address with a mandatory carbon copy (CC) via email to legal@perricheno.com. Notice will be deemed given five (5) business days after mailing a physical letter, or the next business day after sending an email with receipt confirmation.

---

_(End of Document)_

**I HAVE CAREFULLY READ THESE TERMS OF SERVICE AND FULLY UNDERSTAND THEIR CONTENTS. I ACKNOWLEDGE THAT MY USE OF THE PERRICHENO PLATFORM, INCLUDING AI AGENTS, R-SANDBOX, AND TELEGRAM INTEGRATIONS, IS MY OWN VOLUNTARY DECISION, AND I FREELY AGREE TO BE LEGALLY BOUND BY ALL OF THE PROVISIONS SET FORTH ABOVE.**
