import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { AgentSettings, ScholarArticle } from "@/app/agent/types";
import { verifySession } from '@/lib/session';

export async function POST(req: Request) {
    try {
        const { sessionId } = await req.json();
        
        // Auth check
        const userId = await verifySession();
        if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Get session
        const { data: session } = await supabase.from('agent_sessions').select('*').eq('id', sessionId).single();
        if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

        const prompt = session.stream_text || ""; // Stored the prompt here temporarily
        const settings = (typeof session.settings_json === 'string' ? JSON.parse(session.settings_json) : session.settings_json) as AgentSettings;

        // Ultra-fast AI Auto-translation
        const translationPrompt = `You are an academic translation bridge. The user is searching for scientific papers.
If the following query is in English, reply EXACTLY with the query. 
If it is in ANY other language, translate it faithfully to English keywords. 
DO NOT respond with anything else (no quotes, no intro).
Query: ${prompt}`;

        let translatedPrompt = prompt.trim();
        try {
            const openAiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
                body: JSON.stringify({
                    model: "gpt-5-mini-2025-08-07",
                    messages: [{ role: "user", content: translationPrompt }],
                    temperature: 0
                })
            });
            if (openAiRes.ok) {
                const completion = await openAiRes.json();
                translatedPrompt = completion.choices?.[0]?.message?.content?.trim() || prompt.trim();
            }
        } catch (e) {
            console.error("Translation error", e);
        }

        // Directly construct arXiv query (Ultra-fast, deterministic)
        const keywords = translatedPrompt ? `all:${translatedPrompt}` : "all:science";
        let arxivQuery = keywords;

        if (settings.scholarAuthors && settings.scholarAuthors !== "None") {
            arxivQuery = `(${keywords}) AND au:${settings.scholarAuthors}`;
        }

        const maxResults = settings.scholarMaxArticles || 10;
        let articles: ScholarArticle[] = [];
        const usingOpenAlex = settings.scholarSource === 'openalex';

        if (usingOpenAlex) {
            // ===== OPENALEX API =====
            const openAlexQuery = encodedQuery; // OpenAlex works well with plain url-encoded keywords
            let openAlexUrl = `https://api.openalex.org/works?search=${openAlexQuery}&per-page=${maxResults}&mailto=admin@perricheno.com`;
            
            // Add year filter
            if (settings.scholarYearFrom && settings.scholarYearFrom !== "Any") {
                openAlexUrl += `&filter=publication_year:>${parseInt(settings.scholarYearFrom) - 1}`;
            }
            
            // Add author filter (simple text search in author names if provided)
            if (settings.scholarAuthors && settings.scholarAuthors !== "None") {
                openAlexUrl += `,author.id:${encodeURIComponent(settings.scholarAuthors)}`; // This is a rough approx, OpenAlex prefers author OpenAlex IDs, but 'search' parameter covers general text anyway
            }

            const response = await fetch(openAlexUrl, { next: { revalidate: 3600 } });
            if (!response.ok) throw new Error(`OpenAlex API error: ${response.status}`);
            const data = await response.json();

            // Reconstruct abstract from inverted index
            const reconstructAbstract = (invertedIndex: any) => {
                if (!invertedIndex) return "No abstract available.";
                let maxPos = 0;
                for (const positions of Object.values(invertedIndex)) {
                    for (const pos of (positions as number[])) {
                        if (pos > maxPos) maxPos = pos;
                    }
                }
                const arr = new Array(maxPos + 1).fill("");
                for (const [word, positions] of Object.entries(invertedIndex)) {
                    for (const pos of (positions as number[])) {
                        arr[pos] = word;
                    }
                }
                return arr.join(" ").trim();
            };

            articles = (data.results || []).map((work: any) => {
                // Try to find if it's an arXiv paper to build PDF/TeX links, otherwise use OA url
                let url = work.id; // Default OpenAlex url
                let doi = work.doi ? work.doi.replace('https://doi.org/', '') : undefined;
                
                // If it's open access, provide that as the main URL so the UI can do its best
                if (work.open_access?.oa_url) url = work.open_access.oa_url;
                
                return {
                    title: work.title || "Untitled",
                    summary: reconstructAbstract(work.abstract_inverted_index),
                    authors: work.authorships?.map((a: any) => a.author?.display_name || "Unknown") || ["Unknown"],
                    year: work.publication_year || 0,
                    url,
                    doi
                };
            });

        } else {
            // ===== ARXIV API =====
            const arxivUrl = `http://export.arxiv.org/api/query?search_query=${encodedQuery}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

            let fetchOptions: RequestInit = {
                headers: { "User-Agent": "Perricheno-AI-Agent/1.0 (support@perricheno.com)" },
                next: { revalidate: 3600 } 
            };

            let response = await fetch(arxivUrl, fetchOptions);

            if (response.status === 503) {
                console.log("arXiv 503 Service Unavailable. Retrying once after 1 second...");
                await new Promise(r => setTimeout(r, 1000));
                fetchOptions = {
                    headers: { "User-Agent": "Perricheno-AI-Agent/1.0 (support@perricheno.com)" },
                    cache: 'no-store' 
                };
                response = await fetch(arxivUrl, fetchOptions);
            }

            if (!response.ok) {
                throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
            }
            const xmlText = await response.text();

            const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
            let entryMatch;

            while ((entryMatch = entryRegex.exec(xmlText)) !== null) {
                const entryXml = entryMatch[1];
                const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(entryXml);
                const summaryMatch = /<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(entryXml);
                const publishedMatch = /<published[^>]*>([\s\S]*?)<\/published>/i.exec(entryXml);
                const idMatch = /<id[^>]*>([\s\S]*?)<\/id>/i.exec(entryXml);
                const doiMatch = /<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/i.exec(entryXml);

                const cleanHtml = (str: string) => str
                    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
                    .replace(/<[^>]+>/g, '') 
                    .replace(/\s+/g, ' ') 
                    .trim();

                const title = titleMatch ? cleanHtml(titleMatch[1]) : "Untitled";
                const summary = summaryMatch ? cleanHtml(summaryMatch[1]) : "No abstract available.";
                const publishedDate = publishedMatch ? publishedMatch[1].trim() : "";
                const year = publishedDate ? new Date(publishedDate).getFullYear() : 0;
                const url = idMatch ? idMatch[1].trim() : "";
                const doi = doiMatch ? doiMatch[1].trim() : undefined;

                if (settings.scholarYearFrom && settings.scholarYearFrom !== "Any") {
                    if (year < parseInt(settings.scholarYearFrom)) {
                        continue;
                    }
                }

                const authorRegex = /<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/gi;
                let authorsList: string[] = [];
                let authorMatch;
                while ((authorMatch = authorRegex.exec(entryXml)) !== null) {
                    if (authorMatch[1]) authorsList.push(cleanHtml(authorMatch[1]));
                }
                if (authorsList.length === 0) authorsList.push("Unknown");

                articles.push({
                    title,
                    summary,
                    authors: authorsList,
                    year,
                    url,
                    doi
                });
            }
        }

        // 5. Save back to DB
        await supabase.from('agent_sessions').update({
            status: 'completed',
            visuals_json: JSON.stringify(articles),
        }).eq('id', sessionId);

        return NextResponse.json({ articles, query: translatedPrompt });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
